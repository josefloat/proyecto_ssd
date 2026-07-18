import { test, expect } from "@playwright/test";
import {
  startPersonalBackendServer,
  startStandaloneServer,
  waitForServer,
} from "./helpers";

test("reenvía exitosamente a un backend alcanzable", async ({ request }) => {
  const port = 3102;
  const backendPort = 4036;
  const backend = startPersonalBackendServer(backendPort);
  await waitForServer(`http://localhost:${backendPort}/live`, 20_000);
  const server = startStandaloneServer(port, {
    BACKEND_URL: `http://localhost:${backendPort}`,
  });
  try {
    await waitForServer(`http://localhost:${port}`);
    const res = await request.get(`http://localhost:${port}/api/health`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "ok" });
  } finally {
    server.kill();
    backend.kill();
  }
});

test("responde con error controlado cuando el backend es inexistente", async ({
  request,
}) => {
  const port = 3103;
  const server = startStandaloneServer(port, {
    BACKEND_URL: "http://localhost:59999",
  });
  try {
    await waitForServer(`http://localhost:${port}`);
    const res = await request.get(`http://localhost:${port}/api/health`);
    expect([502, 504]).toContain(res.status());
    const bodyText = await res.text();
    expect(bodyText).not.toContain("59999");
  } finally {
    server.kill();
  }
});

test("responde con error controlado cuando BACKEND_URL no está configurada", async ({
  request,
}) => {
  const port = 3104;
  const server = startStandaloneServer(port, { BACKEND_URL: undefined });
  try {
    await waitForServer(`http://localhost:${port}`);
    const res = await request.get(`http://localhost:${port}/api/health`);
    expect(res.status()).toBe(502);
  } finally {
    server.kill();
  }
});

function setCookiesDe(res: { headersArray(): Array<{ name: string; value: string }> }): string[] {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
}

test("propaga la cookie de sesión en login, request autenticado y logout (Proxy same-origin)", async ({
  request,
}) => {
  const backendPort = 4035;
  const frontPort = 3105;
  const backend = startPersonalBackendServer(backendPort);
  await waitForServer(`http://localhost:${backendPort}/live`, 20_000);
  const server = startStandaloneServer(frontPort, {
    BACKEND_URL: `http://localhost:${backendPort}`,
  });
  const base = `http://localhost:${frontPort}`;
  try {
    await waitForServer(base, 20_000);

    // Login: el proxy propaga el Set-Cookie de sdv_personal_session
    const login = await request.post(`${base}/api/personal/sesion`, {
      data: { email: "recepcion@senaldevida.pe", password: "Recepcion-123" },
      headers: { "content-type": "application/json" },
    });
    expect(login.status()).toBe(200);
    const cookiesLogin = setCookiesDe(login);
    const cookieSesion = cookiesLogin.find((c) => c.startsWith("sdv_personal_session="));
    expect(cookieSesion).toBeTruthy();
    expect(cookieSesion).toContain("HttpOnly");
    expect(cookieSesion).toContain("SameSite=Strict");
    const token = cookieSesion!.split(";")[0].split("=")[1];

    // Request autenticado: reenviar SOLO sdv_personal_session (más una cookie
    // ajena que el proxy debe descartar) autentica correctamente.
    const autenticado = await request.get(`${base}/api/personal/recepcion/agenda`, {
      headers: { cookie: `otra=basura; sdv_personal_session=${token}` },
    });
    expect(autenticado.status()).toBe(200);

    // Logout: el proxy propaga la eliminación de la misma cookie.
    const logout = await request.delete(`${base}/api/personal/sesion`, {
      headers: { cookie: `sdv_personal_session=${token}` },
    });
    expect(logout.status()).toBe(204);
    const cookiesLogout = setCookiesDe(logout);
    expect(
      cookiesLogout.some((c) => c.startsWith("sdv_personal_session=")),
    ).toBe(true);

    // Tras el logout, la misma cookie ya no autentica.
    const trasLogout = await request.get(`${base}/api/personal/recepcion/agenda`, {
      headers: { cookie: `sdv_personal_session=${token}` },
    });
    expect(trasLogout.status()).toBe(401);
  } finally {
    server.kill();
    backend.kill();
  }
});
