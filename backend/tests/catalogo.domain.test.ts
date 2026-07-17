import { describe, expect, it } from "vitest";
import {
  ESPECIALIDADES_CANONICAS,
  validarCatalogoCanonico,
  validarDuracionCita,
} from "../src/domain/catalogo";

describe("catálogo de especialidades", () => {
  it("rechaza un nombre o duración divergente del catálogo canónico (CAT-1.2)", () => {
    // Arrange
    const nombreDivergente = ESPECIALIDADES_CANONICAS.map((item) =>
      item.nombre === "Cardiología" ? { ...item, nombre: "Corazón" } : item,
    );
    const duracionDivergente = ESPECIALIDADES_CANONICAS.map((item) =>
      item.nombre === "Pediatría"
        ? { ...item, duracionCitaMinutos: 25 }
        : item,
    );

    // Act
    const validarNombre = () => validarCatalogoCanonico(nombreDivergente);
    const validarDuracion = () => validarCatalogoCanonico(duracionDivergente);

    // Assert
    expect(validarNombre).toThrow("catálogo canónico");
    expect(validarDuracion).toThrow("catálogo canónico");
  });

  it("acepta 25 minutos y rechaza valores fuera de 1..240 (CAT-4.1, CAT-4.2)", () => {
    // Arrange
    const invalidas = [0, -1, 241, 1.5];

    // Act
    const valida = validarDuracionCita(25);

    // Assert
    expect(valida).toBe(25);
    for (const duracion of invalidas) {
      expect(() => validarDuracionCita(duracion)).toThrow(
        "entero entre 1 y 240",
      );
    }
  });
});
