import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contrato de contenido de la home", () => {
  it("identifica Ayacucho, la demostración y rechaza datos inventados (HOME-1.3)", () => {
    // Arrange
    const home = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");

    // Act
    const copiaProhibida = ["San Borja", "ratings", "reseñas", "próxima cita"];

    // Assert
    expect(home).toContain("Ayacucho");
    expect(home).toContain("Demostración académica");
    expect(home).toContain("datos ficticios");
    for (const texto of copiaProhibida) {
      expect(home.toLocaleLowerCase("es")).not.toContain(
        texto.toLocaleLowerCase("es"),
      );
    }
  });
});
