import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

// Firma de subida directa a Cloudinary para el panel de imágenes del ADMIN.
// El API secret vive solo en el entorno del frontend (Vercel); el navegador
// recibe la firma y sube el archivo directamente a Cloudinary, y luego
// registra la URL resultante en el backend (que la valida y persiste).
const backendUrl = process.env.BACKEND_URL;
const COOKIE_SESION = "sdv_personal_session";
const CARPETA = "senal-de-vida";

// La sesión la valida el backend real: se reenvía la cookie a un endpoint
// exclusivo de ADMIN y solo un 200 autoriza la firma.
async function esAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_SESION)?.value;
  if (!token || !backendUrl) {
    return false;
  }
  try {
    const base = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`;
    const response = await fetch(new URL("personal/admin/catalogos", base), {
      headers: { cookie: `${COOKIE_SESION}=${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: { code: "CLOUDINARY_NO_CONFIGURADO", message: "Cloudinary no está configurado." } },
      { status: 503 },
    );
  }
  if (!(await esAdmin(request))) {
    return NextResponse.json(
      { error: { code: "NO_AUTORIZADO", message: "Inicia sesión como administrador." } },
      { status: 401 },
    );
  }
  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary firma los parámetros ordenados alfabéticamente + api_secret.
  const firma = createHash("sha1")
    .update(`folder=${CARPETA}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");
  return NextResponse.json(
    { cloudName, apiKey, timestamp, folder: CARPETA, firma },
    { headers: { "cache-control": "no-store" } },
  );
}
