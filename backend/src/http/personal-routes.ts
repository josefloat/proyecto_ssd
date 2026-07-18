import type {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";
import { RolUsuario } from "@prisma/client";
import { validarCredencialesLogin } from "../domain/auth";
import { validarFechaAgenda, validarFiltrosAgendaRecepcion } from "../domain/agenda-personal";
import {
  noAutenticado,
  noAutorizado,
  PersonalApiError,
} from "../domain/personal-api";
import { hoyEnLima } from "../domain/fechas";
import type { ServiciosAuthPersonal, UsuarioSesion } from "../services/auth-personal";
import type { ServiciosAgendaPersonal } from "../services/agenda-personal";

export const COOKIE_SESION = "sdv_personal_session";
const MAX_AGE_SESION_MS = 8 * 60 * 60 * 1_000;

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

// Lee únicamente la cookie sdv_personal_session del header Cookie; ignora
// cualquier otra cookie presente.
function leerTokenSesion(request: Request): string {
  const header = request.headers.cookie;
  if (!header) {
    return "";
  }
  for (const parte of header.split(";")) {
    const separador = parte.indexOf("=");
    if (separador === -1) {
      continue;
    }
    const nombre = parte.slice(0, separador).trim();
    if (nombre === COOKIE_SESION) {
      return decodeURIComponent(parte.slice(separador + 1).trim());
    }
  }
  return "";
}

function fijarCookieSesion(response: Response, token: string): void {
  response.cookie(COOKIE_SESION, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SESION_MS,
  });
}

function limpiarCookieSesion(response: Response): void {
  // Mismo Path para que el navegador borre exactamente la misma cookie.
  response.clearCookie(COOKIE_SESION, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
  });
}

// Middleware con estado por request: guarda el usuario resuelto en res.locals
// para que los handlers lo usen sin volver a consultar la sesión.
function requireSesion(
  auth: ServiciosAuthPersonal,
  rolesPermitidos: readonly RolUsuario[],
) {
  return asyncHandler(async (request, response, next) => {
    const usuario = await auth.usuarioDeSesion(leerTokenSesion(request));
    if (!usuario) {
      throw noAutenticado();
    }
    if (!rolesPermitidos.includes(usuario.rol)) {
      throw noAutorizado();
    }
    (response.locals as { usuario?: UsuarioSesion }).usuario = usuario;
    next();
  });
}

function usuarioActual(response: Response): UsuarioSesion {
  const usuario = (response.locals as { usuario?: UsuarioSesion }).usuario;
  if (!usuario) {
    throw noAutenticado();
  }
  return usuario;
}

export function registrarRutasPersonal(
  router: Router,
  auth: ServiciosAuthPersonal,
  agenda: ServiciosAgendaPersonal,
  reloj: () => Date = () => new Date(),
): void {
  router.post(
    "/personal/sesion",
    asyncHandler(async (request, response) => {
      const credenciales = validarCredencialesLogin(request.body);
      const { token, usuario } = await auth.login(credenciales);
      fijarCookieSesion(response, token);
      response.status(200).json({ rol: usuario.rol });
    }),
  );

  router.delete(
    "/personal/sesion",
    asyncHandler(async (request, response) => {
      await auth.logout(leerTokenSesion(request));
      limpiarCookieSesion(response);
      response.status(204).end();
    }),
  );

  router.get(
    "/personal/recepcion/agenda",
    requireSesion(auth, [RolUsuario.RECEPCIONISTA]),
    asyncHandler(async (request, response) => {
      const filtros = validarFiltrosAgendaRecepcion(
        request.query as Record<string, unknown>,
        hoyEnLima(reloj()),
      );
      response.set("Cache-Control", "no-store");
      response.status(200).json({ items: await agenda.agendaRecepcion(filtros) });
    }),
  );

  router.post(
    "/personal/recepcion/citas/:id/pago",
    requireSesion(auth, [RolUsuario.RECEPCIONISTA]),
    asyncHandler(async (request, response) => {
      response.set("Cache-Control", "no-store");
      response
        .status(200)
        .json(await agenda.registrarPago(request.params.id));
    }),
  );

  router.get(
    "/personal/medico/agenda",
    requireSesion(auth, [RolUsuario.MEDICO]),
    asyncHandler(async (request, response) => {
      const usuario = usuarioActual(response);
      const fechaLima = validarFechaAgenda(
        (request.query as Record<string, unknown>).fechaLima,
        hoyEnLima(reloj()),
      );
      response.set("Cache-Control", "no-store");
      response.status(200).json({
        items: await agenda.agendaMedico(usuario.medicoId!, fechaLima),
      });
    }),
  );
}

export function responderErrorPersonal(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (!(error instanceof PersonalApiError)) {
    next(error);
    return;
  }
  response.status(error.status).json({
    error: { code: error.code, message: error.publicMessage },
  });
}
