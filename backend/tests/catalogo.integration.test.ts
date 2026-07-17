import { randomUUID } from "node:crypto";
import { Turno } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { limpiarDominio, testPrisma } from "./helpers/database";

describe("persistencia de catálogos", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("relaciona un médico válido con su especialidad y horas (CAT-2.1)", async () => {
    // Arrange
    const especialidad = await testPrisma.especialidad.create({
      data: { nombre: "Prueba", duracionCitaMinutos: 25 },
    });

    // Act
    const medico = await testPrisma.medico.create({
      data: {
        nombre: "Médico de prueba",
        horasSemanales: 8,
        especialidadId: especialidad.id,
      },
      include: { especialidad: true },
    });

    // Assert
    expect(medico.horasSemanales).toBe(8);
    expect(medico.especialidad.id).toBe(especialidad.id);
  });

  it("rechaza horas no positivas y especialidad inexistente (CAT-2.2)", async () => {
    // Arrange
    const especialidad = await testPrisma.especialidad.create({
      data: { nombre: "Prueba", duracionCitaMinutos: 25 },
    });

    // Act / Assert
    await expect(
      testPrisma.medico.create({
        data: {
          nombre: "Sin horas",
          horasSemanales: 0,
          especialidadId: especialidad.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      testPrisma.medico.create({
        data: {
          nombre: "Sin especialidad",
          horasSemanales: 4,
          especialidadId: randomUUID(),
        },
      }),
    ).rejects.toThrow();
    await expect(testPrisma.medico.count()).resolves.toBe(0);
  });

  it("rechaza consultorio duplicado y turno fuera del enum (CAT-3.2)", async () => {
    // Arrange
    const especialidad = await testPrisma.especialidad.create({
      data: { nombre: "Prueba", duracionCitaMinutos: 25 },
    });
    const medico = await testPrisma.medico.create({
      data: {
        nombre: "Médico",
        horasSemanales: 4,
        especialidadId: especialidad.id,
      },
    });
    const consultorio = await testPrisma.consultorio.create({
      data: { codigo: "C-101", nombre: "Consultorio 101" },
    });

    // Act / Assert
    await expect(
      testPrisma.consultorio.create({
        data: { codigo: "C-101", nombre: "Duplicado" },
      }),
    ).rejects.toThrow();
    await expect(
      testPrisma.$executeRaw`
        INSERT INTO "ProgramacionSemanal"
          ("id", "medicoId", "consultorioId", "diaSemana", "turno")
        VALUES
          (${randomUUID()}::uuid, ${medico.id}::uuid, ${consultorio.id}::uuid,
           1, CAST(${"MADRUGADA"} AS "Turno"))
      `,
    ).rejects.toThrow();
    await expect(testPrisma.programacionSemanal.count()).resolves.toBe(0);
    expect(Object.values(Turno)).not.toContain("MADRUGADA");
  });
});
