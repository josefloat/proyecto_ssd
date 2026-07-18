import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { startPersonalBackendServer, startStandaloneServer, waitForServer } from "./helpers";

const BACKEND_PORT = 4042;
const FRONTEND_PORT = 3142;
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

async function analizar(page: Page, violaciones: string[]) {
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  violaciones.push(...resultado.violations.flatMap((item) => item.nodes.map((node) => `${item.id}:${node.target.join(" ")}`)));
}

test("único barrido axe ADMIN: clave, panel, usuarios y programación (AUTH-3.2, ADM-3.1, ADM-3.2, PROG-5.2)", async ({ page }) => {
  const violaciones: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/personal/login`);
  await page.getByLabel("Correo electrónico").fill("admin@senaldevida.pe");
  await page.getByLabel("Contraseña", { exact: true }).fill("Admin-123");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
  await analizar(page, violaciones);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Admin-Accesible-2026");
  await page.getByLabel("Confirmar nueva contraseña").fill("Admin-Accesible-2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText("Contraseña actualizada")).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill("Admin-Accesible-2026");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
  await expect(page.getByRole("heading", { name: "Panel administrativo" })).toBeVisible();
  await analizar(page, violaciones);

  await page.getByRole("link", { name: "Usuarios", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await analizar(page, violaciones);
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  await analizar(page, violaciones);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();

  await page.getByRole("link", { name: "Programación", exact: true }).click();
  await expect(page.locator(".schedule-matrix")).toBeVisible();
  await analizar(page, violaciones);
  expect(violaciones).toEqual([]);
});
