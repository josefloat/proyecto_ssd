import { expect, test } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3121;
const BASE_URL = `http://localhost:${PORT}`;
const DATA = {
  items: [
    { id: "11111111-1111-4111-8111-111111111111", nombre: "Medicina General" },
    { id: "22222222-2222-4222-8222-222222222222", nombre: "Cardiología" },
    { id: "33333333-3333-4333-8333-333333333333", nombre: "Pediatría" },
    { id: "44444444-4444-4444-8444-444444444444", nombre: "Traumatología" },
    { id: "55555555-5555-4555-8555-555555555555", nombre: "Ginecología" },
    { id: "66666666-6666-4666-8666-666666666666", nombre: "Dermatología" },
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
  await page.route("**/api/especialidades", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DATA) }),
  );
  await page.goto(`${BASE_URL}/reservar/especialidad?especialidadId=${DATA.items[1].id}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("button", { name: /Cardiología/ })).toHaveAttribute("aria-pressed", "true");
}

test("especialidad desktop fiel a Stitch", async ({ page }) => {
  await preparar(page, 1440, 1280);
  await expect(page).toHaveScreenshot("specialty-desktop.png", { animations: "disabled", caret: "hide", fullPage: true, maxDiffPixelRatio: 0.01 });
});

test("especialidad móvil fiel a Stitch", async ({ page }) => {
  await preparar(page, 390, 844);
  await expect(page).toHaveScreenshot("specialty-mobile.png", { animations: "disabled", caret: "hide", fullPage: false, maxDiffPixelRatio: 0.01 });
});
