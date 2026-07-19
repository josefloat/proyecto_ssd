import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("proxy del backend", () => {
  it("expone todos los métodos HTTP usados por la aplicación", () => {
    const route = readFileSync("app/api/[...path]/route.ts", "utf8");

    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      expect(route).toContain(`export async function ${method}(`);
    }
  });
});
