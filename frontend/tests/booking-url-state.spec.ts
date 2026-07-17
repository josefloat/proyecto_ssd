import { describe, expect, it } from "vitest";
import {
  limpiarSeleccionInvalida,
  rutaPrimerPasoIncompleto,
  seleccionarEspecialidad,
  seleccionarFecha,
  seleccionarMedico,
  seleccionarSlot,
} from "../lib/booking-url";

describe("URL como fuente durable de la reserva", () => {
  const completa = {
    especialidadId: "esp",
    medicoId: "med",
    fechaLima: "2026-07-17",
    slotId: "slot",
  };

  it("cambiar una selección superior limpia todas sus dependencias (FLOW-1.2)", () => {
    // Arrange / Act / Assert
    expect(seleccionarEspecialidad("otra")).toBe(
      "/reservar/especialidad?especialidadId=otra",
    );
    expect(seleccionarMedico(completa, "otro")).toBe(
      "/reservar/medico?especialidadId=esp&medicoId=otro",
    );
    expect(seleccionarFecha(completa, "2026-07-18")).toBe(
      "/reservar/fecha-hora?especialidadId=esp&medicoId=med&fechaLima=2026-07-18",
    );
    expect(seleccionarSlot(completa, "otro-slot")).toBe(
      "/reservar/fecha-hora?especialidadId=esp&medicoId=med&fechaLima=2026-07-17&slotId=otro-slot",
    );
  });

  it("limpia desde el primer dato revalidado como inválido (FLOW-1.3)", () => {
    // Arrange / Act / Assert
    expect(
      limpiarSeleccionInvalida(completa, "medico", "/reservar/medico"),
    ).toBe("/reservar/medico?especialidadId=esp");
    expect(
      limpiarSeleccionInvalida(completa, "slot", "/reservar/fecha-hora"),
    ).toBe(
      "/reservar/fecha-hora?especialidadId=esp&medicoId=med&fechaLima=2026-07-17",
    );
  });

  it("recupera URLs directas incompletas con el contexto todavía válido (FLOW-1.3)", () => {
    // Arrange / Act / Assert
    expect(rutaPrimerPasoIncompleto("/reservar/medico", {})).toBe(
      "/reservar/especialidad",
    );
    expect(
      rutaPrimerPasoIncompleto("/reservar/fecha-hora", {
        especialidadId: "esp",
      }),
    ).toBe("/reservar/medico?especialidadId=esp");
    expect(rutaPrimerPasoIncompleto("/reservar/fecha-hora", completa)).toBeNull();
  });
});
