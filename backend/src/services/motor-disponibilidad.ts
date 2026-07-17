import { randomUUID } from "node:crypto";
import { EstadoSlot, PrismaClient } from "@prisma/client";
import { DomainError } from "../domain/errors";
import {
  FechaCivil,
  diaIso,
  fechaCivilDesdePrisma,
  fechaCivilParaPrisma,
  hoyEnLima,
  sumarDias,
  validarFechaCivil,
} from "../domain/fechas";
import {
  crearIntervalosTurno,
  type FabricaIntervalos,
} from "../domain/intervalos";

const DIAS_HORIZONTE = 28;
const ADVISORY_LOCK_GENERADOR = 7_401_992;

export type ResultadoHorizonte = Readonly<{
  desde: FechaCivil;
  hastaExclusiva: FechaCivil;
  considerados: number;
  insertados: number;
}>;

export type FiltrosDisponibilidadInterna = Readonly<{
  especialidadId: string;
  medicoId?: string;
  fechaLima: string;
}>;

export class MotorDisponibilidad {
  constructor(
    private readonly database: PrismaClient,
    private readonly reloj: () => Date = () => new Date(),
    private readonly fabricaIntervalos: FabricaIntervalos = crearIntervalosTurno,
  ) {}

  async asegurarHorizonte(fechaAncla?: string): Promise<ResultadoHorizonte> {
    const desde = validarFechaCivil(fechaAncla ?? hoyEnLima(this.reloj()));
    const hastaExclusiva = sumarDias(desde, DIAS_HORIZONTE);

    return this.database.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ locked: number }>>`
          SELECT 1::int AS "locked"
          FROM pg_advisory_xact_lock(${ADVISORY_LOCK_GENERADOR})
        `;
        const programaciones = await tx.programacionSemanal.findMany({
          include: {
            medico: { include: { especialidad: true } },
          },
        });

        let considerados = 0;
        let insertados = 0;
        for (let indice = 0; indice < DIAS_HORIZONTE; indice += 1) {
          const fechaLima = sumarDias(desde, indice);
          const programacionesDelDia = programaciones.filter(
            (programacion) => programacion.diaSemana === diaIso(fechaLima),
          );
          for (const programacion of programacionesDelDia) {
            const intervalos = this.fabricaIntervalos(
              fechaLima,
              programacion.turno,
              programacion.medico.especialidad.duracionCitaMinutos,
            );
            for (const intervalo of intervalos) {
              considerados += 1;
              insertados += await tx.$executeRaw`
                INSERT INTO "Slot"
                  ("id", "programacionSemanalId", "inicioUtc", "finUtc", "fechaLima", "estado")
                VALUES
                  (${randomUUID()}::uuid, ${programacion.id}::uuid,
                   ${intervalo.inicioUtc}, ${intervalo.finUtc},
                   CAST(${fechaLima} AS date), CAST(${EstadoSlot.LIBRE} AS "EstadoSlot"))
                ON CONFLICT ("programacionSemanalId", "inicioUtc") DO NOTHING
              `;
            }
          }
        }

        return { desde, hastaExclusiva, considerados, insertados };
      },
      { maxWait: 15_000, timeout: 30_000 },
    );
  }

  async bloquearSlot(slotId: string): Promise<EstadoSlot> {
    return this.database.$transaction(async (tx) => {
      const actualizado = await tx.slot.updateMany({
        where: { id: slotId, estado: EstadoSlot.LIBRE },
        data: { estado: EstadoSlot.BLOQUEADO },
      });
      if (actualizado.count === 1) {
        return EstadoSlot.BLOQUEADO;
      }

      const slot = await tx.slot.findUnique({ where: { id: slotId } });
      if (!slot) {
        throw new DomainError("El slot no existe", "SLOT_NO_EXISTE");
      }
      if (slot.estado === EstadoSlot.BLOQUEADO) {
        return EstadoSlot.BLOQUEADO;
      }
      throw new DomainError(
        "Un slot reservado no puede bloquearse",
        "SLOT_RESERVADO_EN_CONFLICTO",
      );
    });
  }

  async consultarDisponibilidad(filtros: FiltrosDisponibilidadInterna) {
    const fechaLima = validarFechaCivil(filtros.fechaLima);
    const slots = await this.database.slot.findMany({
      where: {
        estado: EstadoSlot.LIBRE,
        fechaLima: fechaCivilParaPrisma(fechaLima),
        programacionSemanal: {
          medico: {
            especialidadId: filtros.especialidadId,
            ...(filtros.medicoId ? { id: filtros.medicoId } : {}),
          },
        },
      },
      include: {
        programacionSemanal: {
          include: {
            medico: { include: { especialidad: true } },
            consultorio: true,
          },
        },
      },
      orderBy: { inicioUtc: "asc" },
    });

    return slots
      .map((slot) => ({
        id: slot.id,
        inicioUtc: slot.inicioUtc,
        finUtc: slot.finUtc,
        fechaLima: fechaCivilDesdePrisma(slot.fechaLima),
        estado: slot.estado,
        medico: {
          id: slot.programacionSemanal.medico.id,
          nombre: slot.programacionSemanal.medico.nombre,
        },
        especialidad: {
          id: slot.programacionSemanal.medico.especialidad.id,
          nombre: slot.programacionSemanal.medico.especialidad.nombre,
        },
        consultorio: {
          id: slot.programacionSemanal.consultorio.id,
          codigo: slot.programacionSemanal.consultorio.codigo,
        },
      }))
      .sort(
        (a, b) =>
          a.inicioUtc.getTime() - b.inicioUtc.getTime() ||
          a.medico.nombre.localeCompare(b.medico.nombre, "es"),
      );
  }
}
