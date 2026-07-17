import { Turno } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { crearIntervalosTurno } from "../src/domain/intervalos";

describe("cálculo puro de intervalos", () => {
  it("crea nueve slots completos de 25 minutos y descarta el remanente (SLOT-1.3)", () => {
    // Arrange
    const fechaLima = "2026-07-17";

    // Act
    const intervalos = crearIntervalosTurno(fechaLima, Turno.MANANA, 25);

    // Assert
    expect(intervalos).toHaveLength(9);
    expect(intervalos[0]).toEqual({
      inicioUtc: new Date("2026-07-17T14:00:00.000Z"),
      finUtc: new Date("2026-07-17T14:25:00.000Z"),
    });
    expect(intervalos.at(-1)).toEqual({
      inicioUtc: new Date("2026-07-17T17:20:00.000Z"),
      finUtc: new Date("2026-07-17T17:45:00.000Z"),
    });
  });

  it("convierte el inicio del turno noche conservando el día civil Lima (SLOT-3.1)", () => {
    // Arrange
    const fechaLima = "2026-07-17";

    // Act
    const [primerIntervalo] = crearIntervalosTurno(
      fechaLima,
      Turno.NOCHE,
      30,
    );

    // Assert
    expect(primerIntervalo.inicioUtc).toEqual(
      new Date("2026-07-18T00:00:00.000Z"),
    );
    expect(primerIntervalo.finUtc).toEqual(
      new Date("2026-07-18T00:30:00.000Z"),
    );
  });
});
