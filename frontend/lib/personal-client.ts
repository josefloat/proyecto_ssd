import type { ApiErrorResponse } from "./api-types";
import type {
  AgendaResponse,
  CitaAgendaPersonal,
  FiltrosAgenda,
  LoginResponse,
  CatalogosAdmin,
  ItemProgramacionAdmin,
  OcupacionConsultorioAdmin,
  ProgramacionAdmin,
  RevisionProgramacionAdmin,
  UsuarioAdmin,
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

function errorApi(response: Response, body: unknown, tipo: string) {
  return Object.assign(new Error(tipo), {
    status: response.status,
    code: codigoError(body),
  });
}

export async function cambiarPassword(
  passwordActual: string,
  passwordNueva: string,
): Promise<void> {
  const response = await fetch("/api/personal/password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ passwordActual, passwordNueva }),
  });
  if (!response.ok) {
    const body = await leerRespuesta(response);
    throw errorApi(response, body, "PASSWORD_FAILED");
  }
}

export async function listarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const response = await fetch("/api/personal/admin/usuarios", {
    cache: "no-store",
  });
  const body = await leerRespuesta(response);
  if (!response.ok) throw errorApi(response, body, "ADMIN_USERS_FAILED");
  return (body as { items: UsuarioAdmin[] }).items;
}

export async function obtenerCatalogosAdmin(): Promise<CatalogosAdmin> {
  const response = await fetch("/api/personal/admin/catalogos", {
    cache: "no-store",
  });
  const body = await leerRespuesta(response);
  if (!response.ok) throw errorApi(response, body, "ADMIN_CATALOGS_FAILED");
  return body as CatalogosAdmin;
}

export async function crearUsuarioAdmin(body: Record<string, unknown>): Promise<{
  usuario: UsuarioAdmin;
  passwordTemporal: string;
}> {
  const response = await fetch("/api/personal/admin/usuarios", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const respuesta = await leerRespuesta(response);
  if (!response.ok) throw errorApi(response, respuesta, "ADMIN_CREATE_FAILED");
  return respuesta as { usuario: UsuarioAdmin; passwordTemporal: string };
}

export async function actualizarUsuarioAdmin(
  usuarioId: string,
  cambios: Record<string, unknown>,
): Promise<UsuarioAdmin> {
  const response = await fetch(`/api/personal/admin/usuarios/${usuarioId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cambios),
  });
  const body = await leerRespuesta(response);
  if (!response.ok) throw errorApi(response, body, "ADMIN_UPDATE_FAILED");
  return (body as { usuario: UsuarioAdmin }).usuario;
}

export async function reiniciarPasswordAdmin(usuarioId: string): Promise<string> {
  const response = await fetch(`/api/personal/admin/usuarios/${usuarioId}/password`, {
    method: "POST",
  });
  const body = await leerRespuesta(response);
  if (!response.ok) throw errorApi(response, body, "ADMIN_RESET_FAILED");
  return (body as { passwordTemporal: string }).passwordTemporal;
}

export async function obtenerProgramacionAdmin(
  medicoId: string,
): Promise<ProgramacionAdmin> {
  const response = await fetch(`/api/personal/admin/programacion/${medicoId}`, {
    cache: "no-store",
  });
  const body = await leerRespuesta(response);
  if (!response.ok) throw errorApi(response, body, "ADMIN_PROGRAM_FAILED");
  return body as ProgramacionAdmin;
}

export async function guardarProgramacionAdmin(
  medicoId: string,
  body: { versionBase: number; vigenteDesde: string; items: ItemProgramacionAdmin[] },
) {
  const response = await fetch(`/api/personal/admin/programacion/${medicoId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const respuesta = await leerRespuesta(response);
  if (!response.ok) throw errorApi(response, respuesta, "ADMIN_PROGRAM_SAVE_FAILED");
  return respuesta as {
    revision: RevisionProgramacionAdmin;
    reconciliacion: { eliminados: number; insertados: number; omitidosPorOcupacion: number };
  };
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

// --- Imágenes del sitio (gestión ADMIN + lectura pública) ---

export async function listarImagenesSitio(): Promise<
  import("./personal-types").ImagenSitioAdmin[]
> {
  const response = await fetch("/api/imagenes", { cache: "no-store" });
  const body = await leerRespuesta(response);
  if (!response.ok) throw errorApi(response, body, "IMAGENES_FAILED");
  return (body as { items: import("./personal-types").ImagenSitioAdmin[] }).items;
}

export async function guardarImagenAdmin(
  clave: string,
  datos: { url: string; alt?: string },
): Promise<import("./personal-types").ImagenSitioAdmin> {
  const response = await fetch(
    `/api/personal/admin/imagenes/${encodeURIComponent(clave)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(datos),
    },
  );
  const body = await leerRespuesta(response);
  if (!response.ok) throw errorApi(response, body, "IMAGEN_SAVE_FAILED");
  return (body as { imagen: import("./personal-types").ImagenSitioAdmin }).imagen;
}

export async function eliminarImagenAdmin(clave: string): Promise<void> {
  const response = await fetch(
    `/api/personal/admin/imagenes/${encodeURIComponent(clave)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 204) {
    const body = await leerRespuesta(response);
    throw errorApi(response, body, "IMAGEN_DELETE_FAILED");
  }
}

export async function obtenerOcupacionAdmin(
  vigenteDesde: string,
): Promise<{ items: ReadonlyArray<OcupacionConsultorioAdmin> }> {
  const response = await fetch(
    `/api/personal/admin/ocupacion-consultorios?vigenteDesde=${encodeURIComponent(vigenteDesde)}`,
  );
  if (!response.ok) {
    throw Object.assign(new Error("OCUPACION_FALLIDA"), {
      status: response.status,
    });
  }
  return (await response.json()) as {
    items: ReadonlyArray<OcupacionConsultorioAdmin>;
  };
}
