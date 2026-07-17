import type { NextFunction, Request, Response, Router } from "express";
import {
  PublicApiError,
  validarQueryDisponibilidad,
  validarUuidPublico,
} from "../domain/public-api";
import type { ServiciosDisponibilidadPublica } from "../services/disponibilidad-publica";

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

export async function consultarDisponibilidadDesdeQuery(
  query: Readonly<Record<string, unknown>>,
  consultar: ServiciosDisponibilidadPublica["consultarDisponibilidad"],
) {
  const filtros = validarQueryDisponibilidad(query);
  return consultar(filtros);
}

export function registrarRutasPublicas(
  router: Router,
  servicios: ServiciosDisponibilidadPublica,
): void {
  router.get(
    "/especialidades",
    asyncHandler(async (_request, response) => {
      response.status(200).json(await servicios.listarEspecialidades());
    }),
  );

  router.get(
    "/especialidades/:especialidadId/medicos",
    asyncHandler(async (request, response) => {
      const especialidadId = validarUuidPublico(request.params.especialidadId);
      response.status(200).json(await servicios.listarMedicos(especialidadId));
    }),
  );

  router.get(
    "/disponibilidad",
    asyncHandler(async (request, response) => {
      response.set("Cache-Control", "no-store");
      response
        .status(200)
        .json(
          await consultarDisponibilidadDesdeQuery(
            request.query as Record<string, unknown>,
            servicios.consultarDisponibilidad,
          ),
        );
    }),
  );
}

export function responderErrorPublico(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  const publico =
    error instanceof PublicApiError
      ? error
      : new PublicApiError(
          503,
          "SERVICIO_NO_DISPONIBLE",
          "El servicio no está disponible en este momento.",
        );
  response.status(publico.status).json({
    error: {
      code: publico.code,
      message: publico.publicMessage,
    },
  });
}
