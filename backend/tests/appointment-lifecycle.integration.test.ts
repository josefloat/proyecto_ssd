import { randomUUID } from "node:crypto";
import {
  EstadoCita,
  EstadoSlot,
  MotivoCancelacion,
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { validarCredencialesCita } from "../src/domain/citas";
import { crearServiciosCitasPaciente } from "../src/services/citas-paciente";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearFixtureSlots } from "./helpers/fixtures";

const INICIO = new Date("2026-07-17T15:00:00.000Z");

async function reservar(
  app: ReturnType<typeof createApp>,
  slotId: string,
  datos?: Partial<{ dni: string; telefono: string; nombre: string }>,
) {
  return request(app)
    .post("/citas")
    .set("Idempotency-Key", randomUUID())
    .send({
      slotId,
      dni: datos?.dni ?? "12345678",
      telefono: datos?.telefono ?? "987654321",
      nombre: datos?.nombre ?? "Ana Quispe",
    });
}

describe("cancelación y expiración", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("cancela de forma atómica e idempotente conservando historia (CITA-4.1)", async () => {
    // Arrange
    let ahora = INICIO;
    const { slots } = await crearFixtureSlots({ cantidad: 1, prefijo: "cancelar" });
    const app = createApp(testPrisma, { reloj: () => ahora });
    const creada = await reservar(app, slots[0].id);
    ahora = new Date(INICIO.getTime() + 15 * 60 * 1_000);
    const credenciales = {
      dni: "12345678",
      codigoReserva: creada.body.codigoReserva,
    };

    // Act
    const primera = await request(app).post("/citas/cancelacion").send(credenciales);
    const replay = await request(app).post("/citas/cancelacion").send(credenciales);

    // Assert
    expect([primera.status, replay.status]).toEqual([200, 200]);
    expect(replay.body).toEqual(primera.body);
    expect(primera.body).toMatchObject({
      estado: EstadoCita.CANCELADA,
      motivoCancelacion: MotivoCancelacion.PACIENTE,
    });
    expect(await testPrisma.cita.count()).toBe(1);
    expect(await testPrisma.slot.findUnique({ where: { id: slots[0].id } })).toMatchObject({
      estado: EstadoSlot.LIBRE,
    });
  });

  it("respeta el límite, excluye estados y serializa la carrera (CITA-4.2)", async () => {
    // Arrange: frontera exacta de 72 horas
    let ahora = INICIO;
    const frontera = await crearFixtureSlots({ cantidad: 1, prefijo: "frontera" });
    const app = createApp(testPrisma, {
      reloj: () => ahora,
      generarCodigoReserva: () => "SV-GGGGGGG8",
    });
    const creada = await reservar(app, frontera.slots[0].id);
    const venceEn = new Date(creada.body.venceEn);

    // Act + Assert: un milisegundo antes no expira
    ahora = new Date(venceEn.getTime() - 1);
    const antes = await request(app).post("/citas/consulta").send({
      dni: "12345678",
      codigoReserva: creada.body.codigoReserva,
    });
    expect(antes.body.estado).toBe(EstadoCita.RESERVADA);

    // Act + Assert: exactamente en el límite expira y libera
    ahora = venceEn;
    const enLimite = await request(app).post("/citas/consulta").send({
      dni: "12345678",
      codigoReserva: creada.body.codigoReserva,
    });
    expect(enLimite.body).toMatchObject({
      estado: EstadoCita.CANCELADA,
      motivoCancelacion: MotivoCancelacion.EXPIRACION,
    });
    expect(
      await testPrisma.slot.findUnique({ where: { id: frontera.slots[0].id } }),
    ).toMatchObject({ estado: EstadoSlot.LIBRE });

    // Arrange + Act: estados no permitidos quedan intactos
    const estados = [EstadoCita.PAGADA, EstadoCita.ATENDIDA, EstadoCita.NO_ASISTIO];
    const noPermitidos = await crearFixtureSlots({
      cantidad: estados.length,
      prefijo: "estados",
    });
    const codigos = ["SV-HHHHHHH9", "SV-JJJJJJJA", "SV-KKKKKKKB"];
    const respuestas = [];
    for (let indice = 0; indice < estados.length; indice += 1) {
      const dni = `4444000${indice}`;
      const paciente = await testPrisma.paciente.create({
        data: { dni, telefono: `94444000${indice}`, nombre: `Paciente ${indice}` },
      });
      await testPrisma.slot.update({
        where: { id: noPermitidos.slots[indice].id },
        data: { estado: EstadoSlot.RESERVADO },
      });
      await testPrisma.cita.create({
        data: {
          pacienteId: paciente.id,
          slotId: noPermitidos.slots[indice].id,
          codigoReserva: codigos[indice],
          estado: estados[indice],
          reservadaEn: ahora,
          venceEn: new Date(ahora.getTime() + 72 * 60 * 60 * 1_000),
          idempotencyKey: randomUUID(),
          idempotencyFingerprint: "a".repeat(64),
        },
      });
      respuestas.push(
        await request(app).post("/citas/cancelacion").send({
          dni,
          codigoReserva: codigos[indice],
        }),
      );
    }
    expect(respuestas.map(({ status }) => status)).toEqual([409, 409, 409]);
    expect(
      respuestas.every(({ body }) => body.error.code === "CITA_NO_CANCELABLE"),
    ).toBe(true);
    expect(
      await testPrisma.slot.count({
        where: {
          id: { in: noPermitidos.slots.map(({ id }) => id) },
          estado: EstadoSlot.RESERVADO,
        },
      }),
    ).toBe(3);

    // Arrange + Act: carrera en el límite, una sola transición efectiva
    ahora = INICIO;
    const carreraFixture = await crearFixtureSlots({ cantidad: 1, prefijo: "race-life" });
    const raceApp = createApp(testPrisma, {
      reloj: () => ahora,
      generarCodigoReserva: () => "SV-MMMMMMMC",
    });
    const carreraCita = await reservar(raceApp, carreraFixture.slots[0].id, {
      dni: "55556666",
      telefono: "955556666",
      nombre: "Paciente Carrera",
    });
    ahora = new Date(carreraCita.body.venceEn);
    const servicios = crearServiciosCitasPaciente(testPrisma, () => ahora);
    const credenciales = validarCredencialesCita({
      dni: "55556666",
      codigoReserva: carreraCita.body.codigoReserva,
    });
    await Promise.allSettled([
      servicios.cancelar(credenciales),
      servicios.aplicarExpiraciones(),
    ]);

    const final = await testPrisma.cita.findUnique({
      where: { id: carreraCita.body.id },
    });
    expect(final).toMatchObject({
      estado: EstadoCita.CANCELADA,
      motivoCancelacion: MotivoCancelacion.EXPIRACION,
    });
    expect(await testPrisma.cita.count({ where: { id: carreraCita.body.id } })).toBe(1);
    expect(
      await testPrisma.slot.findUnique({ where: { id: carreraFixture.slots[0].id } }),
    ).toMatchObject({ estado: EstadoSlot.LIBRE });
  });
});
