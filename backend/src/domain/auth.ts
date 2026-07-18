import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { queryInvalidaPersonal } from "./personal-api";

// Parámetros de costo fijos de scrypt (no configurables): N=16384, r=8, p=1
// son los valores por defecto de Node y suficientes para un catálogo de
// usuarios internos pequeño. keylen=64 produce una clave derivada de 128 hex.
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CredencialesLogin = Readonly<{
  email: string;
  password: string;
}>;

function objetoPlano(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw queryInvalidaPersonal();
  }
  return valor as Record<string, unknown>;
}

export function normalizarEmail(valor: unknown): string {
  const email = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  if (email.length < 3 || email.length > 254 || !EMAIL.test(email)) {
    throw queryInvalidaPersonal();
  }
  return email;
}

function validarPassword(valor: unknown): string {
  // La contraseña nunca se registra ni se incluye en ningún error.
  if (typeof valor !== "string" || valor.length < 1 || valor.length > 200) {
    throw queryInvalidaPersonal();
  }
  return valor;
}

export function validarCredencialesLogin(valor: unknown): CredencialesLogin {
  const body = objetoPlano(valor);
  const claves = new Set(Object.keys(body));
  if (claves.size !== 2 || !claves.has("email") || !claves.has("password")) {
    throw queryInvalidaPersonal();
  }
  return {
    email: normalizarEmail(body.email),
    password: validarPassword(body.password),
  };
}

// Deriva `salt:clave` en hex. El salt aleatorio hace que dos usuarios con la
// misma contraseña produzcan hashes distintos.
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derivada = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${derivada.toString("hex")}`;
}

// Comparación en tiempo constante contra un hash `salt:clave`. Devuelve false
// ante cualquier formato inválido en vez de lanzar, para que un hash corrupto
// se comporte como credencial incorrecta y no como error 500.
export function verifyPassword(password: string, almacenado: string): boolean {
  const partes = almacenado.split(":");
  if (partes.length !== 2) {
    return false;
  }
  const [saltHex, claveHex] = partes;
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(claveHex)) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const esperada = Buffer.from(claveHex, "hex");
  if (esperada.length !== SCRYPT_KEYLEN) {
    return false;
  }
  const calculada = scryptSync(password, salt, SCRYPT_KEYLEN);
  return timingSafeEqual(calculada, esperada);
}

// Token opaco de sesión (32 bytes aleatorios en hex). Solo se persiste su
// hash SHA-256; el token en claro vive únicamente en la cookie del navegador.
export function generarTokenSesion(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
