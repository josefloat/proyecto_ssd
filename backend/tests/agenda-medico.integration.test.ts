import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { EstadoCita, EstadoSlot, RolUsuario } from "@prisma/client";
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

  it("la ventana propia incluye mañana y +6, excluye +7 y otros médicos (MEDICO-1.1)", async () => {
    const app = createApp(testPrisma, { reloj });
    const propia = await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "propia",
    });
    await crearCitaFixture({
      fechaLima: "2026-07-18",
      inicioUtc: new Date("2026-07-18T16:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "ajena",
    });
    const crearPropia = async (fechaLima: string, inicioUtc: string, sufijo: string) => {
      const slot = await testPrisma.slot.create({
        data: {
          programacionSemanalId: propia.programacion.id,
          inicioUtc: new Date(inicioUtc),
          finUtc: new Date(new Date(inicioUtc).getTime() + 30 * 60 * 1_000),
          fechaLima: new Date(`${fechaLima}T00:00:00.000Z`),
          estado: EstadoSlot.RESERVADO,
        },
      });
      const paciente = await testPrisma.paciente.create({
        data: { dni: `9000${sufijo.padStart(4, "0")}`, telefono: "987654321", nombre: `Paciente ${sufijo}` },
      });
      return testPrisma.cita.create({
        data: {
          pacienteId: paciente.id, slotId: slot.id, codigoReserva: `SV-ABCDEF${sufijo}`,
          estado: EstadoCita.RESERVADA, reservadaEn: AHORA,
          venceEn: new Date(AHORA.getTime() + 72 * 60 * 60 * 1_000),
          idempotencyKey: randomUUID(), idempotencyFingerprint: "a".repeat(64),
        },
      });
    };
    const manana = await crearPropia("2026-07-18", "2026-07-18T15:00:00.000Z", "23");
    const dia6 = await crearPropia("2026-07-23", "2026-07-23T15:00:00.000Z", "26");
    await crearPropia("2026-07-24", "2026-07-24T15:00:00.000Z", "27");
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
    expect(res.body).toMatchObject({ desde: "2026-07-17", hastaExclusiva: "2026-07-24" });
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([
      propia.cita.id, manana.id, dia6.id,
    ]);
    expect(res.body.items.every((item: { medico: { id: string } }) => item.medico.id === propia.medico.id)).toBe(true);
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
