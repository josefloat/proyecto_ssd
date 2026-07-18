import { randomUUID } from "node:crypto";
import { EstadoSlot, Turno } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { sumarDias } from "../src/domain/fechas";
import { MotorDisponibilidad } from "../src/services/motor-disponibilidad";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearRevisionBase } from "./helpers/programacion-versionada";

const AHORA_FIJO = new Date("2026-07-17T15:00:00.000Z");
const relojFijo = () => AHORA_FIJO;

async function crearEscenarioDisponibilidad() {
  const [especialidad, otraEspecialidad] = await Promise.all([
    testPrisma.especialidad.create({
      data: { nombre: "Cardiología", duracionCitaMinutos: 60 },
    }),
    testPrisma.especialidad.create({
      data: { nombre: "Pediatría", duracionCitaMinutos: 60 },
    }),
  ]);
  const [medicoA, medicoB, medicoAjeno] = await Promise.all([
    testPrisma.medico.create({
      data: {
        nombre: "Dra. Ana Huamán",
        horasSemanales: 4,
        especialidadId: especialidad.id,
      },
    }),
    testPrisma.medico.create({
      data: {
        nombre: "Dr. Bruno Quispe",
        horasSemanales: 4,
        especialidadId: especialidad.id,
      },
    }),
    testPrisma.medico.create({
      data: {
        nombre: "Dra. Carla Ochoa",
        horasSemanales: 4,
        especialidadId: otraEspecialidad.id,
      },
    }),
  ]);
  const [consultorioA, consultorioB, consultorioC] = await Promise.all([
    testPrisma.consultorio.create({
      data: { codigo: "A-101", nombre: "Consultorio A 101" },
    }),
    testPrisma.consultorio.create({
      data: { codigo: "B-102", nombre: "Consultorio B 102" },
    }),
    testPrisma.consultorio.create({
      data: { codigo: "C-103", nombre: "Consultorio C 103" },
    }),
  ]);
  const [revisionA, revisionB, revisionAjena] = await Promise.all([
    crearRevisionBase(testPrisma, medicoA.id),
    crearRevisionBase(testPrisma, medicoB.id),
    crearRevisionBase(testPrisma, medicoAjeno.id),
  ]);
  await testPrisma.programacionSemanal.createMany({
    data: [
      {
        revisionId: revisionA.id,
        medicoId: medicoA.id,
        consultorioId: consultorioA.id,
        diaSemana: 5,
        turno: Turno.MANANA,
      },
      {
        revisionId: revisionB.id,
        medicoId: medicoB.id,
        consultorioId: consultorioB.id,
        diaSemana: 5,
        turno: Turno.MANANA,
      },
      {
        revisionId: revisionAjena.id,
        medicoId: medicoAjeno.id,
        consultorioId: consultorioC.id,
        diaSemana: 5,
        turno: Turno.MANANA,
      },
    ],
  });
  return { especialidad, otraEspecialidad, medicoA, medicoB, medicoAjeno };
}

