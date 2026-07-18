import type { EstadoCita } from "./api-types";

export type RolPersonal = "ADMIN" | "RECEPCIONISTA" | "MEDICO";

export type LoginResponse = Readonly<{ rol: RolPersonal }>;

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

export type AgendaResponse = Readonly<{ items: CitaAgendaPersonal[] }>;

export type FiltrosAgenda = Readonly<{
  especialidadId?: string;
  medicoId?: string;
  estado?: EstadoCita | "";
}>;
