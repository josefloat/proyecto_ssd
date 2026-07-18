import { EstadoCita, Prisma, type PrismaClient } from "@prisma/client";
import { fechaCivilDesdePrisma, fechaCivilParaPrisma } from "../domain/fechas";
import {
  citaNoEncontradaPersonal,
  citaNoPagable,
} from "../domain/personal-api";

const incluirAgenda = {
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

type CitaAgenda = Prisma.CitaGetPayload<{ include: typeof incluirAgenda }>;

export type CitaAgendaPersonal = Readonly<{
  id: string;
  codigoReserva: string;
  estado: EstadoCita;
  fechaLima: string;
  inicioUtc: string;
  finUtc: string;
  paciente: Readonly<{ nombre: string; dni: string; telefono: string }>;
  medico: Readonly<{ id: string; nombre: string }>;
  especialidad: Readonly<{ id: string; nombre: string }>;
  consultorio: Readonly<{ id: string; codigo: string; nombre: string }>;
}>;

export type FiltrosAgendaRecepcion = Readonly<{
  fechaLima: string;
  especialidadId?: string;
  medicoId?: string;
  estado?: EstadoCita;
}>;

export type ServiciosAgendaPersonal = Readonly<{
  agendaRecepcion(
    filtros: FiltrosAgendaRecepcion,
  ): Promise<ReadonlyArray<CitaAgendaPersonal>>;
  agendaMedico(
    medicoId: string,
    fechaLima: string,
  ): Promise<ReadonlyArray<CitaAgendaPersonal>>;
  registrarPago(citaId: string): Promise<CitaAgendaPersonal>;
}>;

function aDetalleAgenda(cita: CitaAgenda): CitaAgendaPersonal {
  const { medico, consultorio } = cita.slot.programacionSemanal;
  return {
    id: cita.id,
    codigoReserva: cita.codigoReserva,
    estado: cita.estado,
    fechaLima: fechaCivilDesdePrisma(cita.slot.fechaLima),
    inicioUtc: cita.slot.inicioUtc.toISOString(),
    finUtc: cita.slot.finUtc.toISOString(),
    paciente: {
      nombre: cita.paciente.nombre,
      dni: cita.paciente.dni,
      telefono: cita.paciente.telefono,
    },
    medico: { id: medico.id, nombre: medico.nombre },
    especialidad: {
      id: medico.especialidad.id,
      nombre: medico.especialidad.nombre,
    },
    consultorio: {
      id: consultorio.id,
      codigo: consultorio.codigo,
      nombre: consultorio.nombre,
    },
  };
}

function ordenarAgenda(citas: CitaAgenda[]): CitaAgendaPersonal[] {
  return [...citas]
    .sort((a, b) => {
      const porInicio = a.slot.inicioUtc.getTime() - b.slot.inicioUtc.getTime();
      if (porInicio !== 0) {
        return porInicio;
      }
      return a.slot.programacionSemanal.medico.nombre.localeCompare(
        b.slot.programacionSemanal.medico.nombre,
        "es",
      );
    })
    .map(aDetalleAgenda);
}

export function crearServiciosAgendaPersonal(
  database: PrismaClient,
): ServiciosAgendaPersonal {
  return {
    async agendaRecepcion(filtros) {
      const citas = await database.cita.findMany({
        where: {
          estado: filtros.estado,
          slot: {
            fechaLima: fechaCivilParaPrisma(filtros.fechaLima),
            programacionSemanal: {
              medicoId: filtros.medicoId,
              medico: filtros.especialidadId
                ? { especialidadId: filtros.especialidadId }
                : undefined,
            },
          },
        },
        include: incluirAgenda,
      });
      return ordenarAgenda(citas);
    },

    async agendaMedico(medicoId, fechaLima) {
      const citas = await database.cita.findMany({
        where: {
          slot: {
            fechaLima: fechaCivilParaPrisma(fechaLima),
            programacionSemanal: { medicoId },
          },
        },
        include: incluirAgenda,
      });
      return ordenarAgenda(citas);
    },

    async registrarPago(citaId) {
      return database.$transaction(
        async (tx) => {
          // Escritura condicionada al estado de origen: solo RESERVADA →
          // PAGADA. Dos pagos concurrentes hacen que solo uno afecte la fila
          // (count === 1); el otro ve count === 0 y recibe 409.
          const actualizada = await tx.cita.updateMany({
            where: { id: citaId, estado: EstadoCita.RESERVADA },
            data: { estado: EstadoCita.PAGADA },
          });
          if (actualizada.count !== 1) {
            const existe = await tx.cita.findUnique({
              where: { id: citaId },
              select: { id: true },
            });
            throw existe ? citaNoPagable() : citaNoEncontradaPersonal();
          }
          const cita = await tx.cita.findUnique({
            where: { id: citaId },
            include: incluirAgenda,
          });
          if (!cita) {
            throw citaNoEncontradaPersonal();
          }
          return aDetalleAgenda(cita);
        },
        { maxWait: 15_000, timeout: 30_000 },
      );
    },
  };
}
