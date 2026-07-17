import { EstadoSlot, type PrismaClient } from "@prisma/client";
import { ESPECIALIDADES_CANONICAS } from "../domain/catalogo";
import {
  type FiltrosDisponibilidadPublica,
  medicoNoPerteneceEspecialidad,
  recursoNoEncontrado,
} from "../domain/public-api";
import {
  fechaCivilDesdePrisma,
  fechaCivilParaPrisma,
  hoyEnLima,
  sumarDias,
  ZONA_OPERATIVA,
} from "../domain/fechas";
import { MotorDisponibilidad } from "./motor-disponibilidad";

export type EspecialidadPublica = Readonly<{ id: string; nombre: string }>;
export type MedicoPublico = Readonly<{ id: string; nombre: string }>;

export type RespuestaEspecialidades = Readonly<{
  items: EspecialidadPublica[];
}>;

export type RespuestaMedicos = Readonly<{
  especialidad: EspecialidadPublica;
  items: MedicoPublico[];
}>;

export type SlotPublico = Readonly<{
  id: string;
  fechaLima: string;
  inicioUtc: string;
  finUtc: string;
  medico: MedicoPublico;
  consultorio: Readonly<{
    id: string;
    codigo: string;
    nombre: string;
  }>;
}>;

export type RespuestaDisponibilidad = Readonly<{
  especialidad: EspecialidadPublica;
  zonaHoraria: typeof ZONA_OPERATIVA;
  horizonte: Readonly<{
    desde: string;
    hastaExclusiva: string;
    fechas: string[];
  }>;
  items: SlotPublico[];
}>;

export type ServiciosDisponibilidadPublica = Readonly<{
  listarEspecialidades(): Promise<RespuestaEspecialidades>;
  listarMedicos(especialidadId: string): Promise<RespuestaMedicos>;
  consultarDisponibilidad(
    filtros: FiltrosDisponibilidadPublica,
  ): Promise<RespuestaDisponibilidad>;
}>;

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

export function crearServiciosDisponibilidadPublica(
  database: PrismaClient,
  reloj: () => Date = () => new Date(),
): ServiciosDisponibilidadPublica {
  const motor = new MotorDisponibilidad(database, reloj);

  return {
    async listarEspecialidades() {
      const especialidades = await database.especialidad.findMany({
        select: { id: true, nombre: true },
      });
      const posicionCanonica = new Map(
        ESPECIALIDADES_CANONICAS.map((item, indice) => [item.nombre, indice]),
      );
      especialidades.sort((a, b) => {
        const posicionA = posicionCanonica.get(a.nombre) ?? Number.MAX_SAFE_INTEGER;
        const posicionB = posicionCanonica.get(b.nombre) ?? Number.MAX_SAFE_INTEGER;
        return (
          posicionA - posicionB ||
          compararTexto(a.nombre, b.nombre) ||
          a.id.localeCompare(b.id)
        );
      });
      return { items: especialidades.map(({ id, nombre }) => ({ id, nombre })) };
    },

    async listarMedicos(especialidadId) {
      const especialidad = await database.especialidad.findUnique({
        where: { id: especialidadId },
        select: { id: true, nombre: true },
      });
      if (!especialidad) {
        throw recursoNoEncontrado();
      }
      const medicos = await database.medico.findMany({
        where: { especialidadId },
        select: { id: true, nombre: true },
      });
      medicos.sort(
        (a, b) => compararTexto(a.nombre, b.nombre) || a.id.localeCompare(b.id),
      );
      return {
        especialidad: { id: especialidad.id, nombre: especialidad.nombre },
        items: medicos.map(({ id, nombre }) => ({ id, nombre })),
      };
    },

    async consultarDisponibilidad(filtros) {
      const especialidad = await database.especialidad.findUnique({
        where: { id: filtros.especialidadId },
        select: { id: true, nombre: true },
      });
      if (!especialidad) {
        throw recursoNoEncontrado();
      }

      if (filtros.medicoId) {
        const medico = await database.medico.findUnique({
          where: { id: filtros.medicoId },
          select: { especialidadId: true },
        });
        if (!medico) {
          throw recursoNoEncontrado();
        }
        if (medico.especialidadId !== especialidad.id) {
          throw medicoNoPerteneceEspecialidad();
        }
      }

      const desde = hoyEnLima(reloj());
      const hastaExclusiva = sumarDias(desde, 28);
      await motor.asegurarHorizonte(desde);
      const slots = await database.slot.findMany({
        where: {
          estado: EstadoSlot.LIBRE,
          fechaLima: {
            gte: fechaCivilParaPrisma(desde),
            lt: fechaCivilParaPrisma(hastaExclusiva),
          },
          programacionSemanal: {
            medico: {
              especialidadId: especialidad.id,
              ...(filtros.medicoId ? { id: filtros.medicoId } : {}),
            },
          },
        },
        include: {
          programacionSemanal: {
            include: {
              medico: true,
              consultorio: true,
            },
          },
        },
      });

      const items = slots
        .map((slot) => ({
          id: slot.id,
          fechaLima: fechaCivilDesdePrisma(slot.fechaLima),
          inicioUtc: slot.inicioUtc.toISOString(),
          finUtc: slot.finUtc.toISOString(),
          medico: {
            id: slot.programacionSemanal.medico.id,
            nombre: slot.programacionSemanal.medico.nombre,
          },
          consultorio: {
            id: slot.programacionSemanal.consultorio.id,
            codigo: slot.programacionSemanal.consultorio.codigo,
            nombre: slot.programacionSemanal.consultorio.nombre,
          },
        }))
        .sort(
          (a, b) =>
            a.fechaLima.localeCompare(b.fechaLima) ||
            a.inicioUtc.localeCompare(b.inicioUtc) ||
            compararTexto(a.medico.nombre, b.medico.nombre) ||
            a.id.localeCompare(b.id),
        );

      return {
        especialidad: { id: especialidad.id, nombre: especialidad.nombre },
        zonaHoraria: ZONA_OPERATIVA,
        horizonte: {
          desde,
          hastaExclusiva,
          fechas: Array.from({ length: 28 }, (_, indice) => sumarDias(desde, indice)),
        },
        items,
      };
    },
  };
}
