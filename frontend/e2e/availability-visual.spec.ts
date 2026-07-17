import { expect, test } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3125;
const BASE_URL = `http://localhost:${PORT}`;
const ESPECIALIDAD_ID = "22222222-2222-4222-8222-222222222222";
const MEDICO_ID = "77777777-7777-4777-8777-777777777777";
const SLOT_ID = "99999999-9999-4999-8999-999999999999";

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

const medico = { id: MEDICO_ID, nombre: "Dra. Ana Huamán" };
const especialidad = { id: ESPECIALIDAD_ID, nombre: "Cardiología" };
const availability = {
  especialidad,
  zonaHoraria: "America/Lima",
  horizonte: { desde: "2026-07-17", hastaExclusiva: "2026-08-14", fechas: Array.from({ length: 28 }, (_, index) => addDays("2026-07-17", index)) },
  items: [
    [SLOT_ID, "2026-07-17T14:00:00.000Z", "2026-07-17T14:30:00.000Z", "Consultorio 101"],
    ["aaaa1111-1111-4111-8111-111111111111", "2026-07-17T16:00:00.000Z", "2026-07-17T16:30:00.000Z", "Consultorio 101"],
    ["aaaa2222-2222-4222-8222-222222222222", "2026-07-17T20:00:00.000Z", "2026-07-17T20:30:00.000Z", "Consultorio 203"],
    ["aaaa3333-3333-4333-8333-333333333333", "2026-07-18T00:00:00.000Z", "2026-07-18T00:30:00.000Z", "Consultorio 203"],
  ].map(([id, inicioUtc, finUtc, nombre]) => ({ id, fechaLima: "2026-07-17", inicioUtc, finUtc, medico, consultorio: { id: `c-${id}`, codigo: "C-101", nombre } })),
};
let server: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});
test.afterAll(() => server.kill());

async function preparar(page: import("@playwright/test").Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.route("**/api/especialidades/*/medicos", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ especialidad, items: [medico] }) }));
  await page.route("**/api/disponibilidad?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(availability) }));
  await page.goto(`${BASE_URL}/reservar/fecha-hora?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}&fechaLima=2026-07-17&slotId=${SLOT_ID}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByLabel("Horario seleccionado")).toBeVisible();
}

test("fecha y hora desktop fiel a Stitch", async ({ page }) => {
  await preparar(page, 1440, 1280);
  await expect(page).toHaveScreenshot("availability-desktop.png", { animations: "disabled", caret: "hide", fullPage: false, maxDiffPixelRatio: 0.01 });
});

test("fecha y hora móvil fiel a Stitch", async ({ page }) => {
  await preparar(page, 390, 844);
  await expect(page).toHaveScreenshot("availability-mobile.png", { animations: "disabled", caret: "hide", fullPage: false, maxDiffPixelRatio: 0.01 });
});
