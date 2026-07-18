import { PrismaClient, Turno } from "@prisma/client";
import {
  validarCatalogoCanonico,
  validarDuracionCita,
} from "../domain/catalogo";
import { DomainError } from "../domain/errors";
import { hoyEnLima } from "../domain/fechas";
import { HORAS_POR_TURNO } from "../domain/turnos";
import { MotorDisponibilidad } from "../services/motor-disponibilidad";
import { bootstrapAdmin } from "./bootstrap-admin";
import { FIXTURE_SEED, type FixtureSeed } from "./fixture";

const TURNOS_VALIDOS = new Set(Object.values(Turno));

export function validarFixtureSeed(fixture: FixtureSeed): void {
  validarCatalogoCanonico(fixture.especialidades);

  const medicos = new Map(fixture.medicos.map((medico) => [medico.id, medico]));
  const consultorios = new Set(
    fixture.consultorios.map((consultorio) => consultorio.id),
  );
  const especialidades = new Set(
    fixture.especialidades.map((especialidad) => especialidad.id),
  );
  for (const especialidad of fixture.especialidades) {
    validarDuracionCita(especialidad.duracionCitaMinutos);
  }
  for (const medico of fixture.medicos) {
    if (
      !Number.isInteger(medico.horasSemanales) ||
      medico.horasSemanales <= 0 ||
      !especialidades.has(medico.especialidadId)
    ) {
      throw new DomainError("El médico del seed es inválido", "FIXTURE_SEED_INVALIDO");
    }
  }

  const ocupacionMedico = new Set<string>();
  const ocupacionConsultorio = new Set<string>();
  const turnosPorMedico = new Map<string, number>();
  for (const programacion of fixture.programaciones) {
    if (
      !medicos.has(programacion.medicoId) ||
      !consultorios.has(programacion.consultorioId) ||
      !Number.isInteger(programacion.diaSemana) ||
      programacion.diaSemana < 1 ||
      programacion.diaSemana > 7 ||
      !TURNOS_VALIDOS.has(programacion.turno)
    ) {
      throw new DomainError(
        "La programación del seed es inválida",
        "FIXTURE_SEED_INVALIDO",
      );
    }

    const claveMedico = `${programacion.medicoId}:${programacion.diaSemana}:${programacion.turno}`;
    const claveConsultorio = `${programacion.consultorioId}:${programacion.diaSemana}:${programacion.turno}`;
    if (
      ocupacionMedico.has(claveMedico) ||
      ocupacionConsultorio.has(claveConsultorio)
    ) {
      throw new DomainError(
        "El fixture contiene programaciones semanales en conflicto",
        "FIXTURE_SEED_EN_CONFLICTO",
      );
    }
    ocupacionMedico.add(claveMedico);
    ocupacionConsultorio.add(claveConsultorio);
    turnosPorMedico.set(
      programacion.medicoId,
      (turnosPorMedico.get(programacion.medicoId) ?? 0) + 1,
    );
  }

  for (const [medicoId, cantidadTurnos] of turnosPorMedico) {
    if (cantidadTurnos * HORAS_POR_TURNO > medicos.get(medicoId)!.horasSemanales) {
      throw new DomainError(
        "El fixture excede las horas semanales de un médico",
        "FIXTURE_SEED_INVALIDO",
      );
    }
  }
}

export async function ejecutarSeed(
  database: PrismaClient,
  fechaAncla?: string,
  fixture: FixtureSeed = FIXTURE_SEED,
  env: NodeJS.ProcessEnv = process.env,
) {
  validarFixtureSeed(fixture);

  // Bootstrap idempotente del primer administrador. Si faltan las variables
  // de entorno, solo advierte y no crea nada, sin interrumpir el resto del
  // seed (catálogos, programación y horizonte).
  await bootstrapAdmin(database, env);

  await database.$transaction(
    async (tx) => {
      for (const especialidad of fixture.especialidades) {
        await tx.especialidad.upsert({
          where: { id: especialidad.id },
          create: especialidad,
          update: {},
        });
      }
      for (const medico of fixture.medicos) {
        await tx.medico.upsert({
          where: { id: medico.id },
          create: medico,
          update: {},
        });
      }
      for (const consultorio of fixture.consultorios) {
        await tx.consultorio.upsert({
          where: { id: consultorio.id },
          create: consultorio,
          update: {},
        });
      }
      for (const medicoId of new Set(
        fixture.programaciones.map((programacion) => programacion.medicoId),
      )) {
        await tx.revisionProgramacion.upsert({
          where: { medicoId_numero: { medicoId, numero: 1 } },
          create: {
            id: medicoId,
            medicoId,
            numero: 1,
            vigenteDesde: new Date("1970-01-01T00:00:00.000Z"),
          },
          update: {},
        });
      }
      for (const programacion of fixture.programaciones) {
        await tx.programacionSemanal.upsert({
          where: { id: programacion.id },
          create: { ...programacion, revisionId: programacion.medicoId },
          update: {},
        });
      }
    },
    // Neon añade latencia de red por cada upsert. El límite predeterminado de
    // 5 s es insuficiente para el fixture completo, aunque la transacción siga
    // progresando normalmente.
    { timeout: 30_000 },
  );

  const ancla = fechaAncla ?? hoyEnLima();
  return new MotorDisponibilidad(database).asegurarHorizonte(ancla);
}
