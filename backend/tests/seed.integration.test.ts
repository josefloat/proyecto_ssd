import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ejecutarSeed } from "../src/seed/ejecutar-seed";
import { FIXTURE_SEED, type FixtureSeed } from "../src/seed/fixture";
import { limpiarDominio, testPrisma } from "./helpers/database";

async function snapshotSeed() {
  const [especialidades, medicos, consultorios, revisiones, programaciones, slots] =
    await Promise.all([
      testPrisma.especialidad.findMany({ orderBy: { id: "asc" } }),
      testPrisma.medico.findMany({ orderBy: { id: "asc" } }),
      testPrisma.consultorio.findMany({ orderBy: { id: "asc" } }),
      testPrisma.revisionProgramacion.findMany({ orderBy: { id: "asc" } }),
      testPrisma.programacionSemanal.findMany({ orderBy: { id: "asc" } }),
      testPrisma.slot.findMany({
        orderBy: [{ programacionSemanalId: "asc" }, { inicioUtc: "asc" }],
      }),
    ]);
  return { especialidades, medicos, consultorios, revisiones, programaciones, slots };
}

describe("seed determinista", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("repetido conserva exactamente claves, conteos y estados (PROG-3.1)", async () => {
    // Arrange
    const fechaAncla = "2026-07-17";

    // Act
    const primera = await ejecutarSeed(testPrisma, fechaAncla);
    const snapshotPrimero = await snapshotSeed();
    const segunda = await ejecutarSeed(testPrisma, fechaAncla);
    const snapshotSegundo = await snapshotSeed();

    // Assert
    expect(primera.insertados).toBeGreaterThan(0);
    expect(segunda.insertados).toBe(0);
    expect(snapshotSegundo).toEqual(snapshotPrimero);
  });

  it("rechaza un fixture con colisión sin programaciones parciales ni slots (PROG-3.2)", async () => {
    // Arrange
    const invalido: FixtureSeed = {
      ...FIXTURE_SEED,
      programaciones: [
        ...FIXTURE_SEED.programaciones,
        {
          ...FIXTURE_SEED.programaciones[0],
          id: "40000000-0000-4000-8000-000000000099",
          consultorioId: FIXTURE_SEED.consultorios[2].id,
        },
      ],
    };

    // Act
    const sembrar = ejecutarSeed(testPrisma, "2026-07-17", invalido);

    // Assert
    await expect(sembrar).rejects.toMatchObject({
      code: "FIXTURE_SEED_EN_CONFLICTO",
    });
    await expect(testPrisma.programacionSemanal.count()).resolves.toBe(0);
    await expect(testPrisma.slot.count()).resolves.toBe(0);
    await expect(testPrisma.especialidad.count()).resolves.toBe(0);
  });

  it("no sobrescribe perfiles ni revisiones administrados al volver a desplegar (ADM-PER-2.2)", async () => {
    await ejecutarSeed(testPrisma, "2026-07-17");
    const medicoId = FIXTURE_SEED.medicos[0].id;
    await testPrisma.medico.update({
      where: { id: medicoId },
      data: { nombre: "Nombre administrado", horasSemanales: 12 },
    });
    await testPrisma.revisionProgramacion.update({
      where: { medicoId_numero: { medicoId, numero: 1 } },
      data: { vigenteDesde: new Date("2026-01-01T00:00:00.000Z") },
    });

    await ejecutarSeed(testPrisma, "2026-07-17");

    await expect(
      testPrisma.medico.findUniqueOrThrow({ where: { id: medicoId } }),
    ).resolves.toMatchObject({
      nombre: "Nombre administrado",
      horasSemanales: 12,
    });
    await expect(
      testPrisma.revisionProgramacion.findUniqueOrThrow({
        where: { medicoId_numero: { medicoId, numero: 1 } },
      }),
    ).resolves.toMatchObject({
      vigenteDesde: new Date("2026-01-01T00:00:00.000Z"),
    });
  });
});
