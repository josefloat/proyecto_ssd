import { expect, test } from "@playwright/test";
import { startPersonalBackendServer, startStandaloneServer, waitForServer } from "./helpers";

const BACKEND_PORT = 4040;
const FRONTEND_PORT = 3140;
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

test("ADMIN rota su temporal y crea/gestiona una cuenta MEDICO real (AUTH-3.1, ADM-1.1, ADM-2.1, ADM-3.1)", async ({ page }) => {
  await page.goto(`${BASE_URL}/personal/login`);
  await page.getByLabel("Correo electrónico").fill("admin@senaldevida.pe");
  await page.getByLabel("Contraseña").fill("Admin-123");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
  await expect(page.getByRole("heading", { name: "Cambia tu contraseña temporal" })).toBeVisible();
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Admin-Nueva-Segura-2026");
  await page.getByLabel("Confirmar nueva contraseña").fill("Admin-Nueva-Segura-2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText("Contraseña actualizada")).toBeVisible();

  await page.getByLabel("Contraseña").fill("Admin-Nueva-Segura-2026");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
  await expect(page).toHaveURL(/\/personal\/admin$/);
  await page.getByRole("link", { name: /Administrar usuarios/ }).click();
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  await page.getByLabel("Rol").selectOption("MEDICO");
  await page.getByLabel("Nombre completo").fill("Dra. Lucía Huamán");
  await page.getByLabel("Correo electrónico").fill("lucia.huaman@senaldevida.pe");
  await page.getByLabel("Especialidad").selectOption({ label: "Cardiología" });
  await page.getByLabel("Horas semanales").fill("12");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  const dialogo = page.getByRole("dialog", { name: /Contraseña temporal de Dra. Lucía Huamán/ });
  await expect(dialogo.getByLabel("Contraseña temporal")).toHaveText(/^[A-Za-z0-9_-]{32}$/);
  await dialogo.getByRole("button", { name: "Ya la guardé" }).click();
  const fila = page.getByRole("row").filter({ hasText: "lucia.huaman@senaldevida.pe" });
  await expect(fila).toContainText("Cardiología");
  await fila.getByRole("button", { name: /Inactivar/ }).click();
  await expect(fila).toContainText("Inactiva");
});
