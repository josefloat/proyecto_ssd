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
import {
  crearServiciosCitasPaciente,
  type GeneradorCodigoReserva,
  type ServiciosCitasPaciente,
} from "./services/citas-paciente";
import {
  crearServiciosAuthPersonal,
  type ServiciosAuthPersonal,
} from "./services/auth-personal";
import {
  crearServiciosAgendaPersonal,
  type ServiciosAgendaPersonal,
} from "./services/agenda-personal";
import {
  registrarRutasPersonal,
  responderErrorPersonal,
} from "./http/personal-routes";

export type AppOptions = Readonly<{
  reloj?: () => Date;
  publicApi?: Partial<ServiciosDisponibilidadPublica>;
  citasApi?: Partial<ServiciosCitasPaciente>;
  authPersonal?: Partial<ServiciosAuthPersonal>;
  agendaPersonal?: Partial<ServiciosAgendaPersonal>;
  generarCodigoReserva?: GeneradorCodigoReserva;
}>;

export function createApp(
  database: PrismaClient = prisma,
  options: AppOptions = {},
): Express {
  const app = express();
  const citasBase = crearServiciosCitasPaciente(
    database,
    options.reloj,
    options.generarCodigoReserva,
  );
  const serviciosCitas: ServiciosCitasPaciente = {
    ...citasBase,
    ...options.citasApi,
  };
  const serviciosBase = crearServiciosDisponibilidadPublica(
    database,
    options.reloj,
    serviciosCitas.aplicarExpiraciones,
  );
  const serviciosPublicos: ServiciosDisponibilidadPublica = {
    ...serviciosBase,
    ...options.publicApi,
  };
  const authBase = crearServiciosAuthPersonal(database, options.reloj);
  const serviciosAuth: ServiciosAuthPersonal = {
    ...authBase,
    ...options.authPersonal,
  };
  const agendaBase = crearServiciosAgendaPersonal(database);
  const serviciosAgenda: ServiciosAgendaPersonal = {
    ...agendaBase,
    ...options.agendaPersonal,
  };

  app.use(express.json({ limit: "16kb" }));

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

  registrarRutasPublicas(app, serviciosPublicos, serviciosCitas);
  registrarRutasPersonal(app, serviciosAuth, serviciosAgenda, options.reloj);
  // El handler de errores del personal corre primero y delega al público
  // cualquier error que no sea PersonalApiError.
  app.use(responderErrorPersonal);
  app.use(responderErrorPublico);

  return app;
}
