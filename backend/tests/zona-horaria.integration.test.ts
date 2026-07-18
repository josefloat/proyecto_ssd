import { Turno } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MotorDisponibilidad } from "../src/services/motor-disponibilidad";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearRevisionBase } from "./helpers/programacion-versionada";

async function crearProgramacionNoche() {
  const especialidad = await testPrisma.especialidad.create({
    data: { nombre: "Zona horaria", duracionCitaMinutos: 30 },
  });
  const medico = await testPrisma.medico.create({
    data: {
      nombre: "Médico nocturno",
      horasSemanales: 4,
      especialidadId: especialidad.id,
    },
  });
  const consultorio = await testPrisma.consultorio.create({
    data: { codigo: "NOCHE", nombre: "Consultorio nocturno" },
  });
  const revision = await crearRevisionBase(testPrisma, medico.id);
  return testPrisma.programacionSemanal.create({
    data: {
      revisionId: revision.id,
      medicoId: medico.id,
      consultorioId: consultorio.id,
      diaSemana: 5,
      turno: Turno.NOCHE,
    },
  });
}

describe("coherencia de fecha Lima", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("rechaza una fechaLima forjada que no corresponde a inicioUtc (SLOT-3.2)", async () => {
    // Arrange
    const programacion = await crearProgramacionNoche();

    // Act
    const insertar = testPrisma.slot.create({
      data: {
        programacionSemanalId: programacion.id,
        inicioUtc: new Date("2026-07-18T00:00:00.000Z"),
        finUtc: new Date("2026-07-18T00:30:00.000Z"),
        fechaLima: new Date("2026-07-18T00:00:00.000Z"),
      },
    });

    // Assert
    await expect(insertar).rejects.toThrow();
    await expect(testPrisma.slot.count()).resolves.toBe(0);
  });

  it("persiste 19:00 Lima a las 00:00Z del día siguiente sin cambiar fechaLima (SLOT-3.1)", async () => {
    // Arrange
    await crearProgramacionNoche();
    const motor = new MotorDisponibilidad(testPrisma);

    // Act
    await motor.asegurarHorizonte("2026-07-17");
    const primerSlot = await testPrisma.slot.findFirstOrThrow({
      orderBy: { inicioUtc: "asc" },
    });

    // Assert
    expect(primerSlot.inicioUtc).toEqual(
      new Date("2026-07-18T00:00:00.000Z"),
    );
    expect(primerSlot.fechaLima.toISOString().slice(0, 10)).toBe(
      "2026-07-17",
    );
  });
});
