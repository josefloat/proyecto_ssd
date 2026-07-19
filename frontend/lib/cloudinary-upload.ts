// Subida directa navegador → Cloudinary con firma emitida por el route
// handler /api/cloudinary-firma (que valida la sesión ADMIN contra el
// backend). Devuelve la URL segura del asset subido.
//
// El tipo de recurso viaja en la ruta del endpoint, no entre los parámetros
// firmados (la firma cubre solo folder + timestamp), así que la misma firma
// sirve para subir imágenes y vídeos sin tocar el route handler.
export type RecursoCloudinary = "image" | "video";

const LIMITE_BYTES: Readonly<Record<RecursoCloudinary, number>> = {
  image: 10 * 1024 * 1024,
  // El fondo de la home es un vídeo corto en bucle; por encima de 100 MB
  // Cloudinary exige subida por trozos, que este cliente no implementa.
  video: 80 * 1024 * 1024,
};

export async function subirArchivoCloudinary(
  archivo: File,
  recurso: RecursoCloudinary = "image",
): Promise<string> {
  if (!archivo.type.startsWith(`${recurso}/`)) {
    throw new Error(recurso === "video" ? "ARCHIVO_NO_VIDEO" : "ARCHIVO_NO_IMAGEN");
  }
  if (archivo.size > LIMITE_BYTES[recurso]) {
    throw new Error("ARCHIVO_MUY_GRANDE");
  }
  const firmaResponse = await fetch("/api/cloudinary-firma", { method: "POST" });
  if (!firmaResponse.ok) {
    throw Object.assign(new Error("FIRMA_FALLIDA"), {
      status: firmaResponse.status,
    });
  }
  const { cloudName, apiKey, timestamp, folder, firma } =
    (await firmaResponse.json()) as {
      cloudName: string;
      apiKey: string;
      timestamp: number;
      folder: string;
      firma: string;
    };

  const form = new FormData();
  form.append("file", archivo);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", firma);

  const subida = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${recurso}/upload`,
    { method: "POST", body: form },
  );
  const cuerpo = (await subida.json().catch(() => null)) as {
    secure_url?: string;
    error?: { message?: string };
  } | null;
  if (!subida.ok || !cuerpo?.secure_url) {
    throw Object.assign(new Error("SUBIDA_FALLIDA"), {
      status: subida.status,
      detalle: cuerpo?.error?.message,
    });
  }
  return cuerpo.secure_url;
}

export function subirImagenCloudinary(archivo: File): Promise<string> {
  return subirArchivoCloudinary(archivo, "image");
}

export function subirVideoCloudinary(archivo: File): Promise<string> {
  return subirArchivoCloudinary(archivo, "video");
}
