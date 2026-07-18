import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { EstadoSlot, PrismaClient, RolUsuario, Turno } from "@prisma/client";
import { createApp } from "../src/app";
import { crearProgramacionSemanal } from "../src/services/programacion-semanal";
import { MotorDisponibilidad } from "../src/services/motor-disponibilidad";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearUsuario } from "./helpers/personal-fixtures";

const AHORA = new Date("2026-07-17T14:00:00.000Z");
const PASSWORD = "Admin-Reconciliacion-2026";
const queryPrisma = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
const queries: string[] = [];
queryPrisma.$on("query", (event) => queries.push(event.query));

function escriturasSlot(tipo: "INSERT" | "DELETE") {
  return queries.filter((query) =>
    new RegExp(`^\\s*${tipo}\\s+(?:INTO\\s+|FROM\\s+).*"Slot"`, "i").test(query),
  );
}

function cookie(response: request.Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[];
  return cookies[0].split(";")[0];
}

async function escenario() {
  const app = createApp(queryPrisma, { reloj: () => AHORA });
  await crearUsuario({
    rol: RolUsuario.ADMIN,
    email: "admin-reconciliacion@senaldevida.pe",
    password: PASSWORD,
  });
  const login = await request(app)
    .post("/personal/sesion")
    .send({ email: "admin-reconciliacion@senaldevida.pe", password: PASSWORD });
  const especialidad = await testPrisma.especialidad.create({
    data: { nombre: "Reconciliación", duracionCitaMinutos: 60 },
  });
  const medico = await testPrisma.medico.create({
    data: { nombre: "Médico reconciliación", horasSemanales: 8, especialidadId: especialidad.id },
  });
  const consultorio = await testPrisma.consultorio.create({
    data: { codigo: "REC-1", nombre: "Consultorio reconciliación" },
  });
  const baseline = await crearProgramacionSemanal(testPrisma, {
    medicoId: medico.id,
    consultorioId: consultorio.id,
    diaSemana: 5,
    turno: Turno.MANANA,
  });
  const motor = new MotorDisponibilidad(queryPrisma, () => AHORA);
  await motor.asegurarHorizonte("2026-07-17");
  return { app, cookieAdmin: cookie(login), medico, consultorio, baseline, motor };
}

describe("reconciliación por vigencia", () => {
  beforeEach(async () => {
    await limpiarDominio();
    queries.length = 0;
  });
  afterAll(async () => {
    await Promise.all([queryPrisma.$disconnect(), testPrisma.$disconnect()]);
  });

  it("sustituye solo libres desde la vigencia y deja el horizonte caliente (SLOT-7.1)", async () => {
    const { app, cookieAdmin, medico, consultorio, baseline, motor } = await escenario();
    const anteriores = await testPrisma.slot.findMany({
      where: { fechaLima: { lt: new Date("2026-07-24T00:00:00.000Z") } },
      orderBy: { inicioUtc: "asc" },
    });
    queries.length = 0;
    const guardado = await request(app)
      .post(`/personal/admin/programacion/${medico.id}`)
      .set("Cookie", cookieAdmin)
      .send({
        versionBase: 1,
        vigenteDesde: "2026-07-24",
        items: [{ consultorioId: consultorio.id, diaSemana: 5, turno: "TARDE" }],
      });
    expect(guardado.status).toBe(201);
    expect(escriturasSlot("DELETE").length).toBeGreaterThan(0);
    expect(escriturasSlot("INSERT").length).toBeGreaterThan(0);
    const posteriores = await testPrisma.slot.findMany({
      where: { fechaLima: { gte: new Date("2026-07-24T00:00:00.000Z") } },
      include: { programacionSemanal: true },
    });
    expect(posteriores).not.toHaveLength(0);
    expect(posteriores.every((slot) => slot.programacionSemanal.revisionId !== baseline.revisionId)).toBe(true);
    await expect(
      testPrisma.slot.findMany({
        where: { id: { in: anteriores.map((slot) => slot.id) } },
        orderBy: { inicioUtc: "asc" },
      }),
    ).resolves.toEqual(anteriores);

    queries.length = 0;
    const repeticion = await motor.asegurarHorizonte("2026-07-17");
    expect(repeticion.insertados).toBe(0);
    expect(escriturasSlot("INSERT")).toHaveLength(0);
    expect(escriturasSlot("DELETE")).toHaveLength(0);
  });

  it("preserva RESERVADO/BLOQUEADO y omite intervalos solapados (SLOT-7.2)", async () => {
    const { app, cookieAdmin, medico, consultorio, baseline } = await escenario();
    const [reservado, bloqueado] = await testPrisma.slot.findMany({
      where: { fechaLima: new Date("2026-07-24T00:00:00.000Z") },
      orderBy: { inicioUtc: "asc" },
      take: 2,
    });
    await testPrisma.slot.update({
      where: { id: reservado.id },
      data: { estado: EstadoSlot.RESERVADO },
    });
    await testPrisma.slot.update({
      where: { id: bloqueado.id },
      data: { estado: EstadoSlot.BLOQUEADO },
    });
    const paciente = await testPrisma.paciente.create({
      data: { dni: "76543210", telefono: "987654321", nombre: "Paciente preservado" },
    });
    const cita = await testPrisma.cita.create({
      data: {
        pacienteId: paciente.id,
        slotId: reservado.id,
        codigoReserva: "SV-ABCDEFGH",
        estado: "RESERVADA",
        reservadaEn: new Date("2026-07-17T14:00:00.000Z"),
        venceEn: new Date("2026-07-20T14:00:00.000Z"),
        idempotencyKey: randomUUID(),
        idempotencyFingerprint: "a".repeat(64),
      },
    });

    const guardado = await request(app)
      .post(`/personal/admin/programacion/${medico.id}`)
      .set("Cookie", cookieAdmin)
      .send({
        versionBase: 1,
        vigenteDesde: "2026-07-24",
        items: [{ consultorioId: consultorio.id, diaSemana: 5, turno: "MANANA" }],
      });
    expect(guardado.status).toBe(201);
    expect(guardado.body.reconciliacion.omitidosPorOcupacion).toBeGreaterThanOrEqual(2);
    const preservados = await testPrisma.slot.findMany({
      where: { id: { in: [reservado.id, bloqueado.id] } },
      orderBy: { inicioUtc: "asc" },
    });
    expect(preservados.map((slot) => ({ id: slot.id, estado: slot.estado, programacionSemanalId: slot.programacionSemanalId }))).toEqual([
      { id: reservado.id, estado: EstadoSlot.RESERVADO, programacionSemanalId: baseline.id },
      { id: bloqueado.id, estado: EstadoSlot.BLOQUEADO, programacionSemanalId: baseline.id },
    ]);
    await expect(testPrisma.cita.findUnique({ where: { id: cita.id } })).resolves.toMatchObject({ slotId: reservado.id, estado: "RESERVADA" });

    const nuevos = await testPrisma.slot.findMany({
      where: {
        fechaLima: new Date("2026-07-24T00:00:00.000Z"),
        programacionSemanal: { revision: { numero: 2 } },
      },
    });
    for (const nuevo of nuevos) {
      for (const preservado of preservados) {
        expect(nuevo.inicioUtc < preservado.finUtc && preservado.inicioUtc < nuevo.finUtc).toBe(false);
      }
    }
  });
});
