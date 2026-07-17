import { expect, test } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3123;
const BASE_URL = `http://localhost:${PORT}`;
const ESPECIALIDAD_ID = "22222222-2222-4222-8222-222222222222";
const MEDICO_ID = "77777777-7777-4777-8777-777777777777";
const DATA = {
  especialidad: { id: ESPECIALIDAD_ID, nombre: "Cardiología" },
  items: [
    { id: MEDICO_ID, nombre: "Dra. Ana Huamán" },
    { id: "88888888-8888-4888-8888-888888888888", nombre: "Dr. Luis Quispe" },
  ],
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
  await page.route("**/api/especialidades/*/medicos", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DATA) }),
  );
  await page.goto(`${BASE_URL}/reservar/medico?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("button", { name: /Dra. Ana Huamán/ })).toHaveAttribute("aria-pressed", "true");
}

test("médico desktop fiel a Stitch", async ({ page }) => {
  await preparar(page, 1440, 1280);
  await expect(page).toHaveScreenshot("doctor-desktop.png", { animations: "disabled", caret: "hide", fullPage: true, maxDiffPixelRatio: 0.01 });
});

test("médico móvil fiel a Stitch", async ({ page }) => {
  await preparar(page, 390, 844);
  await expect(page).toHaveScreenshot("doctor-mobile.png", { animations: "disabled", caret: "hide", fullPage: false, maxDiffPixelRatio: 0.01 });
});
