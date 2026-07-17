import { Turno } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { TURNOS } from "../src/domain/turnos";

describe("catálogo fijo de turnos", () => {
  it("contiene exactamente mañana, tarde y noche con sus límites (CAT-3.1)", () => {
    // Arrange
    const esperado = {
      [Turno.MANANA]: { inicioMinuto: 540, finMinuto: 780 },
      [Turno.TARDE]: { inicioMinuto: 900, finMinuto: 1140 },
      [Turno.NOCHE]: { inicioMinuto: 1140, finMinuto: 1380 },
    };

    // Act
    const catalogo = TURNOS;

    // Assert
    expect(catalogo).toEqual(esperado);
    expect(Object.keys(catalogo)).toHaveLength(3);
  });
});
