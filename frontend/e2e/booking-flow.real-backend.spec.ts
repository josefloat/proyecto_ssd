import { expect, test } from "@playwright/test";
import {
  startRealBackendServer,
  startStandaloneServer,
  waitForServer,
} from "./helpers";

const BACKEND_PORT = 4010;
const FRONTEND_PORT = 3126;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;
const CARDIOLOGIA_ID = "10000000-0000-4000-8000-000000000002";
const CARLOS_ID = "20000000-0000-4000-8000-000000000002";

let backend: ReturnType<typeof startRealBackendServer>;
let frontend: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  backend = startRealBackendServer(BACKEND_PORT);
  await waitForServer(`${BACKEND_URL}/live`, 20_000);
  frontend = startStandaloneServer(FRONTEND_PORT, { BACKEND_URL });
  await waitForServer(BASE_URL, 20_000);
});

test.afterAll(() => {
  frontend.kill();
  backend.kill();
});

test("flujo real conserva URL, recarga, atrás y nunca escribe (FLOW-1.1/FLOW-2.1/FLOW-4.1)", async ({ page }) => {
  // Arrange
  const domainRequests: Array<{ method: string; url: string }> = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) {
      domainRequests.push({ method: request.method(), url: request.url() });
    }
  });

  // Act: home -> especialidad
  await page.goto(BASE_URL);
  await page.getByRole("link", { name: "Sacar una cita" }).click();
  await expect(page.getByRole("button", { name: "Cardiología" })).toBeVisible();
  await page.getByRole("button", { name: "Cardiología" }).click();
  await expect(page).toHaveURL(new RegExp(`especialidadId=${CARDIOLOGIA_ID}`));
  await page.getByRole("button", { name: "Elegir especialidad" }).click();

  // Act: médico
  await expect(page.getByRole("button", { name: /Dr. Carlos Rojas/ })).toBeVisible();
  await page.getByRole("button", { name: /Dr. Carlos Rojas/ }).click();
  await expect(page).toHaveURL(new RegExp(`medicoId=${CARLOS_ID}`));
  await page.getByRole("button", { name: "Elegir médico" }).click();

  // Act: fecha, slot y recarga
  await expect(page.locator(".date-card")).toHaveCount(28);
  await page.locator(".date-card").filter({ hasText: "20" }).first().click();
  await expect(page).toHaveURL(/fechaLima=2026-07-20/);
  const primerSlot = page.locator(".time-slot").first();
  await expect(primerSlot).toBeVisible();
  await primerSlot.click();
  await expect(page).toHaveURL(/slotId=/);
  const urlSeleccionada = page.url();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
  await expect(page.getByText("Este horario todavía no está reservado")).toBeVisible();
  await page.reload();

  // Assert: revalidación y navegación atrás conservan contexto
  await expect(page).toHaveURL(urlSeleccionada);
  await expect(page.getByLabel("Horario seleccionado")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/reservar/medico\\?especialidadId=${CARDIOLOGIA_ID}&medicoId=${CARLOS_ID}`));
  await expect(page.getByRole("button", { name: /Dr. Carlos Rojas/ })).toHaveAttribute("aria-pressed", "true");

  expect(
    domainRequests.filter(({ method }) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(method),
    ),
  ).toEqual([]);
  expect(domainRequests.some(({ url }) => url.endsWith("/api/especialidades"))).toBe(true);
  expect(domainRequests.some(({ url }) => url.includes("/api/disponibilidad"))).toBe(true);
});
