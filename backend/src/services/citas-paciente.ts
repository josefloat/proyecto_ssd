import { randomInt, randomUUID } from "node:crypto";
import {
  EstadoCita,
  EstadoSlot,
  MotivoCancelacion,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  ALFABETO_CODIGO,
  citaNoCancelable,
  citaNoEncontrada,
  datosPacienteNoCoinciden,
  fingerprintReserva,
  idempotenciaEnConflicto,
  inconsistenciaCita,
  normalizarCodigoReserva,
  slotNoDisponible,
  type CredencialesCita,
  type SolicitudReserva,
} from "../domain/citas";
import { fechaCivilDesdePrisma } from "../domain/fechas";

const HORAS_PARA_PAGAR = 72;
const MAX_REINTENTOS_CODIGO = 5;

const incluirDetalle = {
  paciente: true,
  slot: {
    include: {
      programacionSemanal: {
        include: {
          medico: { include: { especialidad: true } },
          consultorio: true,
        },
      },
    },
  },
} satisfies Prisma.CitaInclude;

type CitaCompleta = Prisma.CitaGetPayload<{ include: typeof incluirDetalle }>;

export type DetalleCitaPublica = Readonly<{
  id: string;
  codigoReserva: string;
  estado: EstadoCita;
  motivoCancelacion: MotivoCancelacion | null;
  reservadaEn: string;
  venceEn: string;
  canceladaEn: string | null;
  paciente: Readonly<{ nombre: string }>;
  slot: Readonly<{
    id: string;
    fechaLima: string;
    inicioUtc: string;
    finUtc: string;
    especialidad: Readonly<{ id: string; nombre: string }>;
    medico: Readonly<{ id: string; nombre: string }>;
    consultorio: Readonly<{ id: string; codigo: string; nombre: string }>;
  }>;
}>;

export type ServiciosCitasPaciente = Readonly<{
  reservar(
    solicitud: SolicitudReserva,
    idempotencyKey: string,
  ): Promise<DetalleCitaPublica>;
  consultar(credenciales: CredencialesCita): Promise<DetalleCitaPublica>;
  cancelar(credenciales: CredencialesCita): Promise<DetalleCitaPublica>;
  aplicarExpiraciones(): Promise<number>;
}>;

export type GeneradorCodigoReserva = () => string;

export function generarCodigoReserva(): string {
  let cuerpo = "";
  for (let indice = 0; indice < 8; indice += 1) {
    cuerpo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  }
  return `SV-${cuerpo}`;
}

function sumarHoras(fecha: Date, horas: number): Date {
  return new Date(fecha.getTime() + horas * 60 * 60 * 1_000);
}

function aDetalle(cita: CitaCompleta): DetalleCitaPublica {
  const { medico, consultorio } = cita.slot.programacionSemanal;
  return {
    id: cita.id,
    codigoReserva: cita.codigoReserva,
    estado: cita.estado,
    motivoCancelacion: cita.motivoCancelacion,
    reservadaEn: cita.reservadaEn.toISOString(),
    venceEn: cita.venceEn.toISOString(),
    canceladaEn: cita.canceladaEn?.toISOString() ?? null,
    paciente: { nombre: cita.paciente.nombre },
    slot: {
      id: cita.slot.id,
      fechaLima: fechaCivilDesdePrisma(cita.slot.fechaLima),
      inicioUtc: cita.slot.inicioUtc.toISOString(),
      finUtc: cita.slot.finUtc.toISOString(),
      especialidad: {
        id: medico.especialidad.id,
        nombre: medico.especialidad.nombre,
      },
      medico: { id: medico.id, nombre: medico.nombre },
      consultorio: {
        id: consultorio.id,
        codigo: consultorio.codigo,
        nombre: consultorio.nombre,
      },
    },
  };
}

function esColisionCodigo(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = JSON.stringify(error.meta?.target ?? "");
  return target.includes("codigoReserva") || target.includes("Cita_codigoReserva_key");
}

async function leerDetalle(
  tx: Prisma.TransactionClient,
  citaId: string,
): Promise<CitaCompleta> {
  const cita = await tx.cita.findUnique({
    where: { id: citaId },
    include: incluirDetalle,
  });
  if (!cita) {
    throw inconsistenciaCita();
  }
  return cita;
}

export async function aplicarExpiracionesVencidas(
  database: PrismaClient,
  ahora: Date,
): Promise<number> {
  return database.$transaction(
    async (tx) => {
      const vencidas = await tx.$queryRaw<Array<{ id: string; slotId: string }>>`
        SELECT "id", "slotId"
        FROM "Cita"
        WHERE "estado" = CAST(${EstadoCita.RESERVADA} AS "EstadoCita")
          AND "venceEn" <= ${ahora}
        ORDER BY "id"
        FOR UPDATE
      `;

      for (const cita of vencidas) {
        const actualizada = await tx.cita.updateMany({
          where: { id: cita.id, estado: EstadoCita.RESERVADA },
          data: {
            estado: EstadoCita.CANCELADA,
            motivoCancelacion: MotivoCancelacion.EXPIRACION,
            canceladaEn: ahora,
          },
        });
        if (actualizada.count !== 1) {
          continue;
        }
        const liberado = await tx.slot.updateMany({
          where: { id: cita.slotId, estado: EstadoSlot.RESERVADO },
          data: { estado: EstadoSlot.LIBRE },
        });
        if (liberado.count !== 1) {
          throw inconsistenciaCita();
        }
      }
      return vencidas.length;
    },
    { maxWait: 15_000, timeout: 30_000 },
  );
}

