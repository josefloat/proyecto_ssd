import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3101;
const BASE_URL = `http://localhost:${PORT}`;

let server: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});

test.afterAll(() => {
  server.kill();
});

test("la home carga con un h1 y sin violaciones de accesibilidad", async ({
  page,
}) => {
  const response = await page.goto(BASE_URL);

  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveText("Señal de Vida");
  await expect(page.locator("main")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
