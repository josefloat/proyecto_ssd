import { NextRequest, NextResponse } from "next/server";

// BACKEND_URL es server-side (nunca NEXT_PUBLIC_*): el navegador solo
// habla con el origen del frontend, nunca directamente con el backend.
// Un Route Handler (no rewrites()) porque necesitamos controlar la
// respuesta cuando el backend no responde: rewrites() con un destino
// externo devuelve un 500 opaco de Next.js sin poder personalizarlo.
const backendUrl = process.env.BACKEND_URL;
const UPSTREAM_TIMEOUT_MS = 10_000;

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

  try {
    const upstreamResponse = await fetch(target, {
      method: request.method,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await upstreamResponse.text();
    return new NextResponse(body, {
      status: upstreamResponse.status,
      headers: {
        "content-type":
          upstreamResponse.headers.get("content-type") ?? "application/json",
      },
    });
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
