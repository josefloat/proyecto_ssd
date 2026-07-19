import { Prisma, PrismaClient, RolUsuario } from "@prisma/client";
import { generarPasswordTemporal, hashPassword } from "../domain/auth";
import type {
  ActualizarPersonalInput,
  CrearPersonalInput,
} from "../domain/administracion-personal";
import { hoyEnLima } from "../domain/fechas";
import {
  cuentaConHistorial,
  emailDuplicado,
  especialidadNoEncontrada,
  horasSemanalesIncompatibles,
  mutacionNoPermitida,
  usuarioNoEncontrado,
} from "../domain/personal-api";
import { HORAS_POR_TURNO } from "../domain/turnos";

type UsuarioBloqueado = {
  id: string;
  rol: RolUsuario;
  medicoId: string | null;
};

function dtoUsuario(usuario: {
  id: string;
  nombre: string | null;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  debeCambiarPassword: boolean;
  medico: null | {
    id: string;
    nombre: string;
    horasSemanales: number;
    especialidad: { id: string; nombre: string };
  };
}) {
  return {
    id: usuario.id,
    nombre: usuario.medico?.nombre ?? usuario.nombre ?? "",
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo,
    debeCambiarPassword: usuario.debeCambiarPassword,
    medico: usuario.medico,
  };
}

async function horasProgramadasAplicables(
  tx: Prisma.TransactionClient,
  medicoId: string,
  hoy: Date,
): Promise<number> {
  const revisiones = await tx.revisionProgramacion.findMany({
    where: { medicoId },
    orderBy: [{ vigenteDesde: "asc" }, { numero: "asc" }],
    include: { _count: { select: { programaciones: true } } },
  });
  const puntos = [
    hoy,
    ...revisiones
      .filter((revision) => revision.vigenteDesde.getTime() > hoy.getTime())
      .map((revision) => revision.vigenteDesde),
  ];
  const aplicables = new Set<string>();
  for (const punto of puntos) {
    const revision = revisiones
      .filter((item) => item.vigenteDesde.getTime() <= punto.getTime())
      .at(-1);
    if (revision) {
      aplicables.add(revision.id);
    }
  }
  return revisiones.reduce(
    (maximo, revision) =>
      aplicables.has(revision.id)
        ? Math.max(maximo, revision._count.programaciones * HORAS_POR_TURNO)
        : maximo,
    0,
  );
}

export type ServiciosAdministracionPersonal = ReturnType<
  typeof crearServiciosAdministracionPersonal
>;

