import { EstadoSlot, Turno } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MotorDisponibilidad } from "../src/services/motor-disponibilidad";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearRevisionBase } from "./helpers/programacion-versionada";

async function crearDosMedicosMismaEspecialidad() {
  const especialidad = await testPrisma.especialidad.create({
    data: { nombre: "Consulta interna", duracionCitaMinutos: 60 },
  });
  const [medicoA, medicoB, medicoC, consultorioA, consultorioB, consultorioC] = await Promise.all([
    testPrisma.medico.create({
      data: {
        nombre: "Ana Médica",
        horasSemanales: 8,
        especialidadId: especialidad.id,
      },
    }),
    testPrisma.medico.create({
      data: {
        nombre: "Bruno Médico",
        horasSemanales: 8,
        especialidadId: especialidad.id,
      },
    }),
    testPrisma.medico.create({
      data: {
        nombre: "Carla Nocturna",
        horasSemanales: 8,
        especialidadId: especialidad.id,
      },
    }),
    testPrisma.consultorio.create({
      data: { codigo: "QA-1", nombre: "Consultorio QA 1" },
    }),
    testPrisma.consultorio.create({
      data: { codigo: "QA-2", nombre: "Consultorio QA 2" },
    }),
    testPrisma.consultorio.create({
      data: { codigo: "QA-3", nombre: "Consultorio QA 3" },
    }),
  ]);
  const [revisionA, revisionB, revisionC] = await Promise.all([
    crearRevisionBase(testPrisma, medicoA.id),
    crearRevisionBase(testPrisma, medicoB.id),
    crearRevisionBase(testPrisma, medicoC.id),
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
        revisionId: revisionC.id,
        medicoId: medicoC.id,
        consultorioId: consultorioC.id,
        diaSemana: 5,
        turno: Turno.NOCHE,
      },
    ],
  });
  return { especialidad, medicoA, medicoB, medicoC };
}

describe("consulta interna materializada", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("filtra LIBRE por fecha civil, especialidad y médico opcional en orden estable (SLOT-5.1)", async () => {
    // Arrange
    const { especialidad, medicoA, medicoB, medicoC } =
      await crearDosMedicosMismaEspecialidad();
    const motor = new MotorDisponibilidad(testPrisma);
    await motor.asegurarHorizonte("2026-07-17");
    const slotsA = await testPrisma.slot.findMany({
      where: { programacionSemanal: { medicoId: medicoA.id } },
      orderBy: { inicioUtc: "asc" },
    });
    await testPrisma.slot.update({
      where: { id: slotsA[0].id },
      data: { estado: EstadoSlot.BLOQUEADO },
    });
    await testPrisma.slot.update({
      where: { id: slotsA[1].id },
      data: { estado: EstadoSlot.RESERVADO },
    });

    // Act
    const todos = await motor.consultarDisponibilidad({
      especialidadId: especialidad.id,
      fechaLima: "2026-07-17",
    });
    const soloMedicoA = await motor.consultarDisponibilidad({
      especialidadId: especialidad.id,
      medicoId: medicoA.id,
      fechaLima: "2026-07-17",
    });

    // Assert
    expect(todos).toHaveLength(10);
    expect(todos.every((slot) => slot.fechaLima === "2026-07-17")).toBe(true);
    expect(todos.every((slot) => slot.estado === EstadoSlot.LIBRE)).toBe(true);
    expect(new Set(todos.map((slot) => slot.medico.id))).toEqual(
      new Set([medicoA.id, medicoB.id, medicoC.id]),
    );
    expect(
      todos.map((slot) => [slot.inicioUtc.toISOString(), slot.medico.nombre]),
    ).toEqual([
      ["2026-07-17T14:00:00.000Z", "Bruno Médico"],
      ["2026-07-17T15:00:00.000Z", "Bruno Médico"],
      ["2026-07-17T16:00:00.000Z", "Ana Médica"],
      ["2026-07-17T16:00:00.000Z", "Bruno Médico"],
      ["2026-07-17T17:00:00.000Z", "Ana Médica"],
      ["2026-07-17T17:00:00.000Z", "Bruno Médico"],
      ["2026-07-18T00:00:00.000Z", "Carla Nocturna"],
      ["2026-07-18T01:00:00.000Z", "Carla Nocturna"],
      ["2026-07-18T02:00:00.000Z", "Carla Nocturna"],
      ["2026-07-18T03:00:00.000Z", "Carla Nocturna"],
    ]);
    expect(soloMedicoA).toHaveLength(2);
    expect(soloMedicoA.every((slot) => slot.medico.id === medicoA.id)).toBe(true);
    expect(soloMedicoA.map((slot) => slot.inicioUtc.toISOString())).toEqual([
      "2026-07-17T16:00:00.000Z",
      "2026-07-17T17:00:00.000Z",
    ]);
  });
});
