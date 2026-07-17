import { describe, expect, it, vi } from "vitest";
import { MotorDisponibilidad } from "../src/services/motor-disponibilidad";

describe("consulta interna de disponibilidad", () => {
  it("rechaza una fecha inválida antes de consultar almacenamiento (SLOT-5.2)", async () => {
    // Arrange
    const findMany = vi.fn();
    const database = { slot: { findMany } };
    const motor = new MotorDisponibilidad(database as never);

    // Act
    const consultar = motor.consultarDisponibilidad({
      especialidadId: "especialidad",
      fechaLima: "2026-07-32",
    });

    // Assert
    await expect(consultar).rejects.toMatchObject({
      code: "FECHA_LIMA_INVALIDA",
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});
