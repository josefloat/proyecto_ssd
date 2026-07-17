import { EstadoSlot, PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MotorDisponibilidad } from "../src/services/motor-disponibilidad";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearFixtureProgramacion } from "./helpers/fixtures";

const queryPrisma = new PrismaClient({
  log: [{ emit: "event", level: "query" }],
});
const queries: string[] = [];

queryPrisma.$on("query", (event) => {
  queries.push(event.query);
});

function escriturasSlot(operacion: "INSERT" | "UPDATE" = "INSERT") {
  const patron =
    operacion === "INSERT"
      ? /^\s*INSERT\s+INTO\s+"Slot"/i
      : /^\s*UPDATE\s+"Slot"/i;
  return queries.filter((query) => patron.test(query));
}

describe("reconciliación eficiente del horizonte", () => {
  beforeEach(async () => {
    await limpiarDominio();
    queries.length = 0;
  });

  afterAll(async () => {
    await Promise.all([queryPrisma.$disconnect(), testPrisma.$disconnect()]);
  });

  it("omite por completo INSERT cuando el horizonte está caliente (SLOT-6.1)", async () => {
    // Arrange
    await crearFixtureProgramacion({ duracionCitaMinutos: 60, diaSemana: 5 });
    const motor = new MotorDisponibilidad(queryPrisma);
    await motor.asegurarHorizonte("2026-07-17");
    queries.length = 0;

    // Act
    const resultado = await motor.asegurarHorizonte("2026-07-17");

    // Assert
    expect(resultado).toMatchObject({ considerados: 16, insertados: 0 });
    expect(escriturasSlot()).toHaveLength(0);
  });

  it("inserta exactamente las tres claves naturales faltantes (SLOT-6.2)", async () => {
    // Arrange
    await crearFixtureProgramacion({ duracionCitaMinutos: 60, diaSemana: 5 });
    const motor = new MotorDisponibilidad(queryPrisma);
    await motor.asegurarHorizonte("2026-07-17");
    const slots = await testPrisma.slot.findMany({
      orderBy: [{ fechaLima: "asc" }, { inicioUtc: "asc" }],
    });
    const eliminados = slots.slice(2, 5);
    await testPrisma.slot.deleteMany({
      where: { id: { in: eliminados.map((slot) => slot.id) } },
    });
    queries.length = 0;

    // Act
    const resultado = await motor.asegurarHorizonte("2026-07-17");
    const clavesFinales = await testPrisma.slot.findMany({
      select: { programacionSemanalId: true, inicioUtc: true },
    });

    // Assert
    expect(resultado.insertados).toBe(3);
    expect(escriturasSlot()).toHaveLength(3);
    expect(clavesFinales).toHaveLength(16);
    expect(
      new Set(
        clavesFinales.map(
          (slot) =>
            `${slot.programacionSemanalId}:${slot.inicioUtc.toISOString()}`,
        ),
      ).size,
    ).toBe(16);
  });

  it("cuenta reservados y bloqueados como existentes sin mutarlos (SLOT-6.3)", async () => {
    // Arrange
    await crearFixtureProgramacion({ duracionCitaMinutos: 60, diaSemana: 5 });
    const motor = new MotorDisponibilidad(queryPrisma);
    await motor.asegurarHorizonte("2026-07-17");
    const [reservado, bloqueado] = await testPrisma.slot.findMany({
      take: 2,
      orderBy: { inicioUtc: "asc" },
    });
    await testPrisma.$transaction([
      testPrisma.slot.update({
        where: { id: reservado.id },
        data: { estado: EstadoSlot.RESERVADO },
      }),
      testPrisma.slot.update({
        where: { id: bloqueado.id },
        data: { estado: EstadoSlot.BLOQUEADO },
      }),
    ]);
    queries.length = 0;

    // Act
    const resultado = await motor.asegurarHorizonte("2026-07-17");
    const persistidos = await testPrisma.slot.findMany({
      where: { id: { in: [reservado.id, bloqueado.id] } },
      orderBy: { inicioUtc: "asc" },
    });

    // Assert
    expect(resultado.insertados).toBe(0);
    expect(escriturasSlot()).toHaveLength(0);
    expect(escriturasSlot("UPDATE")).toHaveLength(0);
    expect(persistidos.map(({ id, estado }) => ({ id, estado }))).toEqual([
      { id: reservado.id, estado: EstadoSlot.RESERVADO },
      { id: bloqueado.id, estado: EstadoSlot.BLOQUEADO },
    ]);
  });

  it("serializa dos reconciliaciones y converge sobre los faltantes (SLOT-6.4)", async () => {
    // Arrange
    await crearFixtureProgramacion({ duracionCitaMinutos: 60, diaSemana: 5 });
    const primerMotor = new MotorDisponibilidad(queryPrisma);
    const segundoMotor = new MotorDisponibilidad(queryPrisma);
    await primerMotor.asegurarHorizonte("2026-07-17");
    const eliminados = await testPrisma.slot.findMany({ take: 3 });
    await testPrisma.slot.deleteMany({
      where: { id: { in: eliminados.map((slot) => slot.id) } },
    });
    queries.length = 0;

    // Act
    const resultados = await Promise.all([
      primerMotor.asegurarHorizonte("2026-07-17"),
      segundoMotor.asegurarHorizonte("2026-07-17"),
    ]);
    const slots = await testPrisma.slot.findMany();

    // Assert
    expect(resultados.map(({ insertados }) => insertados).sort()).toEqual([0, 3]);
    expect(escriturasSlot()).toHaveLength(3);
    expect(slots).toHaveLength(16);
    expect(
      new Set(
        slots.map(
          (slot) =>
            `${slot.programacionSemanalId}:${slot.inicioUtc.toISOString()}`,
        ),
      ).size,
    ).toBe(16);
  });
});
