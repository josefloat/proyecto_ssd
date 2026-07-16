import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SMOKE_URL = process.env.SMOKE_URL;

test.beforeAll(() => {
  if (!SMOKE_URL) {
    throw new Error("SMOKE_URL debe estar configurada para este smoke test");
  }
});

test("el deployment vivo carga y no tiene violaciones de accesibilidad", async ({
  page,
}) => {
  const response = await page.goto(SMOKE_URL!);

  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
