import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { RolUsuario, Turno } from "@prisma/client";
import { createApp } from "../src/app";
import { crearProgramacionSemanal } from "../src/services/programacion-semanal";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearUsuario } from "./helpers/personal-fixtures";

const AHORA = new Date("2026-07-17T14:00:00.000Z");
const PASSWORD = "Admin-Programacion-2026";

function cookie(response: request.Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[];
  return cookies[0].split(";")[0];
}

async function contexto() {
  const app = createApp(testPrisma, { reloj: () => AHORA });
  await crearUsuario({
    rol: RolUsuario.ADMIN,
    email: "admin-prog@senaldevida.pe",
    password: PASSWORD,
  });
  const login = await request(app)
    .post("/personal/sesion")
    .send({ email: "admin-prog@senaldevida.pe", password: PASSWORD });
  const especialidad = await testPrisma.especialidad.create({
    data: { nombre: "Programación", duracionCitaMinutos: 60 },
  });
  const consultorios = await Promise.all(
    [1, 2, 3, 4].map((numero) =>
      testPrisma.consultorio.create({
        data: {
          codigo: `PROG-${numero}`,
          nombre: `Consultorio programación ${numero}`,
        },
      }),
    ),
  );
  return { app, cookieAdmin: cookie(login), especialidad, consultorios };
}

async function medico(especialidadId: string, nombre: string, horasSemanales = 8) {
  return testPrisma.medico.create({
    data: { nombre, horasSemanales, especialidadId },
  });
}

