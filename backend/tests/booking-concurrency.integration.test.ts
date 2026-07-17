import { randomUUID } from "node:crypto";
import { EstadoSlot } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearFixtureProgramacion, crearFixtureSlots } from "./helpers/fixtures";

const AHORA = new Date("2026-07-17T15:00:00.000Z");
const reloj = () => AHORA;
const CODIGO_EXISTENTE = "SV-ABCDEFGH";
const CODIGO_REGENERADO = "SV-JKMNPQRS";

const paciente = {
  dni: "12345678",
  telefono: "987654321",
  nombre: "Ana Quispe",
};

async function crearSlotsNoFuturos() {
  const fixture = await crearFixtureProgramacion({ prefijo: "frontera-tiempo" });
  return Promise.all(
    [
      new Date("2026-07-17T14:30:00.000Z"),
      new Date("2026-07-17T15:00:00.000Z"),
    ].map((inicioUtc) =>
      testPrisma.slot.create({
        data: {
          programacionSemanalId: fixture.programacion.id,
          inicioUtc,
          finUtc: new Date(inicioUtc.getTime() + 30 * 60 * 1_000),
          fechaLima: new Date("2026-07-17T00:00:00.000Z"),
          estado: EstadoSlot.LIBRE,
        },
      }),
    ),
  );
}

function postReserva(
  app: ReturnType<typeof createApp>,
  key: string,
  body: Record<string, unknown>,
) {
  return request(app).post("/citas").set("Idempotency-Key", key).send(body);
}

describe("reserva concurrente e idempotente", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("regenera la colisión y el replay devuelve la misma cita y código (CITA-2.1)", async () => {
    // Arrange
    const { slots } = await crearFixtureSlots({ cantidad: 2, prefijo: "replay" });
    const appInicial = createApp(testPrisma, {
      reloj,
      generarCodigoReserva: () => CODIGO_EXISTENTE,
    });
    await postReserva(appInicial, randomUUID(), { slotId: slots[0].id, ...paciente });
    const secuencia = [CODIGO_EXISTENTE, CODIGO_REGENERADO];
    const app = createApp(testPrisma, {
      reloj,
      generarCodigoReserva: () => secuencia.shift() ?? CODIGO_REGENERADO,
    });
    const key = randomUUID();
    const payload = { slotId: slots[1].id, ...paciente };

    // Act
    const primera = await postReserva(app, key, payload);
    const replay = await postReserva(app, key, payload);

    // Assert
    expect(primera.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(primera.body.codigoReserva).toBe(CODIGO_REGENERADO);
    expect(replay.body).toEqual(primera.body);
    expect(await testPrisma.cita.count()).toBe(2);
    expect(await testPrisma.paciente.count()).toBe(1);
    expect(await testPrisma.slot.findUnique({ where: { id: slots[1].id } })).toMatchObject({
      estado: EstadoSlot.RESERVADO,
    });
  });

  it("rechaza payload divergente y deja una sola ganadora por slot (CITA-2.2)", async () => {
    // Arrange
    const { slots } = await crearFixtureSlots({ cantidad: 3, prefijo: "carrera" });
    const app = createApp(testPrisma, { reloj });
    const key = randomUUID();
    const original = { slotId: slots[0].id, ...paciente };
    const creada = await postReserva(app, key, original);
    expect(creada.status).toBe(201);
    const antes = {
      citas: await testPrisma.cita.count(),
      pacientes: await testPrisma.paciente.count(),
      slotsReservados: await testPrisma.slot.count({
        where: { estado: EstadoSlot.RESERVADO },
      }),
    };
    const divergentes = [
      { ...original, slotId: slots[1].id },
      { ...original, dni: "87654321" },
      { ...original, telefono: "999888777" },
      { ...original, nombre: "Otro Nombre" },
    ];

    // Act
    const conflictos = [];
    for (const body of divergentes) {
      conflictos.push(await postReserva(app, key, body));
    }
    const slotsNoFuturos = await crearSlotsNoFuturos();
    const rechazosTemporales = await Promise.all(
      slotsNoFuturos.map((slot, indice) =>
        postReserva(app, randomUUID(), {
          slotId: slot.id,
          dni: `7777000${indice}`,
          telefono: `97777000${indice}`,
          nombre: `Paciente Frontera ${indice}`,
        }),
      ),
    );
    const carrera = await Promise.all([
      postReserva(app, randomUUID(), {
        slotId: slots[2].id,
        dni: "11112222",
        telefono: "911111111",
        nombre: "Paciente Uno",
      }),
      postReserva(app, randomUUID(), {
        slotId: slots[2].id,
        dni: "33334444",
        telefono: "922222222",
        nombre: "Paciente Dos",
      }),
    ]);

    // Assert
    expect(conflictos.every(({ status }) => status === 409)).toBe(true);
    expect(
      conflictos.every(
        ({ body }) => body.error.code === "IDEMPOTENCIA_EN_CONFLICTO",
      ),
    ).toBe(true);
    expect(rechazosTemporales.map(({ status }) => status)).toEqual([409, 409]);
    expect(
      rechazosTemporales.every(
        ({ body }) => body.error.code === "SLOT_NO_DISPONIBLE",
      ),
    ).toBe(true);
    expect(
      await testPrisma.slot.count({
        where: {
          id: { in: slotsNoFuturos.map(({ id }) => id) },
          estado: EstadoSlot.LIBRE,
        },
      }),
    ).toBe(2);
    expect({
      citas: await testPrisma.cita.count({ where: { slotId: slots[0].id } }),
      pacientes: await testPrisma.paciente.count({ where: { dni: paciente.dni } }),
      slotsReservados: await testPrisma.slot.count({
        where: { id: { in: [slots[0].id, slots[1].id] }, estado: EstadoSlot.RESERVADO },
      }),
    }).toEqual({ citas: 1, pacientes: 1, slotsReservados: 1 });
    expect(antes).toEqual({ citas: 1, pacientes: 1, slotsReservados: 1 });
    expect(carrera.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(
      carrera.find(({ status }) => status === 409)?.body.error.code,
    ).toBe("SLOT_NO_DISPONIBLE");
    expect(await testPrisma.cita.count({ where: { slotId: slots[2].id } })).toBe(1);
    expect(await testPrisma.paciente.count()).toBe(2);
    expect(await testPrisma.slot.findUnique({ where: { id: slots[2].id } })).toMatchObject({
      estado: EstadoSlot.RESERVADO,
    });
  });
});
