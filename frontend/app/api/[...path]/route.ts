import { NextRequest, NextResponse } from "next/server";

// BACKEND_URL es server-side (nunca NEXT_PUBLIC_*): el navegador solo
// habla con el origen del frontend, nunca directamente con el backend.
// Un Route Handler (no rewrites()) porque necesitamos controlar la
// respuesta cuando el backend no responde: rewrites() con un destino
// externo devuelve un 500 opaco de Next.js sin poder personalizarlo.
const backendUrl = process.env.BACKEND_URL;
const UPSTREAM_TIMEOUT_MS = 10_000;

// Única cookie que el proxy transporta en ambos sentidos. No se reenvía el
// header Cookie completo, ni Authorization, ni cualquier otra cookie: así un
// detalle ajeno del navegador o del backend nunca cruza el proxy.
const COOKIE_SESION = "sdv_personal_session";

function extraerCookieSesion(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const parte of cookieHeader.split(";")) {
    const separador = parte.indexOf("=");
    if (separador === -1) {
      continue;
    }
    const nombre = parte.slice(0, separador).trim();
    if (nombre === COOKIE_SESION) {
      return parte.slice(separador + 1).trim();
    }
  }
  return null;
}

function leerSetCookies(headers: Headers): string[] {
  const conGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof conGetter.getSetCookie === "function") {
    return conGetter.getSetCookie();
  }
  const unica = headers.get("set-cookie");
  return unica ? [unica] : [];
}

async function proxy(request: NextRequest, path: string[]) {
  if (!backendUrl) {
    return NextResponse.json(
      { error: "backend no configurado" },
      { status: 502 },
    );
  }

  const base = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`;
  const target = new URL(path.join("/"), base);
  target.search = request.nextUrl.search;

  const tokenSesion = extraerCookieSesion(request.headers.get("cookie"));

  // Un cuerpo vacío (por ejemplo, un DELETE sin payload) se reenvía como
  // undefined: pasar un ArrayBuffer de 0 bytes rompe el fetch upstream.
  let cuerpoPeticion: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const buffer = await request.arrayBuffer();
    cuerpoPeticion = buffer.byteLength > 0 ? buffer : undefined;
  }

  try {
    const upstreamResponse = await fetch(target, {
      method: request.method,
      headers: {
        ...(request.headers.get("content-type")
          ? { "content-type": request.headers.get("content-type")! }
          : {}),
        ...(request.headers.get("idempotency-key")
          ? { "idempotency-key": request.headers.get("idempotency-key")! }
          : {}),
        // Reenvía exclusivamente la cookie de sesión, reconstruida, nunca el
        // header Cookie original tal cual.
        ...(tokenSesion ? { cookie: `${COOKIE_SESION}=${tokenSesion}` } : {}),
      },
      body: cuerpoPeticion,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const texto = await upstreamResponse.text();
    // 204/205/304 no pueden llevar cuerpo: el constructor de Response lanza si
    // se le pasa uno (incluso vacío).
    const sinCuerpo = [204, 205, 304].includes(upstreamResponse.status);
    const response = new NextResponse(sinCuerpo ? null : texto, {
      status: upstreamResponse.status,
      headers: {
        "content-type":
          upstreamResponse.headers.get("content-type") ?? "application/json",
        "cache-control":
          upstreamResponse.headers.get("cache-control") ?? "no-store",
      },
    });
    // Propaga hacia el navegador solo el Set-Cookie de sdv_personal_session
    // (creación en login o eliminación en logout); descarta cualquier otro.
    for (const setCookie of leerSetCookies(upstreamResponse.headers)) {
      if (setCookie.startsWith(`${COOKIE_SESION}=`)) {
        response.headers.append("set-cookie", setCookie);
      }
    }
    return response;
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { error: "backend no disponible" },
      { status: isTimeout ? 504 : 502 },
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxy(request, path);
}
