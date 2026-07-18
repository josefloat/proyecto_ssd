import type { ApiErrorResponse } from "./api-types";
import type {
  AgendaResponse,
  CitaAgendaPersonal,
  FiltrosAgenda,
  LoginResponse,
} from "./personal-types";

async function leerRespuesta(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function codigoError(body: unknown): string | undefined {
  return (body as ApiErrorResponse | null)?.error?.code;
}

export async function iniciarSesion(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch("/api/personal/sesion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await leerRespuesta(response);
  if (!response.ok) {
    throw Object.assign(new Error("LOGIN_FAILED"), {
      status: response.status,
      code: codigoError(body),
    });
  }
  return body as LoginResponse;
}

export async function cerrarSesion(): Promise<void> {
  await fetch("/api/personal/sesion", { method: "DELETE" });
}

function construirQuery(filtros: FiltrosAgenda): string {
  const params = new URLSearchParams();
  if (filtros.especialidadId) params.set("especialidadId", filtros.especialidadId);
  if (filtros.medicoId) params.set("medicoId", filtros.medicoId);
  if (filtros.estado) params.set("estado", filtros.estado);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function obtenerAgendaRecepcion(
  filtros: FiltrosAgenda = {},
): Promise<CitaAgendaPersonal[]> {
  const response = await fetch(
    `/api/personal/recepcion/agenda${construirQuery(filtros)}`,
    { headers: { "cache-control": "no-store" } },
  );
  const body = await leerRespuesta(response);
  if (!response.ok) {
    throw Object.assign(new Error("AGENDA_FAILED"), {
      status: response.status,
      code: codigoError(body),
    });
  }
  return (body as AgendaResponse).items;
}

export async function obtenerAgendaMedico(): Promise<CitaAgendaPersonal[]> {
  const response = await fetch("/api/personal/medico/agenda", {
    headers: { "cache-control": "no-store" },
  });
  const body = await leerRespuesta(response);
  if (!response.ok) {
    throw Object.assign(new Error("AGENDA_FAILED"), {
      status: response.status,
      code: codigoError(body),
    });
  }
  return (body as AgendaResponse).items;
}

export async function registrarPago(
  citaId: string,
): Promise<CitaAgendaPersonal> {
  const response = await fetch(
    `/api/personal/recepcion/citas/${citaId}/pago`,
    { method: "POST" },
  );
  const body = await leerRespuesta(response);
  if (!response.ok) {
    throw Object.assign(new Error("PAGO_FAILED"), {
      status: response.status,
      code: codigoError(body),
    });
  }
  return body as CitaAgendaPersonal;
}

// Enlace wa.me a partir del teléfono real del paciente (9 dígitos Perú, prefijo
// 51). No integra la API de WhatsApp: solo abre el chat con un mensaje.
export function enlaceWhatsApp(
  cita: Pick<CitaAgendaPersonal, "paciente" | "codigoReserva">,
): string {
  const numero = `51${cita.paciente.telefono.replace(/\D/g, "")}`;
  const mensaje = `Hola ${cita.paciente.nombre}, le recordamos su cita en Señal de Vida (código ${cita.codigoReserva}).`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
