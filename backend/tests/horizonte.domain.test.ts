import { describe, expect, it, vi } from "vitest";
import { MotorDisponibilidad } from "../src/services/motor-disponibilidad";

describe("fecha ancla del horizonte", () => {
  it("usa hoy en Lima desde el reloj inyectado cuando no recibe ancla (SLOT-1.1)", async () => {
    // Arrange
    const transaction = vi.fn(async (operacion: (tx: unknown) => unknown) =>
      operacion({
        $queryRaw: vi.fn().mockResolvedValue([{ locked: 1 }]),
        revisionProgramacion: { findMany: vi.fn().mockResolvedValue([]) },
        slot: { findMany: vi.fn().mockResolvedValue([]) },
      }),
    );
    const database = { $transaction: transaction };
    const motor = new MotorDisponibilidad(
      database as never,
      () => new Date("2026-07-18T03:00:00.000Z"),
    );

    // Act
    const resultado = await motor.asegurarHorizonte();

    // Assert
    expect(resultado).toEqual({
      desde: "2026-07-17",
      hastaExclusiva: "2026-08-14",
      considerados: 0,
      insertados: 0,
    });
  });

  it.each(["17-07-2026", "2026-02-30"])(
    "rechaza la fecha ancla inválida %s antes de abrir una transacción (SLOT-1.2)",
    async (fechaAncla) => {
      // Arrange
      const transaction = vi.fn();
      const database = { $transaction: transaction };
      const motor = new MotorDisponibilidad(database as never);

      // Act
      const asegurar = motor.asegurarHorizonte(fechaAncla);

      // Assert
      await expect(asegurar).rejects.toMatchObject({
        code: "FECHA_LIMA_INVALIDA",
      });
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});
