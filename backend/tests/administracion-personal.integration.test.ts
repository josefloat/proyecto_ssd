import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { RolUsuario, Turno } from "@prisma/client";
import { createApp } from "../src/app";
import { verifyPassword } from "../src/domain/auth";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearCitaFixture, crearUsuario } from "./helpers/personal-fixtures";

const AHORA = new Date("2026-07-17T14:00:00.000Z");
const PASSWORD_ADMIN = "Admin-Segura-2026";
const PASSWORD_MEDICO = "Medico-Segura-2026";

function cookie(response: request.Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[];
  return cookies.find((item) => item.startsWith("sdv_personal_session="))!.split(";")[0];
}

async function adminAutenticado(app: ReturnType<typeof createApp>) {
  await crearUsuario({
    rol: RolUsuario.ADMIN,
    email: "admin@senaldevida.pe",
    password: PASSWORD_ADMIN,
  });
  return cookie(
    await request(app)
      .post("/personal/sesion")
      .send({ email: "admin@senaldevida.pe", password: PASSWORD_ADMIN }),
  );
}

async function personalMedicoConAgenda() {
  const fixture = await crearCitaFixture({
    fechaLima: "2026-07-17",
    inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
    prefijo: "adm-agenda",
  });
  const consultorio = await testPrisma.consultorio.create({
    data: { codigo: "ADM-2", nombre: "Consultorio administrativo 2" },
  });
  await testPrisma.programacionSemanal.create({
    data: {
      revisionId: fixture.programacion.revisionId,
      medicoId: fixture.medico.id,
      consultorioId: consultorio.id,
      diaSemana: 2,
      turno: Turno.TARDE,
    },
  });
  const usuario = await crearUsuario({
    rol: RolUsuario.MEDICO,
    email: "medico-admin@senaldevida.pe",
    password: PASSWORD_MEDICO,
    medicoId: fixture.medico.id,
  });
  return { ...fixture, usuario };
}

async function snapshotClinico(medicoId: string) {
  const programaciones = await testPrisma.programacionSemanal.findMany({
    where: { medicoId },
    orderBy: { id: "asc" },
  });
  const slots = await testPrisma.slot.findMany({
    where: { programacionSemanal: { medicoId } },
    orderBy: { id: "asc" },
  });
  const citas = await testPrisma.cita.findMany({
    where: { slot: { programacionSemanal: { medicoId } } },
    orderBy: { id: "asc" },
  });
  return { programaciones, slots, citas };
}

