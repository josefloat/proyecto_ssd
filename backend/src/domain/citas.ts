import { createHash } from "node:crypto";
import { PublicApiError, queryInvalida, validarUuidPublico } from "./public-api";

const DNI = /^[0-9]{8}$/;
const TELEFONO = /^[0-9]{9}$/;
const IDEMPOTENCY_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type DatosPacienteReserva = Readonly<{
  dni: string;
  telefono: string;
  nombre: string;
}>;

export type SolicitudReserva = Readonly<{
  slotId: string;
  paciente: DatosPacienteReserva;
}>;

export type CredencialesCita = Readonly<{
  dni: string;
  codigoReserva: string;
}>;

function objetoPlano(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw queryInvalida();
  }
  return valor as Record<string, unknown>;
}

function soloClaves(
  objeto: Record<string, unknown>,
  permitidas: readonly string[],
): void {
  const conjunto = new Set(permitidas);
  if (Object.keys(objeto).some((clave) => !conjunto.has(clave))) {
    throw queryInvalida();
  }
}

export function normalizarDni(valor: unknown): string {
  const dni = typeof valor === "string" ? valor.trim() : "";
  if (!DNI.test(dni)) {
    throw queryInvalida();
  }
  return dni;
}

export function normalizarTelefono(valor: unknown): string {
  const telefono =
    typeof valor === "string" ? valor.replace(/[\s-]/g, "") : "";
  if (!TELEFONO.test(telefono)) {
    throw queryInvalida();
  }
  return telefono;
}

export function normalizarNombre(valor: unknown): string {
  const nombre =
    typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
  if (nombre.length < 1 || nombre.length > 120) {
    throw queryInvalida();
  }
  return nombre;
}

export function normalizarCodigoReserva(valor: unknown): string {
  const compacto =
    typeof valor === "string"
      ? valor.toUpperCase().replace(/[^A-Z0-9]/g, "")
      : "";
  const cuerpo = compacto.startsWith("SV") ? compacto.slice(2) : "";
  if (
    cuerpo.length !== 8 ||
    [...cuerpo].some((caracter) => !ALFABETO_CODIGO.includes(caracter))
  ) {
    throw queryInvalida();
  }
  return `SV-${cuerpo}`;
}

export function validarIdempotencyKey(valor: unknown): string {
  const key = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  if (!IDEMPOTENCY_KEY.test(key)) {
    throw queryInvalida();
  }
  return key;
}

export function validarSolicitudReserva(valor: unknown): SolicitudReserva {
  const body = objetoPlano(valor);
  soloClaves(body, ["slotId", "dni", "telefono", "nombre"]);
  return {
    slotId: validarUuidPublico(body.slotId),
    paciente: {
      dni: normalizarDni(body.dni),
      telefono: normalizarTelefono(body.telefono),
      nombre: normalizarNombre(body.nombre),
    },
  };
}

export function validarCredencialesCita(valor: unknown): CredencialesCita {
  const body = objetoPlano(valor);
  soloClaves(body, ["dni", "codigoReserva"]);
  return {
    dni: normalizarDni(body.dni),
    codigoReserva: normalizarCodigoReserva(body.codigoReserva),
  };
}

export function fingerprintReserva(solicitud: SolicitudReserva): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        slotId: solicitud.slotId,
        dni: solicitud.paciente.dni,
        telefono: solicitud.paciente.telefono,
        nombre: solicitud.paciente.nombre,
      }),
    )
    .digest("hex");
}

export function datosPacienteNoCoinciden(): PublicApiError {
  return new PublicApiError(
    409,
    "DATOS_PACIENTE_NO_COINCIDEN",
    "Los datos no coinciden con el paciente registrado.",
  );
}

export function idempotenciaEnConflicto(): PublicApiError {
  return new PublicApiError(
    409,
    "IDEMPOTENCIA_EN_CONFLICTO",
    "La confirmación ya fue usada con datos diferentes.",
  );
}

export function slotNoDisponible(): PublicApiError {
  return new PublicApiError(
    409,
    "SLOT_NO_DISPONIBLE",
    "Ese horario ya no está disponible.",
  );
}

export function citaNoEncontrada(): PublicApiError {
  return new PublicApiError(
    404,
    "CITA_NO_ENCONTRADA",
    "No encontramos una cita con esos datos.",
  );
}

export function citaNoCancelable(): PublicApiError {
  return new PublicApiError(
    409,
    "CITA_NO_CANCELABLE",
    "La cita ya no puede cancelarse.",
  );
}

export function inconsistenciaCita(): PublicApiError {
  return new PublicApiError(
    503,
    "SERVICIO_NO_DISPONIBLE",
    "El servicio no está disponible en este momento.",
  );
}

export { ALFABETO_CODIGO };
