import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ESPECIALIDADES_CANONICAS } from "../src/domain/catalogo";
import { ejecutarSeed } from "../src/seed/ejecutar-seed";
import { limpiarDominio, testPrisma } from "./helpers/database";

describe("catálogo sembrado", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("persiste exactamente las seis especialidades canónicas (CAT-1.1)", async () => {
    // Arrange
    const esperado = [...ESPECIALIDADES_CANONICAS].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    );

    // Act
    await ejecutarSeed(testPrisma, "2026-07-17");
    const persistidas = await testPrisma.especialidad.findMany({
      select: { nombre: true, duracionCitaMinutos: true },
    });

    // Assert
    expect(
      persistidas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    ).toEqual(esperado);
  });
});
