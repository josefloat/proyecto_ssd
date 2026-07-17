import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearFixtureSlots } from "./helpers/fixtures";

const AHORA = new Date("2026-07-17T15:00:00.000Z");
const reloj = () => AHORA;

async function reservar(
  app: ReturnType<typeof createApp>,
  slotId: string,
  dni: string,
  telefono: string,
  nombre: string,
) {
  return request(app)
    .post("/citas")
    .set("Idempotency-Key", randomUUID())
    .send({ slotId, dni, telefono, nombre });
}

describe("consulta privada de cita", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("devuelve solo el detalle del par correcto en estados visibles (CITA-3.1)", async () => {
    // Arrange
    const { slots } = await crearFixtureSlots({ cantidad: 2, prefijo: "consulta" });
    const codigos = ["SV-AAAAAAA2", "SV-BBBBBBB3"];
    const app = createApp(testPrisma, {
      reloj,
      generarCodigoReserva: () => codigos.shift() ?? "SV-CCCCCCC4",
    });
    const reservada = await reservar(
      app,
      slots[0].id,
      "12345678",
      "987654321",
      "Ana Quispe",
    );
    const otra = await reservar(
      app,
      slots[1].id,
      "87654321",
      "976543210",
      "Luis Huamán",
    );
    await request(app).post("/citas/cancelacion").send({
      dni: "87654321",
      codigoReserva: otra.body.codigoReserva,
    });

    // Act
    const respuestas = await Promise.all([
      request(app).post("/citas/consulta").send({
        dni: "12345678",
        codigoReserva: reservada.body.codigoReserva.toLowerCase().replace("-", " "),
      }),
      request(app).post("/citas/consulta").send({
        dni: "87654321",
        codigoReserva: otra.body.codigoReserva,
      }),
    ]);

    // Assert
    expect(respuestas.map(({ status }) => status)).toEqual([200, 200]);
    expect(respuestas.map(({ body }) => body.estado)).toEqual([
      "RESERVADA",
      "CANCELADA",
    ]);
    expect(respuestas[0].body.codigoReserva).toBe(reservada.body.codigoReserva);
    expect(respuestas[0].body.paciente).toEqual({ nombre: "Ana Quispe" });
    expect(respuestas[1].body.paciente).toEqual({ nombre: "Luis Huamán" });
    for (const { body } of respuestas) {
      expect(Object.keys(body)).toEqual([
        "id",
        "codigoReserva",
        "estado",
        "motivoCancelacion",
        "reservadaEn",
        "venceEn",
        "canceladaEn",
        "paciente",
        "slot",
      ]);
      expect(body).not.toHaveProperty("telefono");
      expect(body.paciente).not.toHaveProperty("id");
    }
  });

  it("parametriza entradas inválidas y coincidencias parciales sin revelar existencia (CITA-3.2)", async () => {
    // Arrange
    const { slots } = await crearFixtureSlots({ cantidad: 1, prefijo: "privacidad" });
    const app = createApp(testPrisma, {
      reloj,
      generarCodigoReserva: () => "SV-DDDDDDD5",
    });
    const creada = await reservar(
      app,
      slots[0].id,
      "12345678",
      "987654321",
      "Ana Quispe",
    );
    const invalidos = [
      { dni: "1234567", codigoReserva: creada.body.codigoReserva },
      { dni: "12345678", codigoReserva: "codigo-malo" },
      { dni: "12345678", codigoReserva: creada.body.codigoReserva, extra: true },
    ];
    const parciales = [
      { dni: "87654321", codigoReserva: creada.body.codigoReserva },
      { dni: "12345678", codigoReserva: "SV-EEEEEEE6" },
      { dni: "87654321", codigoReserva: "SV-FFFFFFF7" },
    ];

    // Act
    const respuestasInvalidas = [];
    for (const body of invalidos) {
      respuestasInvalidas.push(await request(app).post("/citas/consulta").send(body));
    }
    const respuestasParciales = [];
    for (const body of parciales) {
      respuestasParciales.push(await request(app).post("/citas/consulta").send(body));
    }

    // Assert
    expect(respuestasInvalidas.map(({ status }) => status)).toEqual([400, 400, 400]);
    expect(
      respuestasInvalidas.every(({ body }) => body.error.code === "QUERY_INVALIDA"),
    ).toBe(true);
    expect(respuestasParciales.map(({ status }) => status)).toEqual([404, 404, 404]);
    const cuerpos = respuestasParciales.map(({ body }) => body);
    expect(new Set(cuerpos.map((body) => JSON.stringify(body))).size).toBe(1);
    expect(cuerpos[0]).toEqual({
      error: {
        code: "CITA_NO_ENCONTRADA",
        message: "No encontramos una cita con esos datos.",
      },
    });
  });
});
