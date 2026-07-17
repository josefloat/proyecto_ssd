import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { DetalleCita, DisponibilidadResponse } from "../lib/api-types";
import {
  startRealBackendServer,
  startStandaloneServer,
  waitForServer,
} from "./helpers";

const BACKEND_PORT = 4021;
const FRONTEND_PORT = 3131;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;
const CARDIOLOGIA_ID = "10000000-0000-4000-8000-000000000002";
const CARLOS_ID = "20000000-0000-4000-8000-000000000002";
const DNI = "87654321";

let backend: ReturnType<typeof startRealBackendServer>;
let frontend: ReturnType<typeof startStandaloneServer>;
let cita: DetalleCita;

test.beforeAll(async () => {
  backend = startRealBackendServer(BACKEND_PORT);
  await waitForServer(`${BACKEND_URL}/live`, 20_000);
  const disponibilidad = await fetch(
    `${BACKEND_URL}/disponibilidad?especialidadId=${CARDIOLOGIA_ID}&medicoId=${CARLOS_ID}`,
  ).then((response) => response.json() as Promise<DisponibilidadResponse>);
  const slot = disponibilidad.items[0];
  if (!slot) throw new Error("El seed E2E no produjo disponibilidad");
  const reserva = await fetch(`${BACKEND_URL}/citas`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    body: JSON.stringify({
      slotId: slot.id,
      dni: DNI,
      telefono: "912345678",
      nombre: "Rosa Huamán Quispe",
    }),
  });
  if (!reserva.ok) throw new Error(`No se pudo preparar la cita E2E: ${reserva.status}`);
  cita = (await reserva.json()) as DetalleCita;
  frontend = startStandaloneServer(FRONTEND_PORT, { BACKEND_URL });
  await waitForServer(BASE_URL, 20_000);
});

test.afterAll(() => {
  frontend.kill();
  backend.kill();
});

test("home → búsqueda → detalle → cancelación usa solo DNI+código (FLOW-7.1)", async ({ page }) => {
  await page.goto(BASE_URL);
  await page.getByRole("link", { name: "Ver mi cita" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/mi-cita`);
  await page.getByLabel("DNI").fill(DNI);
  await page.getByLabel("Código de reserva").fill(cita.codigoReserva);
  await page.getByRole("button", { name: "Buscar cita" }).click();

  await expect(page.getByRole("heading", { name: "Rosa Huamán Quispe" })).toBeVisible();
  await expect(page.getByText(cita.codigoReserva)).toBeVisible();
  expect(page.url()).toBe(`${BASE_URL}/mi-cita`);

  await page.getByRole("button", { name: "Cancelar cita" }).click();
  await expect(page.getByRole("dialog", { name: "¿Cancelar esta cita?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sí, cancelar cita" })).toBeFocused();
  await page.getByRole("button", { name: "Sí, cancelar cita" }).click();

  await expect(page.getByText("Cita cancelada").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar cita" })).toHaveCount(0);
  await expect(page.getByText("Este horario ya fue liberado.")).toBeVisible();
  expect(page.url()).toBe(`${BASE_URL}/mi-cita`);
});