describe("GET /disponibilidad", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("devuelve 28 fechas, solo libres y un DTO mínimo ordenado (PUB-3.1)", async () => {
    // Arrange
    const { especialidad, medicoA } = await crearEscenarioDisponibilidad();
    const motor = new MotorDisponibilidad(testPrisma, relojFijo);
    await motor.asegurarHorizonte("2026-07-17");
    const slotsMedico = await testPrisma.slot.findMany({
      where: { programacionSemanal: { medicoId: medicoA.id } },
      orderBy: { inicioUtc: "asc" },
    });
    await testPrisma.$transaction([
      testPrisma.slot.update({
        where: { id: slotsMedico[0].id },
        data: { estado: EstadoSlot.RESERVADO },
      }),
      testPrisma.slot.update({
        where: { id: slotsMedico[1].id },
        data: { estado: EstadoSlot.BLOQUEADO },
      }),
    ]);
    const slotsNoFuturosLibres = await testPrisma.slot.findMany({
      where: {
        estado: EstadoSlot.LIBRE,
        inicioUtc: { lte: AHORA_FIJO },
        programacionSemanal: {
          medico: { especialidadId: especialidad.id },
        },
      },
      select: { id: true, inicioUtc: true },
    });
    expect(slotsNoFuturosLibres).toHaveLength(2);
    const app = createApp(testPrisma, { reloj: relojFijo });

    // Act
    const response = await request(app).get(
      `/disponibilidad?especialidadId=${especialidad.id}`,
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.especialidad).toEqual({
      id: especialidad.id,
      nombre: especialidad.nombre,
    });
    expect(response.body.zonaHoraria).toBe("America/Lima");
    expect(response.body.horizonte).toEqual({
      desde: "2026-07-17",
      hastaExclusiva: "2026-08-14",
      fechas: Array.from({ length: 28 }, (_, indice) =>
        sumarDias("2026-07-17", indice),
      ),
    });
    expect(response.body.items).toHaveLength(28);
    expect(response.body.items.map((item: { id: string }) => item.id)).not.toContain(
      slotsMedico[0].id,
    );
    expect(response.body.items.map((item: { id: string }) => item.id)).not.toContain(
      slotsMedico[1].id,
    );
    const idsPublicados = response.body.items.map((item: { id: string }) => item.id);
    for (const { id } of slotsNoFuturosLibres) {
      expect(idsPublicados).not.toContain(id);
    }
    for (const item of response.body.items) {
      expect(new Date(item.inicioUtc).getTime()).toBeGreaterThan(
        AHORA_FIJO.getTime(),
      );
      expect(Object.keys(item)).toEqual([
        "id",
        "fechaLima",
        "inicioUtc",
        "finUtc",
        "medico",
        "consultorio",
      ]);
      expect(Object.keys(item.medico)).toEqual(["id", "nombre"]);
      expect(Object.keys(item.consultorio)).toEqual(["id", "codigo", "nombre"]);
      expect(item).not.toHaveProperty("estado");
      expect(item).not.toHaveProperty("paciente");
    }
    const clavesOrden = response.body.items.map(
      (item: { fechaLima: string; inicioUtc: string; medico: { nombre: string } }) =>
        `${item.fechaLima}:${item.inicioUtc}:${item.medico.nombre}`,
    );
    expect(clavesOrden).toEqual([...clavesOrden].sort((a, b) => a.localeCompare(b, "es")));
  });

  it("conserva el horizonte completo cuando no existen slots libres (PUB-3.2)", async () => {
    // Arrange
    const especialidad = await testPrisma.especialidad.create({
      data: { nombre: "Dermatología", duracionCitaMinutos: 15 },
    });
    const app = createApp(testPrisma, { reloj: relojFijo });

    // Act
    const response = await request(app).get(
      `/disponibilidad?especialidadId=${especialidad.id}`,
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.horizonte.fechas).toHaveLength(28);
    expect(response.body.horizonte.desde).toBe("2026-07-17");
    expect(response.body.horizonte.hastaExclusiva).toBe("2026-08-14");
  });

  it("filtra todos los slots por el médico válido (PUB-4.1)", async () => {
    // Arrange
    const { especialidad, medicoB } = await crearEscenarioDisponibilidad();
    const app = createApp(testPrisma, { reloj: relojFijo });

    // Act
    const response = await request(app).get(
      `/disponibilidad?especialidadId=${especialidad.id}&medicoId=${medicoB.id}`,
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.horizonte.fechas).toHaveLength(28);
    expect(response.body.items).toHaveLength(14);
    expect(
      response.body.items.every(
        (item: { medico: { id: string } }) => item.medico.id === medicoB.id,
      ),
    ).toBe(true);
  });

  it("responde 400 a query ausente, repetida o malformada (PUB-3.3)", async () => {
    // Arrange
    const app = createApp(testPrisma, { reloj: relojFijo });

    // Act
    const responses = await Promise.all([
      request(app).get("/disponibilidad"),
      request(app).get(
        `/disponibilidad?especialidadId=${randomUUID()}&especialidadId=${randomUUID()}`,
      ),
      request(app).get("/disponibilidad?especialidadId=no-uuid"),
    ]);

    // Assert
    expect(responses.map(({ status }) => status)).toEqual([400, 400, 400]);
    expect(
      responses.every(({ body }) => body.error.code === "QUERY_INVALIDA"),
    ).toBe(true);
  });

  it("distingue recursos inexistentes y relación incompatible (PUB-4.2)", async () => {
    // Arrange
    const { especialidad, medicoAjeno } = await crearEscenarioDisponibilidad();
    const app = createApp(testPrisma, { reloj: relojFijo });

    // Act
    const especialidadInexistente = await request(app).get(
      `/disponibilidad?especialidadId=${randomUUID()}`,
    );
    const medicoInexistente = await request(app).get(
      `/disponibilidad?especialidadId=${especialidad.id}&medicoId=${randomUUID()}`,
    );
    const incompatible = await request(app).get(
      `/disponibilidad?especialidadId=${especialidad.id}&medicoId=${medicoAjeno.id}`,
    );

    // Assert
    expect(especialidadInexistente.status).toBe(404);
    expect(medicoInexistente.status).toBe(404);
    expect(incompatible.status).toBe(422);
    expect(incompatible.body.error.code).toBe(
      "MEDICO_NO_PERTENECE_ESPECIALIDAD",
    );
    for (const response of [especialidadInexistente, medicoInexistente, incompatible]) {
      expect(response.body).not.toHaveProperty("items");
    }
  });
});
