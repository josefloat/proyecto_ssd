import type { PrismaClient } from "@prisma/client";
import type { ImagenSitioInput } from "../domain/imagenes-sitio";

export type ImagenSitioDto = Readonly<{
  clave: string;
  url: string;
  alt: string;
}>;

export type ServiciosImagenesSitio = Readonly<{
  listar: () => Promise<ImagenSitioDto[]>;
  guardar: (clave: string, datos: ImagenSitioInput) => Promise<ImagenSitioDto>;
  eliminar: (clave: string) => Promise<void>;
}>;

export function crearServiciosImagenesSitio(
  database: PrismaClient,
): ServiciosImagenesSitio {
  return {
    async listar() {
      const filas = await database.imagenSitio.findMany({
        orderBy: { clave: "asc" },
        select: { clave: true, url: true, alt: true },
      });
      return filas;
    },
    async guardar(clave, datos) {
      const fila = await database.imagenSitio.upsert({
        where: { clave },
        create: { clave, ...datos },
        update: datos,
        select: { clave: true, url: true, alt: true },
      });
      return fila;
    },
    async eliminar(clave) {
      await database.imagenSitio.deleteMany({ where: { clave } });
    },
  };
}
