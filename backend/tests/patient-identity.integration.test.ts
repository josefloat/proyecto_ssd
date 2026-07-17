import { randomUUID } from "node:crypto";
import { EstadoSlot } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearFixtureSlots } from "./helpers/fixtures";

const AHORA = new Date("2026-07-17T15:00:00.000Z");
const reloj = () => AHORA;

function confirmar(
  app: ReturnType<typeof createApp>,
  body: Record<string, unknown>,
) {
  return request(app)
    .post("/citas")
    .set("Idempotency-Key", randomUUID())
    .send(body);
}

describe("identidad mínima del paciente", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("crea por DNI, reutiliza sin sobrescribir y permite teléfono compartido (CITA-1.1)", async () => {
    // Arrange
    const { slots } = await crearFixtureSlots({ cantidad: 3, prefijo: "identidad" });
    const app = createApp(testPrisma, { reloj });

    // Act
    const primera = await confirmar(app, {
      slotId: slots[0].id,
      dni: "12345678",
      telefono: "987 654 321",
      nombre: "  Ana   Quispe  ",
    });
    const segunda = await confirmar(app, {
      slotId: slots[1].id,
      dni: "12345678",
      telefono: "987-654-321",
      nombre: "Nombre que no reemplaza el original",
    });
    const telefonoCompartido = await confirmar(app, {
      slotId: slots[2].id,
      dni: "87654321",
      telefono: "987654321",
      nombre: "Luis Huamán",
    });

    // Assert
    expect([primera.status, segunda.status, telefonoCompartido.status]).toEqual([
      201, 201, 201,
    ]);
    expect(await testPrisma.paciente.count()).toBe(2);
    expect(await testPrisma.cita.count()).toBe(3);
    const paciente = await testPrisma.paciente.findUnique({
      where: { dni: "12345678" },
      include: { citas: true },
    });
    expect(paciente).toMatchObject({
      telefono: "987654321",
      nombre: "Ana Quispe",
    });
    expect(paciente?.citas).toHaveLength(2);
    expect(
      await testPrisma.slot.count({ where: { estado: EstadoSlot.RESERVADO } }),
    ).toBe(3);
  });

  it("rechaza validaciones equivalentes y teléfono incompatible sin writes (CITA-1.2)", async () => {
    // Arrange
    const { slots } = await crearFixtureSlots({ cantidad: 1, prefijo: "invalido" });
    const app = createApp(testPrisma, { reloj });
    const base = {
      slotId: slots[0].id,
      dni: "12345678",
      telefono: "987654321",
      nombre: "Ana Quispe",
    };
    const invalidos = [
      { ...base, dni: "1234567" },
      { ...base, telefono: "98765432" },
      { ...base, nombre: "   " },
      { ...base, extra: "no permitido" },
    ];

    // Act
    const respuestas = [];
    for (const body of invalidos) {
      respuestas.push(await confirmar(app, body));
    }
    await testPrisma.paciente.create({
      data: { dni: "12345678", telefono: "999888777", nombre: "Ana Original" },
    });
    const incompatible = await confirmar(app, base);

    // Assert
    expect(respuestas.map(({ status }) => status)).toEqual([400, 400, 400, 400]);
    expect(respuestas.every(({ body }) => body.error.code === "QUERY_INVALIDA")).toBe(
      true,
    );
    expect(incompatible.status).toBe(409);
    expect(incompatible.body.error.code).toBe("DATOS_PACIENTE_NO_COINCIDEN");
    expect(await testPrisma.cita.count()).toBe(0);
    expect(await testPrisma.paciente.count()).toBe(1);
    expect(await testPrisma.slot.findUnique({ where: { id: slots[0].id } })).toMatchObject({
      estado: EstadoSlot.LIBRE,
    });
    expect(await testPrisma.paciente.findUnique({ where: { dni: "12345678" } })).toMatchObject({
      telefono: "999888777",
      nombre: "Ana Original",
    });
  });
});
