import { expect, test } from "@playwright/test";
import {
  startPersonalBackendServer,
  startStandaloneServer,
  waitForServer,
} from "./helpers";

const BACKEND_PORT = 4032;
const FRONTEND_PORT = 3135;
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

test("médico: login → agenda propia de solo lectura, sin controles de escritura (MEDICO-1.1, MEDICO-1.2)", async ({
  page,
}) => {
  // Login del médico
  await page.goto(`${BASE_URL}/personal/login`);
  await page.getByLabel("Correo electrónico").fill("medico@senaldevida.pe");
  await page.getByLabel("Contraseña").fill("Medico-123");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();

  await expect(page).toHaveURL(/\/personal\/medico\/agenda$/);
  await expect(page.getByRole("heading", { name: "Mi agenda" })).toBeVisible();
  await expect(page.getByText("Solo lectura")).toBeVisible();

  // Ve sus propios pacientes (Cardiología) y no los del otro médico
  await expect(page.getByText("Rosa Huamán Quispe")).toBeVisible();
  await expect(page.getByText("Carlos Pizarro León")).toBeVisible();
  await expect(page.getByText("Ana García Ríos")).toHaveCount(0);

  // No hay ningún control de escritura ni enlaces a acciones de recepción
  await expect(page.getByRole("button", { name: /Marcar como pagada/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Ver detalle/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /historial/i })).toHaveCount(0);
  // El único botón es cerrar sesión
  const botones = await page.getByRole("button").allInnerTexts();
  expect(botones.join(" ")).toContain("Cerrar sesión");
  expect(botones.join(" ")).not.toMatch(/pagada|guardar|editar/i);
});
