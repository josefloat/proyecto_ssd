import type {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";
import { RolUsuario } from "@prisma/client";
import { validarCambioPassword, validarCredencialesLogin } from "../domain/auth";
import {
  validarActualizarPersonal,
  validarCrearPersonal,
  validarIdPersonal,
} from "../domain/administracion-personal";
import {
  validarFechaConsultaProgramacion,
  validarGuardarProgramacion,
  validarMedicoId,
} from "../domain/administracion-programacion";
import { validarFechaAgenda, validarFiltrosAgendaRecepcion } from "../domain/agenda-personal";
import {
  cambioPasswordRequerido,
  noAutenticado,
  noAutorizado,
  PersonalApiError,
  mutacionNoPermitida,
} from "../domain/personal-api";
import { hoyEnLima } from "../domain/fechas";
import type { ServiciosAuthPersonal, UsuarioSesion } from "../services/auth-personal";
import type { ServiciosAgendaPersonal } from "../services/agenda-personal";
import type { ServiciosAdministracionPersonal } from "../services/administracion-personal";
import type { ServiciosAdministracionProgramacion } from "../services/administracion-programacion";

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
// para que los handlers lo usen sin volver a consultar la sesión. Se exporta
// para que otras superficies autenticadas (imagenes-routes) lo reutilicen.
export function requireSesion(
  auth: ServiciosAuthPersonal,
  rolesPermitidos: readonly RolUsuario[],
  permitirCambioPendiente = false,
) {
  return asyncHandler(async (request, response, next) => {
    const usuario = await auth.usuarioDeSesion(leerTokenSesion(request));
    if (!usuario) {
      throw noAutenticado();
    }
    if (usuario.debeCambiarPassword && !permitirCambioPendiente) {
      throw cambioPasswordRequerido();
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
  administracion: ServiciosAdministracionPersonal,
  programacion: ServiciosAdministracionProgramacion,
  reloj: () => Date = () => new Date(),
): void {
  router.post(
    "/personal/sesion",
    asyncHandler(async (request, response) => {
      const credenciales = validarCredencialesLogin(request.body);
      const { token, usuario } = await auth.login(credenciales);
      fijarCookieSesion(response, token);
      response.set("Cache-Control", "no-store");
      response.status(200).json({
        rol: usuario.rol,
        debeCambiarPassword: usuario.debeCambiarPassword,
      });
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
    "/personal/admin/programacion/:medicoId",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (request, response) => {
      const hoy = hoyEnLima(reloj());
      const resultado = await programacion.consultar(
        validarMedicoId(request.params.medicoId),
        validarFechaConsultaProgramacion(
          (request.query as Record<string, unknown>).fechaLima,
          hoy,
        ),
      );
      response.set("Cache-Control", "no-store");
      response.status(200).json(resultado);
    }),
  );

  router.post(
    "/personal/admin/programacion/:medicoId",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (request, response) => {
      const resultado = await programacion.guardar(
        validarMedicoId(request.params.medicoId),
        validarGuardarProgramacion(request.body, hoyEnLima(reloj())),
      );
      response.set("Cache-Control", "no-store");
      response.status(201).json(resultado);
    }),
  );

  router.post(
    "/personal/password",
    requireSesion(
      auth,
      [RolUsuario.ADMIN, RolUsuario.RECEPCIONISTA, RolUsuario.MEDICO],
      true,
    ),
    asyncHandler(async (request, response) => {
      const usuario = usuarioActual(response);
      const cambio = validarCambioPassword(request.body);
      await auth.cambiarPassword(
        usuario.id,
        cambio.passwordActual,
        cambio.passwordNueva,
      );
      limpiarCookieSesion(response);
      response.set("Cache-Control", "no-store");
      response.status(204).end();
    }),
  );

  router.post(
    "/personal/admin/usuarios/:id/password",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (request, response) => {
      const passwordTemporal = await auth.reiniciarPassword(
        validarIdPersonal(request.params.id),
      );
      response.set("Cache-Control", "no-store");
      response.status(200).json({ passwordTemporal });
    }),
  );

  router.get(
    "/personal/admin/usuarios",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (_request, response) => {
      response.set("Cache-Control", "no-store");
      response.status(200).json({ items: await administracion.listar() });
    }),
  );

  router.get(
    "/personal/admin/catalogos",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (_request, response) => {
      response.set("Cache-Control", "no-store");
      response.status(200).json(await administracion.catalogos());
    }),
  );

  router.post(
    "/personal/admin/usuarios",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (request, response) => {
      const resultado = await administracion.crear(
        validarCrearPersonal(request.body),
      );
      response.set("Cache-Control", "no-store");
      response.status(201).json(resultado);
    }),
  );

  router.patch(
    "/personal/admin/usuarios/:id",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (request, response) => {
      const usuario = await administracion.actualizar(
        validarIdPersonal(request.params.id),
        validarActualizarPersonal(request.body),
      );
      response.set("Cache-Control", "no-store");
      response.status(200).json({ usuario });
    }),
  );

  router.delete(
    "/personal/admin/usuarios/:id",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (request, _response) => {
      validarIdPersonal(request.params.id);
      throw mutacionNoPermitida();
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
