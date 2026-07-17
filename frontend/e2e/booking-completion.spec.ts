import { expect, test } from "@playwright/test";
import {
  startRealBackendServer,
  startStandaloneServer,
  waitForServer,
} from "./helpers";

const BACKEND_PORT = 4020;
const FRONTEND_PORT = 3130;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;
const CARDIOLOGIA_ID = "10000000-0000-4000-8000-000000000002";

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

test("slot → datos → confirmación muestra la reserva real (FLOW-4.1)", async ({ page }) => {
  const reservas: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/citas")) {
      reservas.push(request.url());
    }
  });
  await page.goto(`${BASE_URL}/reservar/especialidad`);
  await page.getByRole("button", { name: "Cardiología" }).click();
  await page.getByRole("button", { name: "Elegir especialidad" }).click();
  await page.getByRole("button", { name: /Dr. Carlos Rojas/ }).click();
  await page.getByRole("button", { name: "Elegir médico" }).click();
  await page.locator(".date-card").filter({ hasText: "20" }).first().click();
  await page.locator(".time-slot").first().click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page).toHaveURL(/\/reservar\/datos\?/);
  await expect(page).toHaveURL(new RegExp(`especialidadId=${CARDIOLOGIA_ID}`));
  await expect(page.getByText("Debes pagar antes de que inicie tu cita.")).toBeVisible();
  await expect(page.getByText("El plazo máximo es de 72 horas.")).toBeVisible();
  await expect(page.getByText("Después de confirmar verás la fecha y hora exactas.")).toHaveCount(0);
  await page.getByLabel("DNI (8 números)").fill("12345678");
  await page.getByLabel("Nombre completo").fill("Ana Quispe Huamán");
  await page.getByLabel("Número de celular (9 dígitos)").fill("987654321");
  await page.getByRole("button", { name: "Confirmar cita" }).click();

  await expect(page).toHaveURL(/\/reservar\/confirmacion\?/);
  await expect(page.getByRole("heading", { name: "Tu cita está reservada" })).toBeVisible();
  await expect(page.getByLabel("Código de reserva").locator("strong")).toHaveText(
    /^SV-[A-Z2-9]{8}$/,
  );
  await expect(page.getByText("Pendiente de pago")).toBeVisible();
  await expect(page.getByText("Si no se registra el pago")).toBeVisible();
  expect(page.url()).not.toMatch(/12345678|987654321|SV-/);

  await page.evaluate(() => sessionStorage.removeItem("senal-de-vida:confirmacion-cita"));
  await page.reload();
  await expect(page).toHaveURL(/\/reservar\/datos\?.*aviso=confirmacion-perdida/);
  await expect(page.locator(".lost-confirmation-notice")).toContainText(
    "No intentaremos reservar nuevamente",
  );
  expect(reservas).toHaveLength(1);
});
