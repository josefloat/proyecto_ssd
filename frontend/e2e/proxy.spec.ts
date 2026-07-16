import { test, expect } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

test("reenvía exitosamente a un backend alcanzable", async ({ request }) => {
  const port = 3102;
  const server = startStandaloneServer(port, {
    BACKEND_URL: "http://localhost:4001",
  });
  try {
    await waitForServer(`http://localhost:${port}`);
    const res = await request.get(`http://localhost:${port}/api/health`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "ok" });
  } finally {
    server.kill();
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