export function crearServiciosAdministracionPersonal(
  database: PrismaClient,
  reloj: () => Date = () => new Date(),
) {
  return {
    async catalogos() {
      const [especialidades, consultorios, medicos] = await Promise.all([
        database.especialidad.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        }),
        database.consultorio.findMany({
          orderBy: { codigo: "asc" },
          select: { id: true, codigo: true, nombre: true },
        }),
        database.medico.findMany({
          orderBy: { nombre: "asc" },
          select: {
            id: true,
            nombre: true,
            horasSemanales: true,
            especialidad: { select: { id: true, nombre: true } },
          },
        }),
      ]);
      return { especialidades, consultorios, medicos };
    },

    async listar() {
      const usuarios = await database.usuario.findMany({
        where: { rol: { in: [RolUsuario.MEDICO, RolUsuario.RECEPCIONISTA] } },
        orderBy: [{ rol: "asc" }, { email: "asc" }],
        include: {
          medico: {
            include: { especialidad: { select: { id: true, nombre: true } } },
          },
        },
      });
      return usuarios.map(dtoUsuario);
    },

    async crear(input: CrearPersonalInput) {
      const passwordTemporal = generarPasswordTemporal();
      try {
        const usuario = await database.$transaction(async (tx) => {
          if (input.rol === RolUsuario.RECEPCIONISTA) {
            return tx.usuario.create({
              data: {
                nombre: input.nombre,
                email: input.email,
                rol: input.rol,
                passwordHash: hashPassword(passwordTemporal),
                debeCambiarPassword: true,
              },
              include: {
                medico: {
                  include: {
                    especialidad: { select: { id: true, nombre: true } },
                  },
                },
              },
            });
          }
          const especialidad = await tx.especialidad.findUnique({
            where: { id: input.especialidadId },
            select: { id: true },
          });
          if (!especialidad) {
            throw especialidadNoEncontrada();
          }
          const medico = await tx.medico.create({
            data: {
              nombre: input.nombre,
              horasSemanales: input.horasSemanales,
              especialidadId: input.especialidadId,
            },
          });
          return tx.usuario.create({
            data: {
              nombre: input.nombre,
              email: input.email,
              rol: input.rol,
              medicoId: medico.id,
              passwordHash: hashPassword(passwordTemporal),
              debeCambiarPassword: true,
            },
            include: {
              medico: {
                include: {
                  especialidad: { select: { id: true, nombre: true } },
                },
              },
            },
          });
        });
        return { usuario: dtoUsuario(usuario), passwordTemporal };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw emailDuplicado();
        }
        throw error;
      }
    },

    async actualizar(usuarioId: string, input: ActualizarPersonalInput) {
      try {
        return await database.$transaction(async (tx) => {
          const filas = await tx.$queryRaw<UsuarioBloqueado[]>`
            SELECT "id", "rol", "medicoId"
            FROM "Usuario"
            WHERE "id" = ${usuarioId}::uuid
            FOR UPDATE
          `;
          const usuario = filas[0];
          if (!usuario) {
            throw usuarioNoEncontrado();
          }
          if (
            usuario.rol === RolUsuario.ADMIN ||
            (usuario.rol === RolUsuario.RECEPCIONISTA &&
              (input.especialidadId !== undefined ||
                input.horasSemanales !== undefined))
          ) {
            throw mutacionNoPermitida();
          }

          if (usuario.medicoId) {
            await tx.$queryRaw`
              SELECT "id" FROM "Medico"
              WHERE "id" = ${usuario.medicoId}::uuid
              FOR UPDATE
            `;
            if (input.especialidadId !== undefined) {
              const [especialidad, actividad] = await Promise.all([
                tx.especialidad.findUnique({
                  where: { id: input.especialidadId },
                  select: { id: true },
                }),
                tx.programacionSemanal.count({
                  where: { medicoId: usuario.medicoId },
                }),
              ]);
              if (!especialidad) {
                throw especialidadNoEncontrada();
              }
              if (actividad > 0) {
                throw mutacionNoPermitida();
              }
            }
            if (input.horasSemanales !== undefined) {
              const requeridas = await horasProgramadasAplicables(
                tx,
                usuario.medicoId,
                new Date(`${hoyEnLima(reloj())}T00:00:00.000Z`),
              );
              if (input.horasSemanales < requeridas) {
                throw horasSemanalesIncompatibles();
              }
            }
            if (
              input.nombre !== undefined ||
              input.especialidadId !== undefined ||
              input.horasSemanales !== undefined
            ) {
              await tx.medico.update({
                where: { id: usuario.medicoId },
                data: {
                  ...(input.nombre === undefined ? {} : { nombre: input.nombre }),
                  ...(input.especialidadId === undefined
                    ? {}
                    : { especialidadId: input.especialidadId }),
                  ...(input.horasSemanales === undefined
                    ? {}
                    : { horasSemanales: input.horasSemanales }),
                },
              });
            }
          }

          const actualizado = await tx.usuario.update({
            where: { id: usuarioId },
            data: {
              ...(input.nombre === undefined ? {} : { nombre: input.nombre }),
              ...(input.email === undefined ? {} : { email: input.email }),
              ...(input.activo === undefined ? {} : { activo: input.activo }),
            },
            include: {
              medico: {
                include: {
                  especialidad: { select: { id: true, nombre: true } },
                },
              },
            },
          });
          if (input.activo !== undefined) {
            await tx.sesion.updateMany({
              where: { usuarioId, revocadaEn: null },
              data: { revocadaEn: reloj() },
            });
          }
          return dtoUsuario(actualizado);
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw emailDuplicado();
        }
        throw error;
      }
    },

    async eliminar(usuarioId: string, adminActualId: string) {
      try {
        await database.$transaction(async (tx) => {
          const filas = await tx.$queryRaw<UsuarioBloqueado[]>`
            SELECT "id", "rol", "medicoId"
            FROM "Usuario"
            WHERE "id" = ${usuarioId}::uuid
            FOR UPDATE
          `;
          const usuario = filas[0];
          if (!usuario) throw usuarioNoEncontrado();
          if (usuario.id === adminActualId || usuario.rol === RolUsuario.ADMIN) {
            throw mutacionNoPermitida();
          }

          if (usuario.medicoId) {
            await tx.$queryRaw`
              SELECT "id" FROM "Medico"
              WHERE "id" = ${usuario.medicoId}::uuid
              FOR UPDATE
            `;
            const [revisiones, programaciones, slots, citas] = await Promise.all([
              tx.revisionProgramacion.count({ where: { medicoId: usuario.medicoId } }),
              tx.programacionSemanal.count({ where: { medicoId: usuario.medicoId } }),
              tx.slot.count({ where: { programacionSemanal: { medicoId: usuario.medicoId } } }),
              tx.cita.count({ where: { slot: { programacionSemanal: { medicoId: usuario.medicoId } } } }),
            ]);
            if (revisiones + programaciones + slots + citas > 0) {
              throw cuentaConHistorial();
            }
          }

          await tx.sesion.deleteMany({ where: { usuarioId } });
          await tx.usuario.delete({ where: { id: usuarioId } });
          if (usuario.medicoId) {
            await tx.medico.delete({ where: { id: usuario.medicoId } });
          }
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          throw cuentaConHistorial();
        }
        throw error;
      }
    },
  };
}
