import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function assertPrisma6(manifest: PackageManifest): void {
  const clientVersion = manifest.dependencies?.["@prisma/client"];
  const cliVersion = manifest.devDependencies?.prisma;

  if (!clientVersion?.startsWith("6.") || !cliVersion?.startsWith("6.")) {
    throw new Error("prisma y @prisma/client deben permanecer fijados en 6.x");
  }

  if (clientVersion !== cliVersion) {
    throw new Error("prisma y @prisma/client deben usar la misma versión");
  }
}

describe("pin de versión de Prisma", () => {
  it("acepta el manifiesto real con Prisma 6.x y datasource pooled/direct", async () => {
    const manifest = JSON.parse(
      await readFile("package.json", "utf8"),
    ) as PackageManifest;
    const schema = await readFile("prisma/schema.prisma", "utf8");

    expect(() => assertPrisma6(manifest)).not.toThrow();
    expect(schema).toContain('url       = env("DATABASE_URL")');
    expect(schema).toContain('directUrl = env("DIRECT_URL")');
  });

  it("rechaza un intento de actualizar Prisma a 7.x sin adaptar la configuración", () => {
    expect(() =>
      assertPrisma6({
        dependencies: { "@prisma/client": "7.0.0" },
        devDependencies: { prisma: "7.0.0" },
      }),
    ).toThrow("deben permanecer fijados en 6.x");
  });
});
