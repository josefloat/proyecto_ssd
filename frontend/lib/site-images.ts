// Lectura server-side (nunca desde el navegador) de las imágenes
// gestionables del sitio. Va directo a BACKEND_URL para que las pantallas
// públicas no sumen requests /api/ en el cliente; si el backend no está
// configurado o falla, cada pantalla usa su fallback local versionado.
export type ImagenSitio = Readonly<{ clave: string; url: string; alt: string }>;

export type MapaImagenes = Readonly<Record<string, ImagenSitio>>;

export async function obtenerImagenesSitio(): Promise<MapaImagenes> {
  const base = process.env.BACKEND_URL;
  if (!base) {
    return {};
  }
  try {
    const target = new URL("imagenes", base.endsWith("/") ? base : `${base}/`);
    const response = await fetch(target, {
      // 5 minutos de caché ISR: un cambio hecho por el ADMIN en el panel se
      // refleja solo, sin redesplegar.
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      return {};
    }
    const data = (await response.json()) as { items?: ImagenSitio[] };
    return Object.fromEntries(
      (data.items ?? []).map((imagen) => [imagen.clave, imagen]),
    );
  } catch {
    return {};
  }
}

export function fotosDeMedicos(imagenes: MapaImagenes): Record<string, string> {
  const fotos: Record<string, string> = {};
  for (const [clave, imagen] of Object.entries(imagenes)) {
    if (clave.startsWith("medico:")) {
      fotos[clave.slice("medico:".length)] = imagen.url;
    }
  }
  return fotos;
}

// ── Claves derivadas ────────────────────────────────────────────────────
// El backend solo admite claves en minúsculas sin tildes ni "_", así que
// cada colección se modela como un prefijo de clave en vez de una tabla
// nueva: "hero-home-NN" para la portada, "especialidad-<slug>" para el
// carrusel y "video-fondo-home" para el fondo animado.

export const CLAVE_HERO = "hero-home";
export const CLAVE_VIDEO_FONDO = "video-fondo-home";
export const CLAVE_POSTER_VIDEO = "video-fondo-home-poster";

// Número máximo de fotos de portada que ofrece el panel. Suficiente para
// alternar con las tres escenas ilustradas sin que el carrusel se eternice.
export const MAX_FOTOS_HERO = 6;

// La clave de la primera portada no lleva sufijo (existía antes de que la
// portada admitiera varias fotos); las siguientes van con dos dígitos para
// que el orden lexicográfico del backend coincida con el orden mostrado.
export function claveHero(indice: number): string {
  return indice === 0
    ? CLAVE_HERO
    : `${CLAVE_HERO}-${String(indice + 1).padStart(2, "0")}`;
}

export function clavesHero(): readonly string[] {
  return Array.from({ length: MAX_FOTOS_HERO }, (_, i) => claveHero(i));
}

// Portada en orden de presentación, saltando los huecos: si el ADMIN sube
// solo la foto 1 y la 3, se muestran esas dos sin espacios en blanco.
export function fotosDelHero(imagenes: MapaImagenes): ImagenSitio[] {
  return clavesHero()
    .map((clave) => imagenes[clave])
    .filter((imagen): imagen is ImagenSitio => Boolean(imagen?.url));
}

// Slug estable de una especialidad: sin tildes, en minúsculas y con guiones,
// para que el panel y la home construyan la misma clave a partir del nombre
// canónico (mismo criterio que lib/specialty-presentation.ts).
export function slugEspecialidad(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function claveEspecialidad(nombre: string): string {
  return `especialidad-${slugEspecialidad(nombre)}`;
}

export function fotoDeEspecialidad(
  imagenes: MapaImagenes,
  nombre: string,
): ImagenSitio | undefined {
  return imagenes[claveEspecialidad(nombre)];
}

// Fondo animado de la home: solo cuenta si el ADMIN subió el vídeo. El
// póster es opcional y sirve de primer fotograma y de sustituto cuando el
// visitante pide movimiento reducido.
export function fondoDeVideo(
  imagenes: MapaImagenes,
): Readonly<{ url: string; poster: string }> | null {
  const video = imagenes[CLAVE_VIDEO_FONDO];
  if (!video?.url) {
    return null;
  }
  return { url: video.url, poster: imagenes[CLAVE_POSTER_VIDEO]?.url ?? "" };
}
