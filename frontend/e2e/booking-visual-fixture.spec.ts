import { expect, test } from "@playwright/test";

test("una deriva deliberada de la acción cambia el screenshot (FLOW-6.3)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 320 });
  await page.setContent(`
    <style>
      body { margin: 0; background: #f5fafe; font: 20px Arial; }
      main { padding: 24px; }
      button { width: 342px; min-height: 64px; color: white; background: #004d99; border: 0; border-radius: 22px; }
      .drift button { transform: translateX(18px); }
    </style>
    <main><button>Continuar</button></main>
  `);
  const baseline = await page.screenshot({ animations: "disabled" });

  await page.locator("main").evaluate((element) => element.classList.add("drift"));
  const drifted = await page.screenshot({ animations: "disabled" });

  expect(Buffer.compare(baseline, drifted)).not.toBe(0);
});
