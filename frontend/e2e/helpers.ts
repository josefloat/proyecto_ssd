import { spawn } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";

const STANDALONE_ENTRY = path.join(
  __dirname,
  "..",
  ".next",
  "standalone",
  "server.js",
);

export function startStandaloneServer(
  port: number,
  env: Record<string, string | undefined> = {},
) {
  const standaloneRoot = path.join(__dirname, "..", ".next", "standalone");
  mkdirSync(path.join(standaloneRoot, ".next"), { recursive: true });
  cpSync(path.join(__dirname, "..", ".next", "static"), path.join(standaloneRoot, ".next", "static"), {
    recursive: true,
  });
  cpSync(path.join(__dirname, "..", "public"), path.join(standaloneRoot, "public"), {
    recursive: true,
  });
  return spawn("node", [STANDALONE_ENTRY], {
    env: { ...process.env, PORT: String(port), HOSTNAME: "localhost", ...env },
    stdio: "pipe",
  });
}

export function startRealBackendServer(port: number) {
  return spawn(
    "npx",
    ["tsx", "tests/helpers/start-public-e2e-server.ts"],
    {
      cwd: path.join(__dirname, "..", "..", "backend"),
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgresql://senal_de_vida:senal_de_vida@localhost:5432/senal_de_vida?schema=public",
        DIRECT_URL:
          process.env.DIRECT_URL ??
          "postgresql://senal_de_vida:senal_de_vida@localhost:5432/senal_de_vida?schema=public",
      },
      stdio: "pipe",
    },
  );
}

export async function waitForServer(url: string, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // todavía no está listo
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`El servidor en ${url} no respondió dentro de ${timeoutMs}ms`);
}