describe("administración de programación versionada", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("crea una revisión futura sin mutar la vigente y resuelve ambas fronteras (PROG-4.1)", async () => {
    const { app, cookieAdmin, especialidad, consultorios } = await contexto();
    const doctor = await medico(especialidad.id, "Médico frontera");
    const baseline = await crearProgramacionSemanal(testPrisma, {
      medicoId: doctor.id,
      consultorioId: consultorios[0].id,
      diaSemana: 5,
      turno: Turno.MANANA,
    });
    const guardado = await request(app)
      .post(`/personal/admin/programacion/${doctor.id}`)
      .set("Cookie", cookieAdmin)
      .send({
        versionBase: 1,
        vigenteDesde: "2026-07-20",
        items: [
          { consultorioId: consultorios[1].id, diaSemana: 1, turno: "TARDE" },
        ],
      });
    expect(guardado.status).toBe(201);
    expect(guardado.body.revision.numero).toBe(2);

    const antes = await request(app)
      .get(`/personal/admin/programacion/${doctor.id}?fechaLima=2026-07-19`)
      .set("Cookie", cookieAdmin);
    const desde = await request(app)
      .get(`/personal/admin/programacion/${doctor.id}?fechaLima=2026-07-20`)
      .set("Cookie", cookieAdmin);
    expect(antes.body.revisionAplicable).toMatchObject({
      numero: 1,
      vigenteDesde: "1970-01-01",
    });
    expect(desde.body.revisionAplicable).toMatchObject({
      numero: 2,
      vigenteDesde: "2026-07-20",
    });
    await expect(
      testPrisma.programacionSemanal.findUnique({ where: { id: baseline.id } }),
    ).resolves.toMatchObject({ consultorioId: consultorios[0].id });
  });

  it("rechaza vigencia no futura o plan omitido sin crear revisión (PROG-4.2)", async () => {
    const { app, cookieAdmin, especialidad, consultorios } = await contexto();
    const doctor = await medico(especialidad.id, "Médico inválidos");
    const variantes = [
      { versionBase: 0, vigenteDesde: "2026-07-17", items: [] },
      { versionBase: 0, vigenteDesde: "2026-07-16", items: [] },
      { versionBase: 0, vigenteDesde: "2026-07-20" },
    ];
    for (const body of variantes) {
      const respuesta = await request(app)
        .post(`/personal/admin/programacion/${doctor.id}`)
        .set("Cookie", cookieAdmin)
        .send(body);
      expect(respuesta.status).toBe(400);
      await expect(
        testPrisma.revisionProgramacion.count({ where: { medicoId: doctor.id } }),
      ).resolves.toBe(0);
    }
    expect(consultorios).toHaveLength(4);
  });

  it("confirma planes independientes concurrentes con conjuntos exactos (PROG-5.1)", async () => {
    const { app, cookieAdmin, especialidad, consultorios } = await contexto();
    const [medicoA, medicoB] = await Promise.all([
      medico(especialidad.id, "Médico concurrente A"),
      medico(especialidad.id, "Médico concurrente B"),
    ]);
    const solicitudes = [
      { medicoId: medicoA.id, consultorioId: consultorios[0].id, diaSemana: 1 },
      { medicoId: medicoB.id, consultorioId: consultorios[1].id, diaSemana: 2 },
    ];
    const respuestas = await Promise.all(
      solicitudes.map((item) =>
        request(app)
          .post(`/personal/admin/programacion/${item.medicoId}`)
          .set("Cookie", cookieAdmin)
          .send({
            versionBase: 0,
            vigenteDesde: "2026-07-20",
            items: [
              { consultorioId: item.consultorioId, diaSemana: item.diaSemana, turno: "MANANA" },
            ],
          }),
      ),
    );
    expect(respuestas.map((item) => item.status)).toEqual([201, 201]);
    for (const solicitud of solicitudes) {
      const revisiones = await testPrisma.revisionProgramacion.findMany({
        where: { medicoId: solicitud.medicoId },
        include: { programaciones: true },
      });
      expect(revisiones).toHaveLength(1);
      expect(revisiones[0].programaciones).toMatchObject([
        {
          consultorioId: solicitud.consultorioId,
          diaSemana: solicitud.diaSemana,
          turno: Turno.MANANA,
        },
      ]);
    }
  });

  it("serializa rivales y revierte versión obsoleta, horas y consultorio ocupado (PROG-5.2)", async () => {
    const { app, cookieAdmin, especialidad, consultorios } = await contexto();
    const [objetivo, otro] = await Promise.all([
      medico(especialidad.id, "Médico rival", 8),
      medico(especialidad.id, "Médico ocupado", 8),
    ]);
    const rivales = await Promise.all([
      request(app)
        .post(`/personal/admin/programacion/${objetivo.id}`)
        .set("Cookie", cookieAdmin)
        .send({ versionBase: 0, vigenteDesde: "2026-07-20", items: [{ consultorioId: consultorios[0].id, diaSemana: 1, turno: "MANANA" }] }),
      request(app)
        .post(`/personal/admin/programacion/${objetivo.id}`)
        .set("Cookie", cookieAdmin)
        .send({ versionBase: 0, vigenteDesde: "2026-07-20", items: [{ consultorioId: consultorios[1].id, diaSemana: 2, turno: "TARDE" }] }),
    ]);
    expect(rivales.map((item) => item.status).sort()).toEqual([201, 409]);
    await expect(
      testPrisma.revisionProgramacion.count({ where: { medicoId: objetivo.id } }),
    ).resolves.toBe(1);

    const ganador = rivales.find((item) => item.status === 201)!;
    const itemGanador = ganador.body.revision.items[0];
    const horas = await request(app)
      .post(`/personal/admin/programacion/${objetivo.id}`)
      .set("Cookie", cookieAdmin)
      .send({
        versionBase: 1,
        vigenteDesde: "2026-07-21",
        items: [1, 2, 3].map((diaSemana, indice) => ({
          consultorioId: consultorios[indice].id,
          diaSemana,
          turno: "MANANA",
        })),
      });
    const ocupado = await request(app)
      .post(`/personal/admin/programacion/${otro.id}`)
      .set("Cookie", cookieAdmin)
      .send({
        versionBase: 0,
        vigenteDesde: "2026-07-20",
        items: [itemGanador],
      });
    expect(horas.status).toBe(409);
    expect(ocupado.status).toBe(409);
    await expect(testPrisma.revisionProgramacion.count()).resolves.toBe(1);
    await expect(testPrisma.programacionSemanal.count()).resolves.toBe(1);
  });
});
