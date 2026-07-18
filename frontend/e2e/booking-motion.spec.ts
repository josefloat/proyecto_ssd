import { expect, test } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3132;
const BASE_URL = `http://localhost:${PORT}`;
const ID = "22222222-2222-4222-8222-222222222222";
const DATA = { items: [{ id: ID, nombre: "Cardiología" }] };
let server: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});
test.afterAll(() => server.kill());

test("reduced motion conserva contenido, selección y layout final (FLOW-6.2)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-07-17T15:00:00.000Z"));
  await page.route("**/api/especialidades", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DATA) }));

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${BASE_URL}/reservar/especialidad`);
  await page.getByRole("button", { name: "Cardiología" }).click();
  await expect
    .poll(() => page.locator("main.booking-main").evaluate((element) => getComputedStyle(element).transform))
    .toBe("none");
  const normal = await page.locator("main.booking-main").boundingBox();
  const normalCard = await page.getByRole("button", { name: "Cardiología" }).boundingBox();
  await expect(page.getByRole("button", { name: "Cardiología" })).toHaveAttribute("aria-pressed", "true");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE_URL}/reservar/especialidad?especialidadId=${ID}`);
  await expect(page.getByRole("button", { name: "Cardiología" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const reducedTransform = await page.locator("main.booking-main").evaluate((element) => getComputedStyle(element).transform);
  expect(reducedTransform).toBe("none");
  const reduced = await page.locator("main.booking-main").boundingBox();
  const reducedCard = await page.getByRole("button", { name: "Cardiología" }).boundingBox();

  expect(normal).not.toBeNull();
  expect(reduced).not.toBeNull();
  expect(normalCard).not.toBeNull();
  expect(reducedCard).not.toBeNull();
  for (const key of ["x", "y", "width", "height"] as const) {
    // Chromium puede redondear texto y cajas en subpíxeles distintos entre
    // dos contextos de media; 2 px sigue detectando cualquier salto de layout.
    expect(Math.abs((normal?.[key] ?? 0) - (reduced?.[key] ?? 0))).toBeLessThanOrEqual(2);
    expect(Math.abs((normalCard?.[key] ?? 0) - (reducedCard?.[key] ?? 0))).toBeLessThanOrEqual(2);
  }
});