export function crearServiciosCitasPaciente(
  database: PrismaClient,
  reloj: () => Date = () => new Date(),
  generarCodigo: GeneradorCodigoReserva = generarCodigoReserva,
): ServiciosCitasPaciente {
  const aplicarExpiraciones = () => aplicarExpiracionesVencidas(database, reloj());

  return {
    async reservar(solicitud, idempotencyKey) {
      await aplicarExpiraciones();
      const fingerprint = fingerprintReserva(solicitud);

      for (let intento = 0; intento < MAX_REINTENTOS_CODIGO; intento += 1) {
        const ahora = reloj();
        let codigoReserva: string;
        try {
          codigoReserva = normalizarCodigoReserva(generarCodigo());
        } catch {
          throw inconsistenciaCita();
        }

        try {
          const cita = await database.$transaction(
            async (tx) => {
              await tx.$queryRaw<Array<{ locked: number }>>`
                SELECT 1::int AS "locked"
                FROM pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))
              `;

              const existente = await tx.cita.findUnique({
                where: { idempotencyKey },
                include: incluirDetalle,
              });
              if (existente) {
                if (existente.idempotencyFingerprint !== fingerprint) {
                  throw idempotenciaEnConflicto();
                }
                return existente;
              }

              await tx.$executeRaw`
                INSERT INTO "Paciente" ("id", "dni", "telefono", "nombre")
                VALUES (${randomUUID()}::uuid, ${solicitud.paciente.dni},
                        ${solicitud.paciente.telefono}, ${solicitud.paciente.nombre})
                ON CONFLICT ("dni") DO NOTHING
              `;
              const paciente = await tx.paciente.findUnique({
                where: { dni: solicitud.paciente.dni },
              });
              if (!paciente) {
                throw inconsistenciaCita();
              }
              if (paciente.telefono !== solicitud.paciente.telefono) {
                throw datosPacienteNoCoinciden();
              }

              const reservado = await tx.slot.updateMany({
                where: { id: solicitud.slotId, estado: EstadoSlot.LIBRE },
                data: { estado: EstadoSlot.RESERVADO },
              });
              if (reservado.count !== 1) {
                throw slotNoDisponible();
              }

              const creada = await tx.cita.create({
                data: {
                  pacienteId: paciente.id,
                  slotId: solicitud.slotId,
                  codigoReserva,
                  estado: EstadoCita.RESERVADA,
                  reservadaEn: ahora,
                  venceEn: sumarHoras(ahora, HORAS_PARA_PAGAR),
                  idempotencyKey,
                  idempotencyFingerprint: fingerprint,
                },
                include: incluirDetalle,
              });
              return creada;
            },
            { maxWait: 15_000, timeout: 30_000 },
          );
          return aDetalle(cita);
        } catch (error) {
          if (esColisionCodigo(error) && intento + 1 < MAX_REINTENTOS_CODIGO) {
            continue;
          }
          throw error;
        }
      }
      throw inconsistenciaCita();
    },

    async consultar(credenciales) {
      await aplicarExpiraciones();
      const cita = await database.cita.findFirst({
        where: {
          codigoReserva: credenciales.codigoReserva,
          paciente: { dni: credenciales.dni },
        },
        include: incluirDetalle,
      });
      if (!cita) {
        throw citaNoEncontrada();
      }
      return aDetalle(cita);
    },

    async cancelar(credenciales) {
      await aplicarExpiraciones();
      const ahora = reloj();
      const cita = await database.$transaction(
        async (tx) => {
          const bloqueada = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT c."id"
            FROM "Cita" c
            INNER JOIN "Paciente" p ON p."id" = c."pacienteId"
            WHERE c."codigoReserva" = ${credenciales.codigoReserva}
              AND p."dni" = ${credenciales.dni}
            FOR UPDATE OF c
          `;
          if (bloqueada.length !== 1) {
            throw citaNoEncontrada();
          }

          const actual = await leerDetalle(tx, bloqueada[0].id);
          if (
            actual.estado === EstadoCita.CANCELADA &&
            actual.motivoCancelacion === MotivoCancelacion.PACIENTE
          ) {
            return actual;
          }
          if (
            actual.estado !== EstadoCita.RESERVADA ||
            ahora.getTime() >= actual.slot.inicioUtc.getTime()
          ) {
            throw citaNoCancelable();
          }

          const actualizada = await tx.cita.updateMany({
            where: { id: actual.id, estado: EstadoCita.RESERVADA },
            data: {
              estado: EstadoCita.CANCELADA,
              motivoCancelacion: MotivoCancelacion.PACIENTE,
              canceladaEn: ahora,
            },
          });
          const liberado = await tx.slot.updateMany({
            where: { id: actual.slotId, estado: EstadoSlot.RESERVADO },
            data: { estado: EstadoSlot.LIBRE },
          });
          if (actualizada.count !== 1 || liberado.count !== 1) {
            throw inconsistenciaCita();
          }
          return leerDetalle(tx, actual.id);
        },
        { maxWait: 15_000, timeout: 30_000 },
      );
      return aDetalle(cita);
    },

    aplicarExpiraciones,
  };
}
