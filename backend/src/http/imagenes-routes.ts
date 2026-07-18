import type { NextFunction, Request, Response, Router } from "express";
import { RolUsuario } from "@prisma/client";
import {
  validarClaveImagen,
  validarImagenSitio,
} from "../domain/imagenes-sitio";
import type { ServiciosAuthPersonal } from "../services/auth-personal";
import type { ServiciosImagenesSitio } from "../services/imagenes-sitio";
import { requireSesion } from "./personal-routes";

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

// Rutas de imágenes del sitio: lectura pública (la home y el flujo de
// reserva las consumen sin sesión) y escritura exclusiva del ADMIN.
export function registrarRutasImagenes(
  router: Router,
  servicios: ServiciosImagenesSitio,
  auth: ServiciosAuthPersonal,
): void {
  router.get(
    "/imagenes",
    asyncHandler(async (_request, response) => {
      response.set("Cache-Control", "no-store");
      response.status(200).json({ items: await servicios.listar() });
    }),
  );

  router.put(
    "/personal/admin/imagenes/:clave",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (request, response) => {
      const imagen = await servicios.guardar(
        validarClaveImagen(request.params.clave),
        validarImagenSitio(request.body),
      );
      response.set("Cache-Control", "no-store");
      response.status(200).json({ imagen });
    }),
  );

  router.delete(
    "/personal/admin/imagenes/:clave",
    requireSesion(auth, [RolUsuario.ADMIN]),
    asyncHandler(async (request, response) => {
      await servicios.eliminar(validarClaveImagen(request.params.clave));
      response.status(204).end();
    }),
  );
}
