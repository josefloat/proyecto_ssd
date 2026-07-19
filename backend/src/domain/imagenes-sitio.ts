import { queryInvalidaPersonal } from "./personal-api";

// Claves permitidas: slugs del sitio ("hero-home", "fondo-login") o el
// retrato de un médico ("medico:<uuid>"). Se validan para que el panel no
// pueda crear entradas arbitrarias con espacios o mayúsculas.
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/;
const MEDICO =
  /^medico:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Solo se aceptan URLs de entrega de Cloudinary (upload o fetch): el panel
// nunca debe apuntar el sitio público a un origen no controlado. Se admiten
// los dos tipos de recurso que publica el panel: "image" para fotos y
// "video" para el fondo animado de la home.
const CLOUDINARY_URL =
  /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/(image|video)\//i;

export type ImagenSitioInput = Readonly<{ url: string; alt: string }>;

export function validarClaveImagen(valor: unknown): string {
  if (typeof valor !== "string") {
    throw queryInvalidaPersonal();
  }
  const clave = valor.trim();
  if (!SLUG.test(clave) && !MEDICO.test(clave)) {
    throw queryInvalidaPersonal();
  }
  return MEDICO.test(clave) ? clave.toLowerCase() : clave;
}

export function validarImagenSitio(valor: unknown): ImagenSitioInput {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw queryInvalidaPersonal();
  }
  const { url, alt } = valor as Record<string, unknown>;
  if (
    typeof url !== "string" ||
    url.length > 600 ||
    /\s/.test(url) ||
    !CLOUDINARY_URL.test(url)
  ) {
    throw queryInvalidaPersonal();
  }
  if (alt !== undefined && (typeof alt !== "string" || alt.length > 300)) {
    throw queryInvalidaPersonal();
  }
  return { url, alt: typeof alt === "string" ? alt.trim() : "" };
}
