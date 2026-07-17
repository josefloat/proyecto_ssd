import { Turno } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { crearProgramacionSemanal } from "../src/services/programacion-semanal";
import { limpiarDominio, testPrisma } from "./helpers/database";

async function crearMedico(nombre: string, horasSemanales = 8) {
  const especialidad = await testPrisma.especialidad.create({
    data: { nombre: `Especialidad ${nombre}`, duracionCitaMinutos: 30 },
  });
  return testPrisma.medico.create({
    data: { nombre, horasSemanales, especialidadId: especialidad.id },
  });
}

async function crearConsultorio(codigo: string) {
  return testPrisma.consultorio.create({
    data: { codigo, nombre: `Consultorio ${codigo}` },
  });
}

describe("programación semanal", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("permite recursos distintos en la misma franja (PROG-1.1)", async () => {
    // Arrange
    const [medicoA, medicoB, consultorioA, consultorioB] = await Promise.all([
      crearMedico("A", 4),
      crearMedico("B", 4),
      crearConsultorio("A"),
      crearConsultorio("B"),
    ]);

    // Act
    await crearProgramacionSemanal(testPrisma, {
      medicoId: medicoA.id,
      consultorioId: consultorioA.id,
      diaSemana: 1,
      turno: Turno.MANANA,
    });
    await crearProgramacionSemanal(testPrisma, {
      medicoId: medicoB.id,
      consultorioId: consultorioB.id,
      diaSemana: 1,
      turno: Turno.MANANA,
    });

    // Assert
    await expect(testPrisma.programacionSemanal.count()).resolves.toBe(2);
  });

  it("rechaza colisiones de médico y consultorio (PROG-1.2)", async () => {
    // Arrange
    const [medicoA, medicoB, consultorioA, consultorioB] = await Promise.all([
      crearMedico("A"),
      crearMedico("B"),
      crearConsultorio("A"),
      crearConsultorio("B"),
    ]);
    await crearProgramacionSemanal(testPrisma, {
      medicoId: medicoA.id,
      consultorioId: consultorioA.id,
      diaSemana: 2,
      turno: Turno.TARDE,
    });

    // Act / Assert
    await expect(
      crearProgramacionSemanal(testPrisma, {
        medicoId: medicoA.id,
        consultorioId: consultorioB.id,
        diaSemana: 2,
        turno: Turno.TARDE,
      }),
    ).rejects.toMatchObject({ code: "PROGRAMACION_EN_CONFLICTO" });
    await expect(
      crearProgramacionSemanal(testPrisma, {
        medicoId: medicoB.id,
        consultorioId: consultorioA.id,
        diaSemana: 2,
        turno: Turno.TARDE,
      }),
    ).rejects.toMatchObject({ code: "PROGRAMACION_EN_CONFLICTO" });
    await expect(testPrisma.programacionSemanal.count()).resolves.toBe(1);
  });

  it("rechaza día ISO 0 y 8 en PostgreSQL sin filas (PROG-1.3)", async () => {
    // Arrange
    const [medico, consultorio] = await Promise.all([
      crearMedico("ISO"),
      crearConsultorio("ISO"),
    ]);

    // Act / Assert
    for (const diaSemana of [0, 8]) {
      await expect(
        testPrisma.programacionSemanal.create({
          data: {
            medicoId: medico.id,
            consultorioId: consultorio.id,
            diaSemana,
            turno: Turno.MANANA,
          },
        }),
      ).rejects.toThrow();
    }
    await expect(testPrisma.programacionSemanal.count()).resolves.toBe(0);
  });

  it("acepta dos turnos dentro de ocho horas (PROG-2.1)", async () => {
    // Arrange
    const [medico, consultorioA, consultorioB] = await Promise.all([
      crearMedico("Ocho horas", 8),
      crearConsultorio("H1"),
      crearConsultorio("H2"),
    ]);

    // Act
    for (const [diaSemana, consultorioId] of [
      [1, consultorioA.id],
      [2, consultorioB.id],
    ] as const) {
      await crearProgramacionSemanal(testPrisma, {
        medicoId: medico.id,
        consultorioId,
        diaSemana,
        turno: Turno.MANANA,
      });
    }

    // Assert
    await expect(
      testPrisma.programacionSemanal.count({ where: { medicoId: medico.id } }),
    ).resolves.toBe(2);
  });

  it("serializa dos solicitudes que excederían cuatro horas (PROG-2.2)", async () => {
    // Arrange
    const [medico, consultorioA, consultorioB] = await Promise.all([
      crearMedico("Concurrente", 4),
      crearConsultorio("C1"),
      crearConsultorio("C2"),
    ]);

    // Act
    const resultados = await Promise.allSettled([
      crearProgramacionSemanal(testPrisma, {
        medicoId: medico.id,
        consultorioId: consultorioA.id,
        diaSemana: 3,
        turno: Turno.MANANA,
      }),
      crearProgramacionSemanal(testPrisma, {
        medicoId: medico.id,
        consultorioId: consultorioB.id,
        diaSemana: 4,
        turno: Turno.MANANA,
      }),
    ]);

    // Assert
    expect(resultados.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(resultados.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
    const rechazo = resultados.find((item) => item.status === "rejected");
    expect(rechazo).toMatchObject({
      reason: { code: "HORAS_SEMANALES_EXCEDIDAS" },
    });
    await expect(
      testPrisma.programacionSemanal.count({ where: { medicoId: medico.id } }),
    ).resolves.toBe(1);
  });
});
