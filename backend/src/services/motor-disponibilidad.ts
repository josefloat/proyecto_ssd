import { randomUUID } from "node:crypto";
import { EstadoSlot, Prisma, PrismaClient } from "@prisma/client";
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

export const DIAS_HORIZONTE = 28;
export const ADVISORY_LOCK_GENERADOR = 7_401_992;

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

type IntervaloEsperado = {
  programacionSemanalId: string;
  medicoId: string;
  consultorioId: string;
  fechaLima: FechaCivil;
  inicioUtc: Date;
  finUtc: Date;
};

async function intervalosAplicables(
  tx: Prisma.TransactionClient,
  desde: FechaCivil,
  dias: number,
  fabricaIntervalos: FabricaIntervalos,
): Promise<IntervaloEsperado[]> {
  const ultimaFecha = sumarDias(desde, dias - 1);
  const revisiones = await tx.revisionProgramacion.findMany({
    where: { vigenteDesde: { lte: fechaCivilParaPrisma(ultimaFecha) } },
    orderBy: [{ medicoId: "asc" }, { vigenteDesde: "asc" }, { numero: "asc" }],
    include: {
      programaciones: true,
      medico: { include: { especialidad: true } },
    },
  });
  const porMedico = new Map<string, typeof revisiones>();
  for (const revision of revisiones) {
    const grupo = porMedico.get(revision.medicoId) ?? [];
    grupo.push(revision);
    porMedico.set(revision.medicoId, grupo);
  }

  const esperados: IntervaloEsperado[] = [];
  for (let indice = 0; indice < dias; indice += 1) {
    const fechaLima = sumarDias(desde, indice);
    for (const grupo of porMedico.values()) {
      const aplicable = grupo
        .filter(
          (revision) =>
            fechaCivilDesdePrisma(revision.vigenteDesde) <= fechaLima,
        )
        .at(-1);
      if (!aplicable) continue;
      for (const programacion of aplicable.programaciones) {
        if (programacion.diaSemana !== diaIso(fechaLima)) continue;
        for (const intervalo of fabricaIntervalos(
          fechaLima,
          programacion.turno,
          aplicable.medico.especialidad.duracionCitaMinutos,
        )) {
          if (intervalo.finUtc.getTime() <= intervalo.inicioUtc.getTime()) {
            throw new DomainError(
              "El intervalo materializado debe tener duración positiva",
              "INTERVALO_INVALIDO",
            );
          }
          esperados.push({
            programacionSemanalId: programacion.id,
            medicoId: programacion.medicoId,
            consultorioId: programacion.consultorioId,
            fechaLima,
            ...intervalo,
          });
        }
      }
    }
  }
  return esperados;
}

function seSolapan(
  a: { inicioUtc: Date; finUtc: Date },
  b: { inicioUtc: Date; finUtc: Date },
): boolean {
  return a.inicioUtc < b.finUtc && b.inicioUtc < a.finUtc;
}

async function materializarIntervalos(
  tx: Prisma.TransactionClient,
  desde: FechaCivil,
  dias: number,
  fabricaIntervalos: FabricaIntervalos,
  reconciliar?: { medicoId: string; desde: FechaCivil },
) {
  const hastaExclusiva = sumarDias(desde, dias);
  const esperados = await intervalosAplicables(tx, desde, dias, fabricaIntervalos);
  let existentes = await tx.slot.findMany({
    where: {
      fechaLima: {
        gte: fechaCivilParaPrisma(desde),
        lt: fechaCivilParaPrisma(hastaExclusiva),
      },
    },
    include: {
      programacionSemanal: {
        select: { medicoId: true, consultorioId: true },
      },
    },
  });
  const clave = (programacionSemanalId: string, inicioUtc: Date) =>
    `${programacionSemanalId}:${inicioUtc.toISOString()}`;

  let eliminados = 0;
  if (reconciliar) {
    const clavesEsperadas = new Set(
      esperados
        .filter(
          (item) =>
            item.medicoId === reconciliar.medicoId &&
            item.fechaLima >= reconciliar.desde,
        )
        .map((item) => clave(item.programacionSemanalId, item.inicioUtc)),
    );
    const obsoletos = existentes.filter(
      (slot) =>
        slot.estado === EstadoSlot.LIBRE &&
        slot.programacionSemanal.medicoId === reconciliar.medicoId &&
        fechaCivilDesdePrisma(slot.fechaLima) >= reconciliar.desde &&
        !clavesEsperadas.has(clave(slot.programacionSemanalId, slot.inicioUtc)),
    );
    if (obsoletos.length > 0) {
      eliminados = (
        await tx.slot.deleteMany({
          where: { id: { in: obsoletos.map((slot) => slot.id) } },
        })
      ).count;
      const ids = new Set(obsoletos.map((slot) => slot.id));
      existentes = existentes.filter((slot) => !ids.has(slot.id));
    }
  }

  const clavesPresentes = new Set(
    existentes.map((slot) => clave(slot.programacionSemanalId, slot.inicioUtc)),
  );
  const ocupados = existentes.filter((slot) => slot.estado !== EstadoSlot.LIBRE);
  let insertados = 0;
  let omitidosPorOcupacion = 0;
  for (const esperado of esperados) {
    if (reconciliar && esperado.fechaLima < reconciliar.desde) continue;
    const claveEsperada = clave(
      esperado.programacionSemanalId,
      esperado.inicioUtc,
    );
    if (clavesPresentes.has(claveEsperada)) continue;
    const solapado = ocupados.some(
      (slot) =>
        (slot.programacionSemanal.medicoId === esperado.medicoId ||
          slot.programacionSemanal.consultorioId === esperado.consultorioId) &&
        seSolapan(slot, esperado),
    );
    if (solapado) {
      omitidosPorOcupacion += 1;
      continue;
    }
    insertados += await tx.$executeRaw`
      INSERT INTO "Slot"
        ("id", "programacionSemanalId", "inicioUtc", "finUtc", "fechaLima", "estado")
      VALUES
        (${randomUUID()}::uuid, ${esperado.programacionSemanalId}::uuid,
         ${esperado.inicioUtc}, ${esperado.finUtc},
         CAST(${esperado.fechaLima} AS date), CAST(${EstadoSlot.LIBRE} AS "EstadoSlot"))
      ON CONFLICT ("programacionSemanalId", "inicioUtc") DO NOTHING
    `;
    clavesPresentes.add(claveEsperada);
  }
  return {
    considerados: esperados.length,
    insertados,
    eliminados,
    omitidosPorOcupacion,
  };
}

export async function reconciliarProgramacionEnTransaccion(
  tx: Prisma.TransactionClient,
  fechaAncla: FechaCivil,
  medicoId: string,
  vigenteDesde: FechaCivil,
  fabricaIntervalos: FabricaIntervalos = crearIntervalosTurno,
) {
  return materializarIntervalos(tx, fechaAncla, DIAS_HORIZONTE, fabricaIntervalos, {
    medicoId,
    desde: vigenteDesde,
  });
}

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
        const resultado = await materializarIntervalos(
          tx,
          desde,
          DIAS_HORIZONTE,
          this.fabricaIntervalos,
        );

        return {
          desde,
          hastaExclusiva,
          considerados: resultado.considerados,
          insertados: resultado.insertados,
        };
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
