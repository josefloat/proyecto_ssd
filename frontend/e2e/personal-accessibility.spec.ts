import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  startPersonalBackendServer,
  startStandaloneServer,
  waitForServer,
} from "./helpers";

const BACKEND_PORT = 4034;
const FRONTEND_PORT = 3137;
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

async function analizar(page: Page, resultados: string[]) {
  const analysis = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  resultados.push(
    ...analysis.violations.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}:${node.target.join(" ")}`),
    ),
  );
}

async function login(page: Page, email: string, password: string) {
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Acceder al sistema" }).click();
}

test("único barrido axe de las pantallas del personal 01–05 (FLOW-7.2 equivalente)", async ({
  page,
}) => {
  const violaciones: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    // window.print abre un diálogo nativo que colgaría la prueba.
    window.print = () => undefined;
  });

  // Login vacío y con error de credenciales
  await page.goto(`${BASE_URL}/personal/login`);
  await analizar(page, violaciones);
  await login(page, "recepcion@senaldevida.pe", "clave-incorrecta");
  await expect(page.locator(".personal-form-error.is-visible")).toBeVisible();
  await analizar(page, violaciones);

  // Agenda con datos
  await login(page, "recepcion@senaldevida.pe", "Recepcion-123");
  await expect(page.getByRole("heading", { name: "Agenda del día" })).toBeVisible();
  await analizar(page, violaciones);

  // Agenda con filtro sin coincidencias (estado vacío)
  await page.getByLabel("Estado de cita").selectOption("NO_ASISTIO");
  await expect(page.getByText(/No hay citas que coincidan/)).toBeVisible();
  await analizar(page, violaciones);
  await page.getByRole("button", { name: "Limpiar filtros" }).click();

  // Detalle → pago → constancia
  await page
    .locator(".agenda-row")
    .filter({ hasText: "Rosa Huamán Quispe" })
    .getByRole("link", { name: /Ver detalle/ })
    .click();
  await expect(page.getByRole("heading", { name: "Rosa Huamán Quispe" })).toBeVisible();
  await analizar(page, violaciones);
  await page.getByRole("button", { name: /Marcar como pagada/ }).click();
  await expect(page.locator(".detalle-estado")).toHaveText("Pagado");
  await page.getByRole("button", { name: /Imprimir constancia/ }).first().click();
  await expect(page.getByRole("region", { name: "Constancia imprimible" })).toBeVisible();
  await analizar(page, violaciones);

  // Agenda del médico (solo lectura)
  await page.goto(`${BASE_URL}/personal/login`);
  await login(page, "medico@senaldevida.pe", "Medico-123");
  await expect(page.getByRole("heading", { name: "Mi agenda" })).toBeVisible();
  await analizar(page, violaciones);

  expect(violaciones).toEqual([]);
});
