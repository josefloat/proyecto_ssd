import express, { type Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import {
  registrarRutasPublicas,
  responderErrorPublico,
} from "./http/public-routes";
import {
  crearServiciosDisponibilidadPublica,
  type ServiciosDisponibilidadPublica,
} from "./services/disponibilidad-publica";

export type AppOptions = Readonly<{
  reloj?: () => Date;
  publicApi?: Partial<ServiciosDisponibilidadPublica>;
}>;

export function createApp(
  database: PrismaClient = prisma,
  options: AppOptions = {},
): Express {
  const app = express();
  const serviciosBase = crearServiciosDisponibilidadPublica(
    database,
    options.reloj,
  );
  const serviciosPublicos: ServiciosDisponibilidadPublica = {
    ...serviciosBase,
    ...options.publicApi,
  };

  // Liveness: nunca toca la base de datos. Es el Health Check Path que
  // usará el proveedor de hosting (ver pipeline-de-despliegue) para no
  // reiniciar la instancia mientras la base de datos duerme.
  app.get("/live", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Readiness: verifica conectividad real a Postgres. Se usa para smoke
  // tests y verificación de disponibilidad, nunca como Health Check Path.
  app.get("/health", async (_req, res) => {
    try {
      await database.$queryRaw`SELECT 1`;
      res.status(200).json({ status: "ok", db: "ok" });
    } catch {
      res.status(503).json({ status: "error", db: "unreachable" });
    }
  });

  registrarRutasPublicas(app, serviciosPublicos);
  app.use(responderErrorPublico);

  return app;
}
