import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { validarDuracionCita } from "../src/domain/catalogo";
import { limpiarDominio, testPrisma } from "./helpers/database";

describe("duración de especialidad", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("persiste una duración válida que no divide el turno (CAT-4.1)", async () => {
    // Arrange
    const duracion = validarDuracionCita(25);

    // Act
    const especialidad = await testPrisma.especialidad.create({
      data: { nombre: "Duración 25", duracionCitaMinutos: duracion },
    });

    // Assert
    expect(especialidad.duracionCitaMinutos).toBe(25);
  });

  it.each([0, -1, 241])(
    "rechaza %i minutos en dominio y PostgreSQL (CAT-4.2)",
    async (duracion) => {
      // Arrange
      const validar = () => validarDuracionCita(duracion);

      // Act / Assert
      expect(validar).toThrow("entero entre 1 y 240");
      await expect(
        testPrisma.especialidad.create({
          data: {
            nombre: `Inválida ${duracion}`,
            duracionCitaMinutos: duracion,
          },
        }),
      ).rejects.toThrow();
      await expect(testPrisma.especialidad.count()).resolves.toBe(0);
    },
  );
});
