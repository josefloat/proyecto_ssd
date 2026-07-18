import { Prisma, PrismaClient, Turno } from "@prisma/client";
import { DomainError } from "../domain/errors";
import { HORAS_POR_TURNO } from "../domain/turnos";

export type CrearProgramacionInput = Readonly<{
  medicoId: string;
  consultorioId: string;
  diaSemana: number;
  turno: Turno;
}>;

function validarDiaIso(diaSemana: number): void {
  if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 7) {
    throw new DomainError(
      "El día de semana debe usar el rango ISO 1..7",
      "DIA_SEMANA_INVALIDO",
    );
  }
}

export async function crearProgramacionSemanal(
  database: PrismaClient,
  input: CrearProgramacionInput,
) {
  validarDiaIso(input.diaSemana);

  try {
    return await database.$transaction(
      async (tx) => {
        const medicos = await tx.$queryRaw<
          Array<{ id: string; horasSemanales: number }>
        >`
          SELECT "id", "horasSemanales"
          FROM "Medico"
          WHERE "id" = ${input.medicoId}::uuid
          FOR UPDATE
        `;
        const medico = medicos[0];
        if (!medico) {
          throw new DomainError("El médico no existe", "MEDICO_NO_EXISTE");
        }

        const revision = await tx.revisionProgramacion.upsert({
          where: { medicoId_numero: { medicoId: input.medicoId, numero: 1 } },
          create: {
            id: input.medicoId,
            medicoId: input.medicoId,
            numero: 1,
            vigenteDesde: new Date("1970-01-01T00:00:00.000Z"),
          },
          update: {},
        });

        const turnosAsignados = await tx.programacionSemanal.count({
          where: { revisionId: revision.id },
        });
        const horasResultantes = (turnosAsignados + 1) * HORAS_POR_TURNO;
        if (horasResultantes > medico.horasSemanales) {
          throw new DomainError(
            "La programación excede las horas semanales del médico",
            "HORAS_SEMANALES_EXCEDIDAS",
          );
        }

        const conflicto = await tx.programacionSemanal.findFirst({
          where: {
            diaSemana: input.diaSemana,
            turno: input.turno,
            OR: [
              { revisionId: revision.id },
              { consultorioId: input.consultorioId },
            ],
          },
          select: { id: true },
        });
        if (conflicto) {
          throw new DomainError(
            "El médico o consultorio ya está ocupado en ese día y turno",
            "PROGRAMACION_EN_CONFLICTO",
          );
        }

        return tx.programacionSemanal.create({
          data: { ...input, revisionId: revision.id },
        });
      },
      { maxWait: 10_000, timeout: 15_000 },
    );
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DomainError(
        "El médico o consultorio ya está ocupado en ese día y turno",
        "PROGRAMACION_EN_CONFLICTO",
      );
    }
    throw error;
  }
}
