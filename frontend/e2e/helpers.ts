import { spawn } from "node:child_process";
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
  return spawn("node", [STANDALONE_ENTRY], {
    env: { ...process.env, PORT: String(port), HOSTNAME: "localhost", ...env },
    stdio: "pipe",
  });
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
