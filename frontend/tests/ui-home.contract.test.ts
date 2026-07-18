import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contrato de entradas de la home", () => {
  it("activa solo los dos servicios reales y conserva contenido local (HOME-1.2)", () => {
    // Arrange
    const home = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");

    // Act / Assert
    expect(home).toContain('href="/reservar/especialidad"');
    expect(home).toContain('href="/mi-cita"');
    for (const etiqueta of ["Mis citas", "Notifica", "Perfil"]) {
      expect(home).toContain(etiqueta);
    }
    expect((home.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(4);
    for (const prohibido of ["San Borja", "ratings", "reseñas", "http://", "https://"]) {
      expect(home.toLocaleLowerCase("es")).not.toContain(
        prohibido.toLocaleLowerCase("es"),
      );
    }
    expect(home).toContain("Ayacucho");
  });
});
