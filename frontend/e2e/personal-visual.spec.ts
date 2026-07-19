import { expect, test, type Page } from "@playwright/test";
import {
  startPersonalBackendServer,
  startStandaloneServer,
  waitForServer,
} from "./helpers";

const BACKEND_PORT = 4033;
const FRONTEND_PORT = 3136;
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

test.afterAll(() => {
  frontend.kill();
  backend.kill();
});

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/personal/login`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
}

test("cuatro baselines de personal en escritorio (FLOW visual 4A)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1. Login
  await page.goto(`${BASE_URL}/personal/login`);
  await expect(page.getByRole("button", { name: "Acceder al sistema" })).toBeVisible();
  await expect(page).toHaveScreenshot("login-desktop.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });

  // 2. Agenda de recepción
  await login(page, "recepcion@senaldevida.pe", "Recepcion-123");
  await expect(page.getByRole("heading", { name: "Agenda de los próximos 7 días" })).toBeVisible();
  await expect(page.locator(".agenda-row").nth(1)).toBeVisible();
  await expect(page).toHaveScreenshot("recepcion-agenda-desktop.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });

  // 3. Detalle de cita
  await page
    .locator(".agenda-row")
    .filter({ hasText: "Rosa Huamán Quispe" })
    .getByRole("link", { name: /Ver detalle/ })
    .click();
  await expect(page.getByRole("heading", { name: "Rosa Huamán Quispe" })).toBeVisible();
  await expect(page).toHaveScreenshot("recepcion-detalle-desktop.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("baseline de la agenda del médico en escritorio (FLOW visual 4A)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, "medico@senaldevida.pe", "Medico-123");
  await expect(page.getByRole("heading", { name: "Mi agenda" })).toBeVisible();
  await expect(page.locator(".medico-cita").first()).toBeVisible();
  await expect(page).toHaveScreenshot("medico-agenda-desktop.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});
