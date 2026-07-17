import { describe, expect, it } from "vitest";
import { mapBookingFailure } from "../lib/appointment-client";

describe("estado del submit de reserva", () => {
  it.each([
    [400, "QUERY_INVALIDA", false, "dni"],
    [409, "DATOS_PACIENTE_NO_COINCIDEN", false, "telefono"],
    [409, "IDEMPOTENCIA_EN_CONFLICTO", true, undefined],
    [409, "SLOT_NO_DISPONIBLE", true, undefined],
    [503, "SERVICIO_NO_DISPONIBLE", false, undefined],
  ] as const)(
    "mapea %s/%s sin reintentar reglas del backend (FLOW-4.2)",
    (status, code, clearSlot, field) => {
      // Arrange / Act
      const state = mapBookingFailure(status, code);

      // Assert
      expect(state.clearSlot).toBe(clearSlot);
      expect(state.field).toBe(field);
      expect(state.message.length).toBeGreaterThan(20);
    },
  );
});
