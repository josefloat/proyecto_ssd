import { EstadoSlot } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MotorDisponibilidad } from "../src/services/motor-disponibilidad";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearFixtureProgramacion } from "./helpers/fixtures";

describe("bloqueo de slots concretos", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("bloquea concurrente e idempotentemente sin modificar la programación (SLOT-4.1)", async () => {
    // Arrange
    const { programacion } = await crearFixtureProgramacion({
      duracionCitaMinutos: 60,
      diaSemana: 5,
    });
    const motor = new MotorDisponibilidad(testPrisma);
    await motor.asegurarHorizonte("2026-07-17");
    const slot = await testPrisma.slot.findFirstOrThrow();
    const programacionAntes = await testPrisma.programacionSemanal.findUniqueOrThrow({
      where: { id: programacion.id },
    });

    // Act
    const resultados = await Promise.all([
      motor.bloquearSlot(slot.id),
      motor.bloquearSlot(slot.id),
    ]);
    const repeticion = await motor.bloquearSlot(slot.id);
    const slotDespues = await testPrisma.slot.findUniqueOrThrow({
      where: { id: slot.id },
    });
    const programacionDespues = await testPrisma.programacionSemanal.findUniqueOrThrow({
      where: { id: programacion.id },
    });

    // Assert
    expect(resultados).toEqual([
      EstadoSlot.BLOQUEADO,
      EstadoSlot.BLOQUEADO,
    ]);
    expect(repeticion).toBe(EstadoSlot.BLOQUEADO);
    expect(slotDespues.estado).toBe(EstadoSlot.BLOQUEADO);
    expect(programacionDespues).toEqual(programacionAntes);
  });

  it("rechaza bloquear un slot reservado y conserva su estado (SLOT-4.2)", async () => {
    // Arrange
    await crearFixtureProgramacion({ duracionCitaMinutos: 60, diaSemana: 5 });
    const motor = new MotorDisponibilidad(testPrisma);
    await motor.asegurarHorizonte("2026-07-17");
    const slot = await testPrisma.slot.findFirstOrThrow();
    await testPrisma.slot.update({
      where: { id: slot.id },
      data: { estado: EstadoSlot.RESERVADO },
    });

    // Act
    const bloquear = motor.bloquearSlot(slot.id);

    // Assert
    await expect(bloquear).rejects.toMatchObject({
      code: "SLOT_RESERVADO_EN_CONFLICTO",
    });
    await expect(
      testPrisma.slot.findUniqueOrThrow({ where: { id: slot.id } }),
    ).resolves.toMatchObject({ estado: EstadoSlot.RESERVADO });
  });
});