describe("administración de personal", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("crea RECEPCIONISTA y MEDICO de forma atómica y entrega temporales una vez (ADM-1.1)", async () => {
    const app = createApp(testPrisma, { reloj: () => AHORA });
    const cookieAdmin = await adminAutenticado(app);
    const especialidad = await testPrisma.especialidad.create({
      data: { nombre: "Administración médica", duracionCitaMinutos: 30 },
    });
    const casos = [
      {
        rol: "RECEPCIONISTA",
        nombre: "  Rosa   Recepción ",
        email: " Rosa@SenalDeVida.pe ",
      },
      {
        rol: "MEDICO",
        nombre: "  Dr. Mario   Paz ",
        email: " Mario@SenalDeVida.pe ",
        especialidadId: especialidad.id,
        horasSemanales: 12,
      },
    ];

    const respuestas = [];
    for (const body of casos) {
      respuestas.push(
        await request(app)
          .post("/personal/admin/usuarios")
          .set("Cookie", cookieAdmin)
          .send(body),
      );
    }

    expect(respuestas.map((item) => item.status)).toEqual([201, 201]);
    for (const respuesta of respuestas) {
      expect(respuesta.headers["cache-control"]).toBe("no-store");
      expect(JSON.stringify(respuesta.body)).not.toContain("passwordHash");
      const persistido = await testPrisma.usuario.findUniqueOrThrow({
        where: { id: respuesta.body.usuario.id },
      });
      expect(persistido.debeCambiarPassword).toBe(true);
      expect(verifyPassword(respuesta.body.passwordTemporal, persistido.passwordHash)).toBe(true);
    }
    const recepcion = await testPrisma.usuario.findUniqueOrThrow({
      where: { email: "rosa@senaldevida.pe" },
    });
    expect(recepcion.medicoId).toBeNull();
    const medicoUsuario = await testPrisma.usuario.findUniqueOrThrow({
      where: { email: "mario@senaldevida.pe" },
      include: { medico: true },
    });
    expect(medicoUsuario.medico).toMatchObject({
      nombre: "Dr. Mario Paz",
      especialidadId: especialidad.id,
      horasSemanales: 12,
    });
    const listado = await request(app)
      .get("/personal/admin/usuarios")
      .set("Cookie", cookieAdmin);
    expect(listado.body.items).toHaveLength(2);
  });

  it("rechaza datos, duplicados y actores ajenos sin perfiles parciales (ADM-1.2)", async () => {
    const app = createApp(testPrisma, { reloj: () => AHORA });
    const cookieAdmin = await adminAutenticado(app);
    const recepcion = await crearUsuario({
      rol: RolUsuario.RECEPCIONISTA,
      password: PASSWORD_MEDICO,
      email: "actor-recepcion@senaldevida.pe",
    });
    const loginRecepcion = await request(app)
      .post("/personal/sesion")
      .send({ email: recepcion.email, password: PASSWORD_MEDICO });
    const especialidadActor = await testPrisma.especialidad.create({
      data: { nombre: "Actor médico", duracionCitaMinutos: 30 },
    });
    const medicoActor = await testPrisma.medico.create({
      data: {
        nombre: "Actor médico",
        horasSemanales: 8,
        especialidadId: especialidadActor.id,
      },
    });
    const usuarioMedico = await crearUsuario({
      rol: RolUsuario.MEDICO,
      password: PASSWORD_MEDICO,
      email: "actor-medico@senaldevida.pe",
      medicoId: medicoActor.id,
    });
    const loginMedico = await request(app)
      .post("/personal/sesion")
      .send({ email: usuarioMedico.email, password: PASSWORD_MEDICO });
    const base = {
      rol: "MEDICO",
      nombre: "Médico inválido",
      email: "nuevo@senaldevida.pe",
      especialidadId: "99999999-9999-4999-8999-999999999999",
      horasSemanales: 8,
    };
    const variantes = [
      { cookie: cookieAdmin, body: base, status: 400 },
      { cookie: cookieAdmin, body: { ...base, horasSemanales: 0 }, status: 400 },
      {
        cookie: cookieAdmin,
        body: { rol: "RECEPCIONISTA", nombre: "Duplicado", email: "admin@senaldevida.pe" },
        status: 409,
      },
      { cookie: cookie(loginRecepcion), body: { rol: "RECEPCIONISTA", nombre: "Sin permiso", email: "sin-permiso@senaldevida.pe" }, status: 403 },
      { cookie: cookie(loginMedico), body: { rol: "RECEPCIONISTA", nombre: "Sin permiso médico", email: "sin-permiso-medico@senaldevida.pe" }, status: 403 },
    ];

    for (const variante of variantes) {
      const antes = {
        usuarios: await testPrisma.usuario.count(),
        medicos: await testPrisma.medico.count(),
      };
      const respuesta = await request(app)
        .post("/personal/admin/usuarios")
        .set("Cookie", variante.cookie)
        .send(variante.body);
      expect(respuesta.status).toBe(variante.status);
      expect(respuesta.body.passwordTemporal).toBeUndefined();
      await expect(testPrisma.usuario.count()).resolves.toBe(antes.usuarios);
      await expect(testPrisma.medico.count()).resolves.toBe(antes.medicos);
    }
  });

  it("actualiza datos y estado revocando acceso sin tocar la agenda (ADM-2.1)", async () => {
    const app = createApp(testPrisma, { reloj: () => AHORA });
    const cookieAdmin = await adminAutenticado(app);
    const { medico, usuario } = await personalMedicoConAgenda();
    const loginMedico = await request(app)
      .post("/personal/sesion")
      .send({ email: usuario.email, password: PASSWORD_MEDICO });
    const cookieMedico = cookie(loginMedico);
    const antes = await snapshotClinico(medico.id);

    const editado = await request(app)
      .patch(`/personal/admin/usuarios/${usuario.id}`)
      .set("Cookie", cookieAdmin)
      .send({ nombre: "Dra. Nombre Administrado", email: "nuevo-medico@senaldevida.pe" });
    const inactivo = await request(app)
      .patch(`/personal/admin/usuarios/${usuario.id}`)
      .set("Cookie", cookieAdmin)
      .send({ activo: false });
    const accesoRevocado = await request(app)
      .get("/personal/medico/agenda")
      .set("Cookie", cookieMedico);
    const reactivado = await request(app)
      .patch(`/personal/admin/usuarios/${usuario.id}`)
      .set("Cookie", cookieAdmin)
      .send({ activo: true });

    expect(editado.status).toBe(200);
    expect(inactivo.status).toBe(200);
    expect(accesoRevocado.status).toBe(401);
    expect(reactivado.status).toBe(200);
    expect((await testPrisma.medico.findUniqueOrThrow({ where: { id: medico.id } })).nombre).toBe("Dra. Nombre Administrado");
    expect(await snapshotClinico(medico.id)).toEqual(antes);
    await expect(
      request(app).get("/personal/medico/agenda").set("Cookie", cookieMedico),
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      request(app)
        .post("/personal/sesion")
        .send({ email: "nuevo-medico@senaldevida.pe", password: PASSWORD_MEDICO }),
    ).resolves.toMatchObject({ status: 200 });
  });

  it("elimina cuentas vacías y rechaza mutaciones o borrado con historia sin mutar clínica (ADM-2.1, ADM-2.2)", async () => {
    const app = createApp(testPrisma, { reloj: () => AHORA });
    const cookieAdmin = await adminAutenticado(app);
    const { medico, usuario } = await personalMedicoConAgenda();
    const otra = await testPrisma.especialidad.create({
      data: { nombre: "Otra especialidad", duracionCitaMinutos: 30 },
    });
    const recepcionVacia = await crearUsuario({
      rol: RolUsuario.RECEPCIONISTA, email: "recepcion-vacia@senaldevida.pe", password: PASSWORD_MEDICO,
    });
    await request(app).post("/personal/sesion").send({ email: recepcionVacia.email, password: PASSWORD_MEDICO });
    const especialidadVacia = await testPrisma.especialidad.create({
      data: { nombre: "Especialidad sin historia", duracionCitaMinutos: 30 },
    });
    const medicoVacio = await testPrisma.medico.create({
      data: { nombre: "Médico sin historia", horasSemanales: 8, especialidadId: especialidadVacia.id },
    });
    const usuarioMedicoVacio = await crearUsuario({
      rol: RolUsuario.MEDICO, email: "medico-vacio@senaldevida.pe", password: PASSWORD_MEDICO, medicoId: medicoVacio.id,
    });
    await request(app).post("/personal/sesion").send({ email: usuarioMedicoVacio.email, password: PASSWORD_MEDICO });
    const eliminaciones = await Promise.all([
      request(app).delete(`/personal/admin/usuarios/${recepcionVacia.id}`).set("Cookie", cookieAdmin),
      request(app).delete(`/personal/admin/usuarios/${usuarioMedicoVacio.id}`).set("Cookie", cookieAdmin),
    ]);
    expect(eliminaciones.map((item) => item.status)).toEqual([204, 204]);
    await expect(testPrisma.usuario.findMany({ where: { id: { in: [recepcionVacia.id, usuarioMedicoVacio.id] } } })).resolves.toEqual([]);
    await expect(testPrisma.sesion.count({ where: { usuarioId: { in: [recepcionVacia.id, usuarioMedicoVacio.id] } } })).resolves.toBe(0);
    await expect(testPrisma.medico.findUnique({ where: { id: medicoVacio.id } })).resolves.toBeNull();
    const antes = {
      usuario: await testPrisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } }),
      medico: await testPrisma.medico.findUniqueOrThrow({ where: { id: medico.id } }),
      clinica: await snapshotClinico(medico.id),
    };
    const mutaciones = [
      request(app).patch(`/personal/admin/usuarios/${usuario.id}`).set("Cookie", cookieAdmin).send({ rol: "RECEPCIONISTA" }),
      request(app).patch(`/personal/admin/usuarios/${usuario.id}`).set("Cookie", cookieAdmin).send({ especialidadId: otra.id }),
      request(app).patch(`/personal/admin/usuarios/${usuario.id}`).set("Cookie", cookieAdmin).send({ horasSemanales: 4 }),
      request(app).delete(`/personal/admin/usuarios/${usuario.id}`).set("Cookie", cookieAdmin),
    ];
    const respuestas = [];
    for (const mutacion of mutaciones) respuestas.push(await mutacion);
    expect(respuestas.map((item) => item.status)).toEqual([400, 409, 409, 409]);
    expect({
      usuario: await testPrisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } }),
      medico: await testPrisma.medico.findUniqueOrThrow({ where: { id: medico.id } }),
      clinica: await snapshotClinico(medico.id),
    }).toEqual(antes);
  });
});
