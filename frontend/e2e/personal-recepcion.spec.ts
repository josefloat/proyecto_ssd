import { expect, test } from "@playwright/test";
import {
  startPersonalBackendServer,
  startStandaloneServer,
  waitForServer,
} from "./helpers";

const BACKEND_PORT = 4031;
const FRONTEND_PORT = 3134;
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

test("recepción: login → agenda → detalle → pago → constancia → wa.me (AUTH-1.1, RECEP-1.1, RECEP-2.1)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // window.print abre un diálogo nativo que colgaría la prueba.
    window.print = () => undefined;
  });

  // Login de recepción
  await page.goto(`${BASE_URL}/personal/login`);
  await page.getByLabel("Correo electrónico").fill("recepcion@senaldevida.pe");
  await page.getByLabel("Contraseña").fill("Recepcion-123");
  await page.getByRole("button", { name: "Acceder al sistema" }).click();

  await expect(page).toHaveURL(/\/personal\/recepcion\/agenda$/);
  await expect(page.getByRole("heading", { name: "Agenda de los próximos 7 días" })).toBeVisible();
  const filaRosa = page.locator(".agenda-row").filter({ hasText: "Rosa Huamán Quispe" });
  await expect(filaRosa).toBeVisible();
  await expect(filaRosa.getByText("Pendiente de pago")).toBeVisible();

  // Abrir el detalle de la cita RESERVADA
  await filaRosa.getByRole("link", { name: /Ver detalle/ }).click();
  await expect(page).toHaveURL(/\/personal\/recepcion\/citas\//);
  await expect(page.getByRole("heading", { name: "Rosa Huamán Quispe" })).toBeVisible();
  await expect(page.getByText("DNI: 45812678")).toBeVisible();

  // El enlace de WhatsApp usa el teléfono real (51 + número)
  const whatsapp = page.getByRole("link", { name: /Contactar por WhatsApp/ });
  await expect(whatsapp).toHaveAttribute("href", /wa\.me\/51987654321/);

  // Registrar el pago
  const botonPagar = page.getByRole("button", { name: /Marcar como pagada/ });
  await expect(botonPagar).toBeEnabled();
  await botonPagar.click();
  await expect(page.locator(".detalle-estado")).toHaveText("Pagado");

  // Imprimir constancia: aparece con datos reales
  const botonConstancia = page.getByRole("button", { name: /Imprimir constancia/ }).first();
  await expect(botonConstancia).toBeEnabled();
  await botonConstancia.click();
  const constancia = page.getByRole("region", { name: "Constancia imprimible" });
  await expect(constancia).toBeVisible();
  await expect(constancia.getByText("Rosa Huamán Quispe")).toBeVisible();
  await expect(constancia.getByText("Cardiología")).toBeVisible();
  await expect(constancia.getByText("Dr. Carlos Rojas")).toBeVisible();
  await expect(constancia.getByText(/^SV-/)).toBeVisible();

  // La URL nunca expone credenciales de sesión
  expect(page.url()).not.toMatch(/sdv_personal_session/);
});
