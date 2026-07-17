import { expect, test, type Page } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3133;
const BASE_URL = `http://localhost:${PORT}`;
const SLOT_ID = "30000000-0000-4000-8000-000000000098";
const DATA_URL = `${BASE_URL}/reservar/datos?especialidadId=10000000-0000-4000-8000-000000000002&medicoId=20000000-0000-4000-8000-000000000002&fechaLima=2026-07-20&slotId=${SLOT_ID}`;
const detalle = {
  id: "40000000-0000-4000-8000-000000000098",
  codigoReserva: "SV-JKMNPQRS",
  estado: "RESERVADA",
  motivoCancelacion: null,
  reservadaEn: "2026-07-17T15:00:00.000Z",
  venceEn: "2026-07-20T15:00:00.000Z",
  canceladaEn: null,
  paciente: { nombre: "Rosa Huamán Quispe" },
  slot: {
    id: SLOT_ID,
    fechaLima: "2026-07-20",
    inicioUtc: "2026-07-20T14:00:00.000Z",
    finUtc: "2026-07-20T14:30:00.000Z",
    especialidad: { id: "10000000-0000-4000-8000-000000000002", nombre: "Cardiología" },
    medico: { id: "20000000-0000-4000-8000-000000000002", nombre: "Dr. Carlos Rojas" },
    consultorio: { id: "50000000-0000-4000-8000-000000000001", codigo: "C-101", nombre: "Consultorio 101" },
  },
} as const;

let server: ReturnType<typeof startStandaloneServer>;

async function prepararDatos(page: Page) {
  await page.route("**/api/disponibilidad?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      especialidad: detalle.slot.especialidad,
      zonaHoraria: "America/Lima",
      horizonte: { desde: "2026-07-17", hastaExclusiva: "2026-08-14", fechas: ["2026-07-20"] },
      items: [{
        id: SLOT_ID,
        fechaLima: "2026-07-20",
        inicioUtc: detalle.slot.inicioUtc,
        finUtc: detalle.slot.finUtc,
        medico: detalle.slot.medico,
        consultorio: detalle.slot.consultorio,
      }],
    }),
  }));
  await page.goto(DATA_URL);
  await expect(page.getByRole("heading", { name: "Completa tus datos" })).toBeVisible();
  await page.getByLabel("DNI (8 números)").fill("12345678");
  await page.getByLabel("Nombre completo").fill("Rosa Huamán Quispe");
  await page.getByLabel("Número de celular (9 dígitos)").fill("987654321");
  await page.getByRole("heading", { name: "Completa tus datos" }).click();
}

async function prepararDetalle(page: Page) {
  await page.goto(BASE_URL);
  await page.evaluate((payload) => sessionStorage.setItem(
    "senal-de-vida:detalle-mi-cita",
    JSON.stringify({ detalle: payload, dni: "12345678", codigoReserva: payload.codigoReserva }),
  ), detalle);
  await page.goto(`${BASE_URL}/mi-cita`);
  await expect(page.getByRole("heading", { name: "Rosa Huamán Quispe" })).toBeVisible();
}

test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});

test.afterAll(() => server.kill());

test("cuatro baselines globales: datos y detalle, móvil y escritorio", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.setViewportSize({ width: 390, height: 844 });
  await prepararDatos(page);
  await expect(page).toHaveScreenshot("datos-mobile.png", { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.001 });

  await page.setViewportSize({ width: 1280, height: 900 });
  await prepararDatos(page);
  await expect(page).toHaveScreenshot("datos-desktop.png", { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.001 });

  await page.setViewportSize({ width: 390, height: 844 });
  await prepararDetalle(page);
  await expect(page).toHaveScreenshot("detalle-mobile.png", { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.001 });

  await page.setViewportSize({ width: 1280, height: 900 });
  await prepararDetalle(page);
  await expect(page).toHaveScreenshot("detalle-desktop.png", { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.001 });
});
