import { EstadoSlot, Turno } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { crearIntervalosTurno } from "../src/domain/intervalos";
import { MotorDisponibilidad } from "../src/services/motor-disponibilidad";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearFixtureProgramacion } from "./helpers/fixtures";

describe("generación materializada del horizonte", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("llena todas las fechas programadas de [ancla, ancla + 28) desde una base vacía (SLOT-1.1)", async () => {
    // Arrange
    await crearFixtureProgramacion({ duracionCitaMinutos: 60, diaSemana: 5 });
    const motor = new MotorDisponibilidad(testPrisma);

    // Act
    const resultado = await motor.asegurarHorizonte("2026-07-17");
    const slots = await testPrisma.slot.findMany({
      orderBy: [{ fechaLima: "asc" }, { inicioUtc: "asc" }],
    });

    // Assert
    expect(resultado).toEqual({
      desde: "2026-07-17",
      hastaExclusiva: "2026-08-14",
      considerados: 16,
      insertados: 16,
    });
    expect(slots).toHaveLength(16);
    expect([...new Set(slots.map((slot) => slot.fechaLima.toISOString().slice(0, 10)))]).toEqual([
      "2026-07-17",
      "2026-07-24",
      "2026-07-31",
      "2026-08-07",
    ]);
  });

  it("persiste el conteo y los instantes exactos sin slot parcial (SLOT-1.3)", async () => {
    // Arrange
    await crearFixtureProgramacion({ duracionCitaMinutos: 25, diaSemana: 5 });
    const motor = new MotorDisponibilidad(testPrisma);

    // Act
    await motor.asegurarHorizonte("2026-07-17");
    const slotsDelAncla = await testPrisma.slot.findMany({
      where: { fechaLima: new Date("2026-07-17T00:00:00.000Z") },
      orderBy: { inicioUtc: "asc" },
    });

    // Assert
    expect(slotsDelAncla).toHaveLength(9);
    expect(slotsDelAncla[0].inicioUtc).toEqual(
      new Date("2026-07-17T14:00:00.000Z"),
    );
    expect(slotsDelAncla[0].finUtc).toEqual(
      new Date("2026-07-17T14:25:00.000Z"),
    );
    expect(slotsDelAncla.at(-1)?.inicioUtc).toEqual(
      new Date("2026-07-17T17:20:00.000Z"),
    );
    expect(slotsDelAncla.at(-1)?.finUtc).toEqual(
      new Date("2026-07-17T17:45:00.000Z"),
    );
  });

  it("serializa generaciones concurrentes y conserva claves y estados existentes (SLOT-2.1)", async () => {
    // Arrange
    await crearFixtureProgramacion({ duracionCitaMinutos: 60, diaSemana: 5 });
    const motor = new MotorDisponibilidad(testPrisma);

    // Act
    const resultados = await Promise.all([
      motor.asegurarHorizonte("2026-07-17"),
      motor.asegurarHorizonte("2026-07-17"),
    ]);
    const primerSlot = await testPrisma.slot.findFirstOrThrow({
      orderBy: { inicioUtc: "asc" },
    });
    await testPrisma.slot.update({
      where: { id: primerSlot.id },
      data: { estado: EstadoSlot.BLOQUEADO },
    });
    const repeticion = await motor.asegurarHorizonte("2026-07-17");
    const slots = await testPrisma.slot.findMany();

    // Assert
    expect(resultados.map((resultado) => resultado.insertados).sort((a, b) => a - b)).toEqual([0, 16]);
    expect(repeticion.insertados).toBe(0);
    expect(slots).toHaveLength(16);
    expect(new Set(slots.map((slot) => `${slot.programacionSemanalId}:${slot.inicioUtc.toISOString()}`)).size).toBe(16);
    await expect(
      testPrisma.slot.findUniqueOrThrow({ where: { id: primerSlot.id } }),
    ).resolves.toMatchObject({ estado: EstadoSlot.BLOQUEADO });
  });

  it("revierte toda la generación si cualquier intervalo es inválido (SLOT-2.2)", async () => {
    // Arrange
    await crearFixtureProgramacion({
      duracionCitaMinutos: 60,
      diaSemana: 5,
      turno: Turno.MANANA,
    });
    let invocaciones = 0;
    const fabricaConFallo: typeof crearIntervalosTurno = (...argumentos) => {
      invocaciones += 1;
      if (invocaciones === 2) {
        const [valido] = crearIntervalosTurno(...argumentos);
        return [
          valido,
          { inicioUtc: valido.inicioUtc, finUtc: valido.inicioUtc },
        ];
      }
      return crearIntervalosTurno(...argumentos);
    };
    const motor = new MotorDisponibilidad(testPrisma, () => new Date(), fabricaConFallo);

    // Act
    const asegurar = motor.asegurarHorizonte("2026-07-17");

    // Assert
    await expect(asegurar).rejects.toThrow();
    await expect(testPrisma.slot.count()).resolves.toBe(0);
  });
});
