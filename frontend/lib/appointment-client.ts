import type { ApiErrorResponse, DetalleCita } from "./api-types";

export const CONFIRMATION_STORAGE = "senal-de-vida:confirmacion-cita";
export const APPOINTMENT_STORAGE = "senal-de-vida:detalle-mi-cita";
const IDEMPOTENCY_PREFIX = "senal-de-vida:idempotencia:";

export type BookingFailure = Readonly<{
  message: string;
  clearSlot: boolean;
  field?: "dni" | "telefono" | "nombre";
}>;

export function mapBookingFailure(status: number, code?: string): BookingFailure {
  if (status === 400 || code === "QUERY_INVALIDA") {
    return {
      message: "Revisa el DNI, el nombre y el número de celular.",
      clearSlot: false,
      field: "dni",
    };
  }
  if (code === "DATOS_PACIENTE_NO_COINCIDEN") {
    return {
      message: "El teléfono no coincide con el registrado para ese DNI.",
      clearSlot: false,
      field: "telefono",
    };
  }
  if (code === "IDEMPOTENCIA_EN_CONFLICTO") {
    return {
      message: "Esta confirmación ya se usó con otros datos. Vuelve a elegir el horario.",
      clearSlot: true,
    };
  }
  if (code === "SLOT_NO_DISPONIBLE") {
    return {
      message: "Ese horario ya no está disponible. Elige otro.",
      clearSlot: true,
    };
  }
  return {
    message: "No pudimos confirmar la cita. Inténtalo nuevamente.",
    clearSlot: false,
  };
}

async function leerRespuesta(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function reservarCita(
  payload: Readonly<{
    slotId: string;
    dni: string;
    telefono: string;
    nombre: string;
  }>,
  idempotencyKey: string,
): Promise<DetalleCita> {
  const response = await fetch("/api/citas", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const body = await leerRespuesta(response);
  if (!response.ok) {
    const code = (body as ApiErrorResponse | null)?.error?.code;
    throw Object.assign(new Error("BOOKING_FAILED"), {
      bookingFailure: mapBookingFailure(response.status, code),
    });
  }
  return body as DetalleCita;
}

export async function consultarCita(
  dni: string,
  codigoReserva: string,
): Promise<DetalleCita> {
  const response = await fetch("/api/citas/consulta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dni, codigoReserva }),
  });
  const body = await leerRespuesta(response);
  if (!response.ok) {
    throw Object.assign(new Error("LOOKUP_FAILED"), {
      status: response.status,
      code: (body as ApiErrorResponse | null)?.error?.code,
    });
  }
  return body as DetalleCita;
}

export async function cancelarCita(
  dni: string,
  codigoReserva: string,
): Promise<DetalleCita> {
  const response = await fetch("/api/citas/cancelacion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dni, codigoReserva }),
  });
  const body = await leerRespuesta(response);
  if (!response.ok) {
    throw Object.assign(new Error("CANCEL_FAILED"), {
      status: response.status,
      code: (body as ApiErrorResponse | null)?.error?.code,
    });
  }
  return body as DetalleCita;
}

export function idempotencyKeyParaSlot(slotId: string): string {
  const storageKey = `${IDEMPOTENCY_PREFIX}${slotId}`;
  const existente = window.sessionStorage.getItem(storageKey);
  if (existente) return existente;
  const nueva = window.crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, nueva);
  return nueva;
}
