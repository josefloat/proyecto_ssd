import { describe, expect, it } from "vitest";
import { presentacionEspecialidad } from "../lib/specialty-presentation";

describe("presentación local de especialidades", () => {
  it("mapea los seis nombres canónicos sin modificar su etiqueta (FLOW-2.3)", () => {
    // Arrange
    const nombres = [
      "Medicina General",
      "Cardiología",
      "Pediatría",
      "Traumatología",
      "Ginecología",
      "Dermatología",
    ];

    // Act
    const presentaciones = nombres.map(presentacionEspecialidad);

    // Assert
    expect(presentaciones.map((item) => item.icon)).toEqual([
      "briefcase",
      "heart",
      "baby",
      "bone",
      "venus",
      "hand",
    ]);
  });

  it("usa icono y tono neutrales para un nombre desconocido (FLOW-2.3)", () => {
    // Arrange / Act / Assert
    expect(presentacionEspecialidad("Medicina intercultural")).toEqual({
      icon: "neutral",
      tone: "neutral",
    });
  });
});
