const REQUIRED_ENV_VARS = ["DATABASE_URL"] as const;

export function assertRequiredEnv(env: NodeJS.ProcessEnv = process.env): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !env[name]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `Faltan variables de entorno requeridas: ${missing.join(", ")}. El backend no puede arrancar.`,
    );
    process.exit(1);
  }
}

export const PORT = Number(process.env.PORT ?? 4000);
