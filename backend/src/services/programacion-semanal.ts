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

        const turnosAsignados = await tx.programacionSemanal.count({
          where: { medicoId: input.medicoId },
        });
        const horasResultantes = (turnosAsignados + 1) * HORAS_POR_TURNO;
        if (horasResultantes > medico.horasSemanales) {
          throw new DomainError(
            "La programación excede las horas semanales del médico",
            "HORAS_SEMANALES_EXCEDIDAS",
          );
        }

        return tx.programacionSemanal.create({ data: input });
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
