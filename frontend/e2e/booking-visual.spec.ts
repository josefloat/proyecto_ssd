import { expect, test, type Page } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3131;
const BASE_URL = `http://localhost:${PORT}`;
const ESPECIALIDAD_ID = "22222222-2222-4222-8222-222222222222";
const MEDICO_ID = "77777777-7777-4777-8777-777777777777";
const SLOT_ID = "99999999-9999-4999-8999-999999999999";
const especialidades = {
  items: [
    { id: "11111111-1111-4111-8111-111111111111", nombre: "Medicina General" },
    { id: ESPECIALIDAD_ID, nombre: "Cardiología" },
    { id: "33333333-3333-4333-8333-333333333333", nombre: "Pediatría" },
    { id: "44444444-4444-4444-8444-444444444444", nombre: "Traumatología" },
    { id: "55555555-5555-4555-8555-555555555555", nombre: "Ginecología" },
    { id: "66666666-6666-4666-8666-666666666666", nombre: "Dermatología" },
  ],
};
const medico = { id: MEDICO_ID, nombre: "Dra. Ana Huamán" };
const medicos = { especialidad: especialidades.items[1], items: [medico, { id: "88888888-8888-4888-8888-888888888888", nombre: "Dr. Luis Quispe" }] };
const fechas = Array.from({ length: 28 }, (_, index) => {
  const date = new Date("2026-07-17T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
});
const disponibilidad = {
  especialidad: especialidades.items[1],
  zonaHoraria: "America/Lima",
  horizonte: { desde: fechas[0], hastaExclusiva: "2026-08-14", fechas },
  items: [
    {
      id: SLOT_ID,
      fechaLima: fechas[0],
      inicioUtc: "2026-07-17T14:00:00.000Z",
      finUtc: "2026-07-17T14:30:00.000Z",
      medico,
      consultorio: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", codigo: "C-101", nombre: "Consultorio 101" },
    },
  ],
};

let server: ReturnType<typeof startStandaloneServer>;
test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});
test.afterAll(() => server.kill());

async function instalarApi(page: Page) {
  await page.route("**/api/especialidades", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(especialidades) }));
  await page.route("**/api/especialidades/*/medicos", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(medicos) }));
  await page.route("**/api/disponibilidad?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(disponibilidad) }));
}

async function preparar(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.clock.setFixedTime(new Date("2026-07-17T15:00:00.000Z"));
  await instalarApi(page);
}

async function capturar(page: Page, url: string, name: string) {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    maxDiffPixelRatio: 0.005,
  });
}

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1280 },
]) {
  test(`baselines del flujo y selección — ${viewport.name} (FLOW-6.1)`, async ({ page }) => {
    await preparar(page, viewport.width, viewport.height);
    await capturar(page, BASE_URL, `flow-home-${viewport.name}.png`);
    await capturar(page, `${BASE_URL}/reservar/especialidad?especialidadId=${ESPECIALIDAD_ID}`, `flow-specialty-selected-${viewport.name}.png`);
    await capturar(page, `${BASE_URL}/reservar/medico?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}`, `flow-doctor-selected-${viewport.name}.png`);
    await capturar(page, `${BASE_URL}/reservar/fecha-hora?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}&fechaLima=${fechas[0]}&slotId=${SLOT_ID}`, `flow-availability-selected-${viewport.name}.png`);

    await page.unrouteAll({ behavior: "wait" });
    await page.route("**/api/especialidades", (route) => route.fulfill({ status: 504, contentType: "application/json", body: "{}" }));
    await page.goto(`${BASE_URL}/reservar/especialidad`);
    await expect(page.getByRole("heading", { name: "Estamos preparando el sistema" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`flow-preparing-${viewport.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      maxDiffPixelRatio: 0.005,
    });
  });
}
