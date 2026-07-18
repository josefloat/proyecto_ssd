import { RolUsuario } from "@prisma/client";
import { normalizarEmail } from "./auth";
import { queryInvalidaPersonal } from "./personal-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CrearPersonalInput =
  | Readonly<{
      rol: "RECEPCIONISTA";
      nombre: string;
      email: string;
    }>
  | Readonly<{
      rol: "MEDICO";
      nombre: string;
      email: string;
      especialidadId: string;
      horasSemanales: number;
    }>;

export type ActualizarPersonalInput = Readonly<{
  nombre?: string;
  email?: string;
  activo?: boolean;
  especialidadId?: string;
  horasSemanales?: number;
}>;

function objetoPlano(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw queryInvalidaPersonal();
  }
  return valor as Record<string, unknown>;
}

function nombreNormalizado(valor: unknown): string {
  const nombre = typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
  if (nombre.length < 2 || nombre.length > 120) {
    throw queryInvalidaPersonal();
  }
  return nombre;
}

function uuid(valor: unknown): string {
  if (typeof valor !== "string" || !UUID.test(valor)) {
    throw queryInvalidaPersonal();
  }
  return valor;
}

export function validarIdPersonal(valor: unknown): string {
  return uuid(valor);
}

function horasSemanales(valor: unknown): number {
  if (!Number.isInteger(valor) || (valor as number) <= 0 || (valor as number) > 168) {
    throw queryInvalidaPersonal();
  }
  return valor as number;
}

export function validarCrearPersonal(valor: unknown): CrearPersonalInput {
  const body = objetoPlano(valor);
  if (body.rol === RolUsuario.RECEPCIONISTA) {
    if (
      Object.keys(body).length !== 3 ||
      !("nombre" in body) ||
      !("email" in body)
    ) {
      throw queryInvalidaPersonal();
    }
    return {
      rol: RolUsuario.RECEPCIONISTA,
      nombre: nombreNormalizado(body.nombre),
      email: normalizarEmail(body.email),
    };
  }
  if (body.rol === RolUsuario.MEDICO) {
    if (
      Object.keys(body).length !== 5 ||
      !("nombre" in body) ||
      !("email" in body) ||
      !("especialidadId" in body) ||
      !("horasSemanales" in body)
    ) {
      throw queryInvalidaPersonal();
    }
    return {
      rol: RolUsuario.MEDICO,
      nombre: nombreNormalizado(body.nombre),
      email: normalizarEmail(body.email),
      especialidadId: uuid(body.especialidadId),
      horasSemanales: horasSemanales(body.horasSemanales),
    };
  }
  throw queryInvalidaPersonal();
}

export function validarActualizarPersonal(valor: unknown): ActualizarPersonalInput {
  const body = objetoPlano(valor);
  const permitidas = new Set([
    "nombre",
    "email",
    "activo",
    "especialidadId",
    "horasSemanales",
  ]);
  const claves = Object.keys(body);
  if (claves.length === 0 || claves.some((clave) => !permitidas.has(clave))) {
    throw queryInvalidaPersonal();
  }
  return {
    ...(body.nombre === undefined ? {} : { nombre: nombreNormalizado(body.nombre) }),
    ...(body.email === undefined ? {} : { email: normalizarEmail(body.email) }),
    ...(body.activo === undefined
      ? {}
      : typeof body.activo === "boolean"
        ? { activo: body.activo }
        : (() => {
            throw queryInvalidaPersonal();
          })()),
    ...(body.especialidadId === undefined
      ? {}
      : { especialidadId: uuid(body.especialidadId) }),
    ...(body.horasSemanales === undefined
      ? {}
      : { horasSemanales: horasSemanales(body.horasSemanales) }),
  };
}
