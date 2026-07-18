import { expect, test } from "@playwright/test";
import { startPersonalBackendServer, startStandaloneServer, waitForServer } from "./helpers";

const BACKEND_PORT = 4043;
const FRONTEND_PORT = 3143;
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

test("exactamente tres baselines ADMIN desktop: panel, usuarios y programación", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/personal/login`);
  await page.getByLabel("Correo electrónico").fill("admin@senaldevida.pe");
  await page.getByLabel("Contraseña", { exact: true }).fill("Admin-123");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Admin-Visual-2026");
  await page.getByLabel("Confirmar nueva contraseña").fill("Admin-Visual-2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText("Contraseña actualizada")).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill("Admin-Visual-2026");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
  await expect(page.getByRole("heading", { name: "Panel administrativo" })).toBeVisible();
  await expect(page).toHaveScreenshot("admin-dashboard-desktop.png", { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.01 });

  await page.getByRole("link", { name: "Usuarios", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page).toHaveScreenshot("admin-usuarios-desktop.png", { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.01 });

  await page.getByRole("link", { name: "Programación", exact: true }).click();
  await expect(page.locator(".schedule-matrix")).toBeVisible();
  await expect(page).toHaveScreenshot("admin-programacion-desktop.png", { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.01 });
});
