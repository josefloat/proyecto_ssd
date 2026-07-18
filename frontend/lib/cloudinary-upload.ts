// Subida directa navegador → Cloudinary con firma emitida por el route
// handler /api/cloudinary-firma (que valida la sesión ADMIN contra el
// backend). Devuelve la URL segura del asset subido.
const LIMITE_BYTES = 10 * 1024 * 1024;

export async function subirImagenCloudinary(archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) {
    throw new Error("ARCHIVO_NO_IMAGEN");
  }
  if (archivo.size > LIMITE_BYTES) {
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
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
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
