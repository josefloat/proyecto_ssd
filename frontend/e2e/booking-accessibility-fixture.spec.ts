import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("el gate detecta nombre ausente y target menor de 48 px (FLOW-5.2)", async ({ page }) => {
  // Arrange: fixture local deliberadamente defectuoso, nunca producción.
  await page.setContent(`
    <main>
      <button style="width:30px;height:30px;background:#eee;color:#eee"></button>
    </main>
  `);

  // Act
  const axe = await new AxeBuilder({ page }).analyze();
  const box = await page.locator("button").boundingBox();

  // Assert
  expect(axe.violations.some((violation) => violation.id === "button-name")).toBe(true);
  expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeLessThan(48);
});
