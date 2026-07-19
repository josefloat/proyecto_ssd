import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { EstadoCita, RolUsuario } from "@prisma/client";
import { createApp } from "../src/app";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearCitaFixture, crearUsuario } from "./helpers/personal-fixtures";

const AHORA = new Date("2026-07-17T14:00:00.000Z"); // 09:00 Lima → hoy = 2026-07-17
const reloj = () => AHORA;
const PASSWORD = "Recepcion-Clave-123";

function valorCookie(res: request.Response): string {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  const objetivo = (cookies ?? []).find((c) =>
    c.startsWith("sdv_personal_session="),
  );
  return (objetivo ?? "").split(";")[0];
}

describe("agenda diaria de recepción y registro de pago", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  async function cookieRecepcion(app: ReturnType<typeof createApp>): Promise<string> {
    const u = await crearUsuario({
      rol: RolUsuario.RECEPCIONISTA,
      password: PASSWORD,
      email: "recepcion@senaldevida.pe",
    });
    const login = await request(app)
      .post("/personal/sesion")
      .send({ email: u.email, password: PASSWORD });
    return valorCookie(login);
  }

  it("ventana de siete días y filtros combinados devuelven el subconjunto exacto (RECEP-1.1)", async () => {
    const app = createApp(testPrisma, { reloj });
    const cookie = await cookieRecepcion(app);
    const c1 = await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "r1a",
    });
    await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T16:00:00.000Z"),
      estadoCita: EstadoCita.PAGADA,
      prefijo: "r1b",
    });
    await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T17:00:00.000Z"),
      estadoCita: EstadoCita.CANCELADA,
      prefijo: "r1c",
    });
    const manana = await crearCitaFixture({
      fechaLima: "2026-07-18",
      inicioUtc: new Date("2026-07-18T15:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "r1d",
    });
    await crearCitaFixture({
      fechaLima: "2026-07-23",
      inicioUtc: new Date("2026-07-23T15:00:00.000Z"),
      estadoCita: EstadoCita.ATENDIDA,
      prefijo: "r1e",
    });
    await crearCitaFixture({
      fechaLima: "2026-07-24",
      inicioUtc: new Date("2026-07-24T15:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "r1f",
    });

    // Act
    const sinFiltros = await request(app)
      .get("/personal/recepcion/agenda")
      .set("Cookie", cookie);
    const combinado = await request(app)
      .get("/personal/recepcion/agenda")
      .query({
        especialidadId: manana.especialidad.id,
        medicoId: manana.medico.id,
        estado: "RESERVADA",
      })
      .set("Cookie", cookie);

    // Assert
    expect(sinFiltros.status).toBe(200);
    expect(sinFiltros.body).toMatchObject({ desde: "2026-07-17", hastaExclusiva: "2026-07-24" });
    expect(sinFiltros.body.items).toHaveLength(5);
    expect(sinFiltros.body.items.map((i: { estado: string }) => i.estado)).toEqual([
      "RESERVADA",
      "PAGADA",
      "CANCELADA", "RESERVADA", "ATENDIDA",
    ]);
    expect(combinado.status).toBe(200);
    expect(combinado.body.items).toHaveLength(1);
    expect(combinado.body.items[0].id).toBe(manana.cita.id);
    expect(combinado.body.items[0].paciente).toHaveProperty("telefono");
  });

  it("filtro sin coincidencias no inventa citas y fecha elegida se rechaza (RECEP-1.2)", async () => {
    // Arrange
    const app = createApp(testPrisma, { reloj });
    const cookie = await cookieRecepcion(app);
    await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "r2",
    });

    // Act
    const otroDia = await request(app)
      .get("/personal/recepcion/agenda")
      .query({ fechaLima: "2026-08-01" })
      .set("Cookie", cookie);
    const sinCoincidencia = await request(app)
      .get("/personal/recepcion/agenda")
      .query({ estado: "ATENDIDA" })
      .set("Cookie", cookie);

    // Assert
    expect(otroDia.status).toBe(400);
    expect(sinCoincidencia.status).toBe(200);
    expect(sinCoincidencia.body.items).toEqual([]);
  });

  it("pago exitoso deja la cita PAGADA y devuelve datos reales (RECEP-2.1)", async () => {
    // Arrange
    const app = createApp(testPrisma, { reloj });
    const cookie = await cookieRecepcion(app);
    const { cita } = await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "pago",
      dni: "12345678",
      telefono: "987654321",
      nombrePaciente: "Rosa Huamán",
    });

    // Act
    const res = await request(app)
      .post(`/personal/recepcion/citas/${cita.id}/pago`)
      .set("Cookie", cookie);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("PAGADA");
    expect(res.body.paciente).toEqual({
      nombre: "Rosa Huamán",
      dni: "12345678",
      telefono: "987654321",
    });
    expect(res.body.medico).toHaveProperty("nombre");
    expect(res.body.especialidad).toHaveProperty("nombre");
    expect(res.body.consultorio).toHaveProperty("codigo");
    expect(res.body.codigoReserva).toMatch(/^SV-/);
    const enBase = await testPrisma.cita.findUniqueOrThrow({ where: { id: cita.id } });
    expect(enBase.estado).toBe(EstadoCita.PAGADA);
  });

  it("estados no permitidos dan 409 y la carrera de doble pago no duplica (RECEP-2.2)", async () => {
    // Arrange
    const app = createApp(testPrisma, { reloj });
    const cookie = await cookieRecepcion(app);
    const noPermitidos = [
      EstadoCita.PAGADA,
      EstadoCita.CANCELADA,
      EstadoCita.ATENDIDA,
      EstadoCita.NO_ASISTIO,
    ];
    const citasNoPermitidas = [];
    for (const estado of noPermitidos) {
      const { cita } = await crearCitaFixture({
        fechaLima: "2026-07-17",
        inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
        estadoCita: estado,
        prefijo: `np-${estado}`,
      });
      citasNoPermitidas.push({ cita, estado });
    }
    const { cita: disputada } = await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T18:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "carrera",
    });

    // Act 1: estados no permitidos
    const respuestasNoPermitidas = [];
    for (const { cita } of citasNoPermitidas) {
      respuestasNoPermitidas.push(
        await request(app)
          .post(`/personal/recepcion/citas/${cita.id}/pago`)
          .set("Cookie", cookie),
      );
    }

    // Act 2: carrera de doble pago sobre la misma cita RESERVADA
    const carrera = await Promise.allSettled([
      request(app)
        .post(`/personal/recepcion/citas/${disputada.id}/pago`)
        .set("Cookie", cookie),
      request(app)
        .post(`/personal/recepcion/citas/${disputada.id}/pago`)
        .set("Cookie", cookie),
    ]);

    // Assert 1: todos 409, sin cambios
    expect(respuestasNoPermitidas.map((r) => r.status)).toEqual([409, 409, 409, 409]);
    for (let i = 0; i < citasNoPermitidas.length; i += 1) {
      const enBase = await testPrisma.cita.findUniqueOrThrow({
        where: { id: citasNoPermitidas[i].cita.id },
      });
      expect(enBase.estado).toBe(citasNoPermitidas[i].estado);
    }

    // Assert 2: exactamente un 200 y un 409, cita PAGADA una sola vez
    const statuses = carrera
      .map((r) => (r.status === "fulfilled" ? r.value.status : 0))
      .sort();
    expect(statuses).toEqual([200, 409]);
    const finalCita = await testPrisma.cita.findUniqueOrThrow({
      where: { id: disputada.id },
    });
    expect(finalCita.estado).toBe(EstadoCita.PAGADA);
  });
});
