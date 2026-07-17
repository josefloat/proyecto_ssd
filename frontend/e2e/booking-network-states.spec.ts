import { expect, test } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3120;
const BASE_URL = `http://localhost:${PORT}`;
const ESPECIALIDADES = {
  items: [
    { id: "11111111-1111-4111-8111-111111111111", nombre: "Cardiología" },
    { id: "22222222-2222-4222-8222-222222222222", nombre: "Pediatría" },
  ],
};
let server: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  server = startStandaloneServer(PORT, { BACKEND_URL: "http://localhost:59999" });
  await waitForServer(BASE_URL);
});

test.afterAll(() => server.kill());

test("especialidades vacías no activan datos de maqueta (FLOW-2.2)", async ({ page }) => {
  await page.route("**/api/especialidades", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }),
  );
  await page.goto(`${BASE_URL}/reservar/especialidad`);
  await expect(page.getByRole("heading", { name: "No hay especialidades disponibles" })).toBeVisible();
  await expect(page.locator(".specialty-card")).toHaveCount(0);
  await expect(page.getByText("Corazón / Cardiología")).toHaveCount(0);
});

test("un nombre desconocido conserva el API y usa fallback neutral (FLOW-2.3)", async ({ page }) => {
  await page.route("**/api/especialidades", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [{ id: "33333333-3333-4333-8333-333333333333", nombre: "Medicina intercultural" }] }),
    }),
  );
  await page.goto(`${BASE_URL}/reservar/especialidad`);
  const card = page.getByRole("button", { name: "Medicina intercultural" });
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(/tone-neutral/);
});

test("504/503 transitorios forman una sola preparación y terminan ready (FLOW-3.1)", async ({ page }) => {
  let attempt = 0;
  await page.route("**/api/especialidades", (route) => {
    attempt += 1;
    if (attempt === 1) return route.fulfill({ status: 504, body: "{}" });
    if (attempt === 2) return route.fulfill({ status: 503, body: "{}" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ESPECIALIDADES) });
  });
  await page.goto(`${BASE_URL}/reservar/especialidad`);
  await expect(page.getByRole("heading", { name: "Estamos preparando el sistema" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cardiología" })).toBeVisible({ timeout: 8_000 });
  expect(attempt).toBe(3);
  await expect(page.getByText("backend no disponible")).toHaveCount(0);
});
