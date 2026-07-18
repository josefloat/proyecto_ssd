import { Prisma, PrismaClient } from "@prisma/client";
import type {
  GuardarProgramacionAdmin,
  ItemProgramacionAdmin,
} from "../domain/administracion-programacion";
import {
  fechaCivilDesdePrisma,
  hoyEnLima,
  sumarDias,
  type FechaCivil,
} from "../domain/fechas";
import {
  consultorioNoEncontrado,
  medicoNoEncontrado,
  programacionEnConflicto,
  versionProgramacionObsoleta,
} from "../domain/personal-api";
import { HORAS_POR_TURNO } from "../domain/turnos";
import {
  ADVISORY_LOCK_GENERADOR,
  DIAS_HORIZONTE,
  reconciliarProgramacionEnTransaccion,
} from "./motor-disponibilidad";

type PlanTemporal = {
  medicoId: string;
  numero: number;
  vigenteDesde: FechaCivil;
  items: readonly ItemProgramacionAdmin[];
};

function dtoRevision(revision: {
  numero: number;
  vigenteDesde: Date;
  programaciones: Array<{
    consultorioId: string;
    diaSemana: number;
    turno: ItemProgramacionAdmin["turno"];
  }>;
}) {
  return {
    numero: revision.numero,
    vigenteDesde: fechaCivilDesdePrisma(revision.vigenteDesde),
    items: revision.programaciones
      .map(({ consultorioId, diaSemana, turno }) => ({
        consultorioId,
        diaSemana,
        turno,
      }))
      .sort(
        (a, b) =>
          a.diaSemana - b.diaSemana ||
          a.turno.localeCompare(b.turno) ||
          a.consultorioId.localeCompare(b.consultorioId),
      ),
  };
}

function seleccionarPlan(
  planes: readonly PlanTemporal[],
  medicoId: string,
  punto: FechaCivil,
) {
  return planes
    .filter(
      (plan) => plan.medicoId === medicoId && plan.vigenteDesde <= punto,
    )
    .sort(
      (a, b) =>
        a.vigenteDesde.localeCompare(b.vigenteDesde) || a.numero - b.numero,
    )
    .at(-1);
}

function validarConflictosTemporales(
  existentes: readonly PlanTemporal[],
  candidato: PlanTemporal,
): void {
  const planes = [...existentes, candidato];
  const medicos = [...new Set(planes.map((plan) => plan.medicoId))];
  const puntos = [
    ...new Set(
      planes
        .map((plan) => plan.vigenteDesde)
        .filter((fecha) => fecha >= candidato.vigenteDesde),
    ),
  ].sort();
  for (const punto of puntos) {
    const ocupacion = new Set<string>();
    for (const medicoId of medicos) {
      const aplicable = seleccionarPlan(planes, medicoId, punto);
      if (!aplicable) continue;
      for (const item of aplicable.items) {
        const clave = `${item.consultorioId}:${item.diaSemana}:${item.turno}`;
        if (ocupacion.has(clave)) {
          throw programacionEnConflicto();
        }
        ocupacion.add(clave);
      }
    }
  }
}

export type ServiciosAdministracionProgramacion = ReturnType<
  typeof crearServiciosAdministracionProgramacion
>;

