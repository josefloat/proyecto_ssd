import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();

describe("contrato de assets locales", () => {
  it("usa Atkinson Hyperlegible y la ilustración desde archivos versionados (HOME-1.3/FLOW-6.3)", () => {
    // Arrange
    const layout = readFileSync(join(raiz, "app/layout.tsx"), "utf8");
    const home = readFileSync(join(raiz, "app/page.tsx"), "utf8");
    const font = join(
      raiz,
      "app/fonts/atkinson-hyperlegible-next-latin-ext.woff2",
    );
    const ilustracion = join(raiz, "public/images/profesionales-ayacucho.png");

    // Act
    const fuentesRemotas = /https?:\/\//i.test(layout);
    const imagenesRemotas = /https?:\/\//i.test(home);

    // Assert
    expect(layout).toContain('from "next/font/local"');
    expect(layout).toContain("atkinson-hyperlegible-next-latin-ext.woff2");
    expect(home).toContain('/images/profesionales-ayacucho.png');
    expect(fuentesRemotas).toBe(false);
    expect(imagenesRemotas).toBe(false);
    expect(statSync(font).size).toBeGreaterThan(10_000);
    expect(statSync(ilustracion).size).toBeGreaterThan(100_000);
  });
});
