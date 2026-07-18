import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { EstadoCita, RolUsuario } from "@prisma/client";
import { createApp } from "../src/app";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearCitaFixture, crearUsuario } from "./helpers/personal-fixtures";

const AHORA = new Date("2026-07-17T14:00:00.000Z"); // 09:00 Lima → hoy = 2026-07-17
const reloj = () => AHORA;
const PASSWORD = "Medico-Clave-123";

function valorCookie(res: request.Response): string {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  const objetivo = (cookies ?? []).find((c) =>
    c.startsWith("sdv_personal_session="),
  );
  return (objetivo ?? "").split(";")[0];
}

describe("agenda diaria del médico, solo lectura", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("el médico ve exactamente su propia agenda del día (MEDICO-1.1)", async () => {
    // Arrange: citas del día de dos médicos distintos
    const app = createApp(testPrisma, { reloj });
    const propia = await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "propia",
    });
    await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T16:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "ajena",
    });
    const usuarioMedico = await crearUsuario({
      rol: RolUsuario.MEDICO,
      password: PASSWORD,
      email: "medico-propio@senaldevida.pe",
      medicoId: propia.medico.id,
    });
    const login = await request(app)
      .post("/personal/sesion")
      .send({ email: usuarioMedico.email, password: PASSWORD });
    const cookie = valorCookie(login);

    // Act
    const res = await request(app)
      .get("/personal/medico/agenda")
      .set("Cookie", cookie);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(propia.cita.id);
    expect(res.body.items[0].medico.id).toBe(propia.medico.id);
  });

  it("ninguna acción de escritura es alcanzable para el rol médico (MEDICO-1.2)", async () => {
    // Arrange
    const app = createApp(testPrisma, { reloj });
    const propia = await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "medescr",
    });
    const usuarioMedico = await crearUsuario({
      rol: RolUsuario.MEDICO,
      password: PASSWORD,
      email: "medico-escr@senaldevida.pe",
      medicoId: propia.medico.id,
    });
    const login = await request(app)
      .post("/personal/sesion")
      .send({ email: usuarioMedico.email, password: PASSWORD });
    const cookie = valorCookie(login);

    // Act: el médico intenta la escritura de recepción sobre su propia cita
    const pago = await request(app)
      .post(`/personal/recepcion/citas/${propia.cita.id}/pago`)
      .set("Cookie", cookie);

    // Assert: 403 y sin cambio de estado
    expect(pago.status).toBe(403);
    const enBase = await testPrisma.cita.findUniqueOrThrow({
      where: { id: propia.cita.id },
    });
    expect(enBase.estado).toBe(EstadoCita.RESERVADA);
  });
});
