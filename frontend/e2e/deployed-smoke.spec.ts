import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SMOKE_URL = process.env.SMOKE_URL;
const VERCEL_AUTOMATION_BYPASS_SECRET =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

test.skip(
  !SMOKE_URL || !VERCEL_AUTOMATION_BYPASS_SECRET,
  "El smoke protegido se ejecuta en CI cuando existen URL y bypass de Vercel",
);

test("el preview protegido carga con bypass y no tiene violaciones de accesibilidad", async ({
  page,
}) => {
  const smokeOrigin = new URL(SMOKE_URL!).origin;

  await page.route(`${smokeOrigin}/**`, async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-vercel-protection-bypass": VERCEL_AUTOMATION_BYPASS_SECRET!,
      },
    });
  });

  const response = await page.goto(SMOKE_URL!);

  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
