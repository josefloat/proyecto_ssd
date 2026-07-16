import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("migraciones de Prisma", () => {
  it("detecta un cambio de schema que no tiene migración", async () => {
    const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
    const fixtureDirectory = await mkdtemp(join(tmpdir(), "senal-de-vida-drift-"));
    const fixtureSchemaPath = join(fixtureDirectory, "schema.prisma");
    const originalSchema = await readFile(schemaPath, "utf8");

    await writeFile(
      fixtureSchemaPath,
      `${originalSchema}\nmodel UnmigratedSchemaProbe {\n  id Int @id\n}\n`,
    );

    try {
      const result = await execFileAsync(
        join(process.cwd(), "node_modules", ".bin", "prisma"),
        [
          "migrate",
          "diff",
          "--from-schema-datasource",
          schemaPath,
          "--to-schema-datamodel",
          fixtureSchemaPath,
          "--exit-code",
        ],
        { env: process.env },
      ).then(
        () => ({ exitCode: 0 }),
        (error: { code?: number }) => ({ exitCode: error.code }),
      );

      expect(result.exitCode).toBe(2);
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });
});
