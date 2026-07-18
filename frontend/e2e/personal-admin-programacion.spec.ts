import { expect, test } from "@playwright/test";
import { startPersonalBackendServer, startStandaloneServer, waitForServer } from "./helpers";

const BACKEND_PORT = 4041;
const FRONTEND_PORT = 3141;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;
let backend: ReturnType<typeof startPersonalBackendServer>;
let frontend: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  backend = startPersonalBackendServer(BACKEND_PORT);
  await waitForServer(`${BACKEND_URL}/live`, 20_000);
  frontend = startStandaloneServer(FRONTEND_PORT, { BACKEND_URL });
  await waitForServer(BASE_URL, 20_000);
});
test.afterAll(() => { frontend.kill(); backend.kill(); });

test("ADMIN guarda un plan semanal completo con vigencia y datos reales (PROG-4.1, PROG-5.2, SLOT-7.1, ADM-3.1)", async ({ page }) => {
  await page.goto(`${BASE_URL}/personal/login`);
  await page.getByLabel("Correo electrónico").fill("admin@senaldevida.pe");
  await page.getByLabel("Contraseña").fill("Admin-123");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Admin-Programacion-2026");
  await page.getByLabel("Confirmar nueva contraseña").fill("Admin-Programacion-2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText("Contraseña actualizada")).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill("Admin-Programacion-2026");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
  await page.getByRole("link", { name: /Programación semanal/ }).click();
  await expect(page.getByRole("heading", { name: "Programación semanal" })).toBeVisible();
  const opcionMedico = page.getByLabel("Médico").locator("option").filter({ hasText: "Dr. Carlos Rojas" });
  await page.getByLabel("Médico").selectOption((await opcionMedico.getAttribute("value"))!);
  await page.getByLabel("Vigente desde").fill("2026-07-20");
  await page.getByLabel("Lunes, turno Mañana").selectOption({ label: "C-101" });
  await page.getByRole("button", { name: "Guardar plan" }).click();
  await expect(page.getByText(/Programación guardada/)).toBeVisible();
  await expect(page.locator(".schedule-version strong")).toHaveText("2");
});
