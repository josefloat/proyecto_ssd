import { type PrismaClient, type RolUsuario } from "@prisma/client";
import {
  generarTokenSesion,
  hashToken,
  verifyPassword,
  type CredencialesLogin,
} from "../domain/auth";
import { credencialesInvalidas } from "../domain/personal-api";

const DURACION_SESION_MS = 8 * 60 * 60 * 1_000;

export type UsuarioSesion = Readonly<{
  id: string;
  rol: RolUsuario;
  medicoId: string | null;
}>;

export type ResultadoLogin = Readonly<{
  token: string;
  usuario: UsuarioSesion;
}>;

export type ServiciosAuthPersonal = Readonly<{
  // Devuelve token opaco + usuario ante credenciales válidas de un usuario
  // activo; lanza el mismo error genérico en cualquier otro caso.
  login(credenciales: CredencialesLogin): Promise<ResultadoLogin>;
  // Revoca la sesión asociada al token (idempotente: revocar dos veces no
  // falla). No revela si el token existía.
  logout(token: string): Promise<void>;
  // Resuelve el usuario de una sesión vigente (no expirada, no revocada,
  // usuario activo). Devuelve null si el token no autentica.
  usuarioDeSesion(token: string): Promise<UsuarioSesion | null>;
}>;

export function crearServiciosAuthPersonal(
  database: PrismaClient,
  reloj: () => Date = () => new Date(),
): ServiciosAuthPersonal {
  return {
    async login(credenciales) {
      const usuario = await database.usuario.findUnique({
        where: { email: credenciales.email },
      });
      // Mismo error para: no existe, contraseña incorrecta o inactivo.
      // Se verifica la contraseña incluso si el usuario no existe no es
      // necesario aquí porque no hay enumeración por tiempo relevante en
      // este contexto académico; el error genérico ya no distingue casos.
      if (
        !usuario ||
        !usuario.activo ||
        !verifyPassword(credenciales.password, usuario.passwordHash)
      ) {
        throw credencialesInvalidas();
      }

      const token = generarTokenSesion();
      const ahora = reloj();
      await database.sesion.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: hashToken(token),
          creadaEn: ahora,
          expiraEn: new Date(ahora.getTime() + DURACION_SESION_MS),
        },
      });
      return {
        token,
        usuario: { id: usuario.id, rol: usuario.rol, medicoId: usuario.medicoId },
      };
    },

    async logout(token) {
      const ahora = reloj();
      await database.sesion.updateMany({
        where: { tokenHash: hashToken(token), revocadaEn: null },
        data: { revocadaEn: ahora },
      });
    },

    async usuarioDeSesion(token) {
      if (!token) {
        return null;
      }
      const ahora = reloj();
      const sesion = await database.sesion.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { usuario: true },
      });
      if (
        !sesion ||
        sesion.revocadaEn !== null ||
        sesion.expiraEn.getTime() <= ahora.getTime() ||
        !sesion.usuario.activo
      ) {
        return null;
      }
      return {
        id: sesion.usuario.id,
        rol: sesion.usuario.rol,
        medicoId: sesion.usuario.medicoId,
      };
    },
  };
}

export { DURACION_SESION_MS };