export function crearServiciosAdministracionProgramacion(
  database: PrismaClient,
  reloj: () => Date = () => new Date(),
) {
  return {
    async consultar(medicoId: string, fechaLima: FechaCivil) {
      const medico = await database.medico.findUnique({
        where: { id: medicoId },
        select: {
          id: true,
          nombre: true,
          horasSemanales: true,
          especialidad: { select: { id: true, nombre: true } },
        },
      });
      if (!medico) throw medicoNoEncontrado();
      const revisiones = await database.revisionProgramacion.findMany({
        where: { medicoId },
        orderBy: [{ vigenteDesde: "asc" }, { numero: "asc" }],
        include: { programaciones: true },
      });
      const aplicable = revisiones
        .filter(
          (revision) =>
            fechaCivilDesdePrisma(revision.vigenteDesde) <= fechaLima,
        )
        .at(-1);
      return {
        medico,
        version: revisiones.at(-1)?.numero ?? 0,
        fechaLima,
        revisionAplicable: aplicable ? dtoRevision(aplicable) : null,
        pendientes: revisiones
          .filter(
            (revision) =>
              fechaCivilDesdePrisma(revision.vigenteDesde) > fechaLima,
          )
          .map(dtoRevision),
      };
    },

    async guardar(medicoId: string, input: GuardarProgramacionAdmin) {
      return database.$transaction(
        async (tx) => {
          await tx.$queryRaw<Array<{ locked: number }>>`
            SELECT 1::int AS "locked"
            FROM pg_advisory_xact_lock(${ADVISORY_LOCK_GENERADOR})
          `;
          const medicos = await tx.$queryRaw<
            Array<{ id: string; horasSemanales: number }>
          >`
            SELECT "id", "horasSemanales"
            FROM "Medico"
            WHERE "id" = ${medicoId}::uuid
            FOR UPDATE
          `;
          const medico = medicos[0];
          if (!medico) throw medicoNoEncontrado();

          const consultorios = [...new Set(input.items.map((item) => item.consultorioId))].sort();
          for (const consultorioId of consultorios) {
            const bloqueados = await tx.$queryRaw<Array<{ id: string }>>`
              SELECT "id" FROM "Consultorio"
              WHERE "id" = ${consultorioId}::uuid
              FOR UPDATE
            `;
            if (bloqueados.length === 0) throw consultorioNoEncontrado();
          }

          const version = await tx.revisionProgramacion.aggregate({
            where: { medicoId },
            _max: { numero: true },
          });
          const versionActual = version._max.numero ?? 0;
          if (versionActual !== input.versionBase) {
            throw versionProgramacionObsoleta();
          }
          if (input.items.length * HORAS_POR_TURNO > medico.horasSemanales) {
            throw programacionEnConflicto();
          }

          const revisiones = await tx.revisionProgramacion.findMany({
            orderBy: [{ vigenteDesde: "asc" }, { numero: "asc" }],
            include: { programaciones: true },
          });
          const planes: PlanTemporal[] = revisiones.map((revision) => ({
            medicoId: revision.medicoId,
            numero: revision.numero,
            vigenteDesde: fechaCivilDesdePrisma(revision.vigenteDesde),
            items: revision.programaciones.map(
              ({ consultorioId, diaSemana, turno }) => ({
                consultorioId,
                diaSemana,
                turno,
              }),
            ),
          }));
          const candidato: PlanTemporal = {
            medicoId,
            numero: versionActual + 1,
            vigenteDesde: input.vigenteDesde,
            items: input.items,
          };
          validarConflictosTemporales(planes, candidato);

          const revision = await tx.revisionProgramacion.create({
            data: {
              medicoId,
              numero: candidato.numero,
              vigenteDesde: new Date(`${input.vigenteDesde}T00:00:00.000Z`),
            },
          });
          if (input.items.length > 0) {
            await tx.programacionSemanal.createMany({
              data: input.items.map((item) => ({
                revisionId: revision.id,
                medicoId,
                consultorioId: item.consultorioId,
                diaSemana: item.diaSemana,
                turno: item.turno,
              })),
            });
          }
          const revisionCompleta = await tx.revisionProgramacion.findUniqueOrThrow({
            where: { id: revision.id },
            include: { programaciones: true },
          });
          const hoy = hoyEnLima(reloj());
          const reconciliacion = await reconciliarProgramacionEnTransaccion(
            tx,
            hoy,
            medicoId,
            input.vigenteDesde,
          );
          return {
            revision: dtoRevision(revisionCompleta),
            reconciliacion,
            horizonteHastaExclusiva: sumarDias(hoy, DIAS_HORIZONTE),
          };
        },
        { maxWait: 15_000, timeout: 30_000 },
      );
    },
  };
}
