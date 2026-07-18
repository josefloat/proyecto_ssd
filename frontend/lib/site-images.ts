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
