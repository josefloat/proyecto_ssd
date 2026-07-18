import type { EstadoCita } from "./api-types";

export const ESTADO_ETIQUETA: Record<EstadoCita, string> = {
  RESERVADA: "Pendiente de pago",
  PAGADA: "Pagado",
  ATENDIDA: "Atendido",
  NO_ASISTIO: "No asistió",
  CANCELADA: "Cancelado",
};

const fechaLarga = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Lima",
});

const horaCorta = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Lima",
});

export function formatearFechaLarga(iso: string): string {
  return fechaLarga.format(new Date(iso));
}

export function formatearHora(iso: string): string {
  return horaCorta.format(new Date(iso));
}

// Enmascara el DNI para la vista de lista (primeros 2, últimos 3): 45812678 →
// 45***678. Los datos completos solo se muestran en el detalle autorizado.
export function enmascararDni(dni: string): string {
  if (dni.length !== 8) return dni;
  return `${dni.slice(0, 2)}***${dni.slice(5)}`;
}
