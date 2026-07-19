import { expect, test, type Page } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3111;
const BASE_URL = `http://localhost:${PORT}`;
let server: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});

test.afterAll(() => server.kill());

// El mapa de la clínica es un <iframe> de OpenStreetMap: sus teselas llegan
// por red y cambian con el tiempo, así que se corta la petición y se enmascara
// el recuadro para que la baseline no dependa de internet.
async function aislarMapa(page: Page) {
  await page.route("**://*.openstreetmap.org/**", (route) => route.abort());
}

test("captura focalizada de la home real", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1280 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await aislarMapa(page);
  await page.goto(BASE_URL);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveScreenshot("home-focused-desktop.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    mask: [page.locator(".clinic-map")],
    maxDiffPixelRatio: 0.01,
  });
});

test("captura focalizada móvil de la home real", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await aislarMapa(page);
  await page.goto(BASE_URL);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveScreenshot("home-focused-mobile.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    maxDiffPixelRatio: 0.01,
  });
});
