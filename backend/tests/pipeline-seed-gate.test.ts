import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(process.cwd(), "../.github/workflows/ci.yml");
const fixturePath = resolve(process.cwd(), "../scripts/test-seed-deploy-gate.sh");

function bloqueJob(workflow: string, nombre: string, siguiente?: string) {
  const inicio = workflow.indexOf(`  ${nombre}:`);
  const fin = siguiente ? workflow.indexOf(`  ${siguiente}:`, inicio + 1) : workflow.length;
  expect(inicio).toBeGreaterThan(-1);
  expect(fin).toBeGreaterThan(inicio);
  return workflow.slice(inicio, fin);
}

describe("gate de migración y seed", () => {
  it("ordena migrate y seed antes de habilitar ambos despliegues (DP-1.1)", () => {
    // Arrange
    const workflow = readFileSync(workflowPath, "utf8");
    const migrate = bloqueJob(workflow, "migrate", "deploy-render");
    const render = bloqueJob(workflow, "deploy-render", "deploy-vercel");
    const vercel = bloqueJob(workflow, "deploy-vercel");

    // Act
    const migracion = migrate.indexOf("npx prisma migrate deploy");
    const seed = migrate.indexOf("npx prisma db seed");
    const fixture = spawnSync("bash", [fixturePath], { encoding: "utf8" });

    // Assert
    expect(migracion).toBeGreaterThan(-1);
    expect(seed).toBeGreaterThan(migracion);
    expect(render).toMatch(/needs:\s*migrate/);
    expect(vercel).toMatch(/needs:\s*migrate/);
    expect(fixture.status, fixture.stderr).toBe(0);
  });

  it("conserva el camino DIRECT_URL inválida y no permite seed ni deploys (DP-1.2)", () => {
    // Arrange
    const workflow = readFileSync(workflowPath, "utf8");
    const migrate = bloqueJob(workflow, "migrate", "deploy-render");

    // Act
    const indiceMigracion = migrate.indexOf("npx prisma migrate deploy");
    const indiceSeed = migrate.indexOf("npx prisma db seed");

    // Assert
    expect(workflow).toContain("force_invalid_direct_url:");
    expect(workflow).toContain("127.0.0.1:1/invalid?connect_timeout=1");
    expect(indiceMigracion).toBeGreaterThan(-1);
    expect(indiceSeed).toBeGreaterThan(indiceMigracion);
    expect(migrate.slice(indiceMigracion, indiceSeed)).not.toContain(
      "continue-on-error",
    );
  });

  it("usa solo un fixture local para demostrar que el seed fallido bloquea deploys (DP-1.3)", () => {
    // Arrange
    const workflow = readFileSync(workflowPath, "utf8");
    const migrate = bloqueJob(workflow, "migrate", "deploy-render");

    // Act
    const fixture = spawnSync("bash", [fixturePath], { encoding: "utf8" });

    // Assert
    expect(fixture.status, fixture.stderr).toBe(0);
    expect(migrate).toContain("npx prisma db seed");
    expect(migrate).not.toContain("continue-on-error");
    expect(readFileSync(fixturePath, "utf8")).not.toMatch(
      /api\.render\.com|vercel\s+deploy|neon/i,
    );
  });
});
