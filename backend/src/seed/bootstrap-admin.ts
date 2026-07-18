import { type PrismaClient, RolUsuario } from "@prisma/client";
import { hashPassword, normalizarEmail } from "../domain/auth";

export type ResultadoBootstrapAdmin =
  | { estado: "omitido"; motivo: "variables_ausentes" }
  | { estado: "creado"; email: string }
  | { estado: "ya_existia"; email: string };

// Crea el primer administrador de forma idempotente a partir de las variables
// de entorno. Si faltan, NO falla el seed: registra una advertencia y sigue.
// Si el admin ya existe (por email normalizado), no lo sobrescribe: no resetea
// su contraseña en cada deploy.
export async function bootstrapAdmin(
  database: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResultadoBootstrapAdmin> {
  const emailCrudo = env.SEED_ADMIN_EMAIL;
  const password = env.SEED_ADMIN_PASSWORD;

  if (!emailCrudo || !password) {
    // eslint-disable-next-line no-console
    console.warn(
      "Bootstrap de admin omitido: SEED_ADMIN_EMAIL y/o SEED_ADMIN_PASSWORD ausentes. " +
        "No se creó ningún administrador. Configúralas como GitHub Secrets antes de operar.",
    );
    return { estado: "omitido", motivo: "variables_ausentes" };
  }

  const email = normalizarEmail(emailCrudo);
  const existente = await database.usuario.findUnique({ where: { email } });
  if (existente) {
    return { estado: "ya_existia", email };
  }

  await database.usuario.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      rol: RolUsuario.ADMIN,
      debeCambiarPassword: true,
    },
  });
  return { estado: "creado", email };
}
