import type { EstadoCita } from "./api-types";

export type RolPersonal = "ADMIN" | "RECEPCIONISTA" | "MEDICO";

export type LoginResponse = Readonly<{
  rol: RolPersonal;
  debeCambiarPassword: boolean;
}>;

export type UsuarioAdmin = Readonly<{
  id: string;
  nombre: string;
  email: string;
  rol: "MEDICO" | "RECEPCIONISTA";
  activo: boolean;
  debeCambiarPassword: boolean;
  medico: null | Readonly<{
    id: string;
    nombre: string;
    horasSemanales: number;
    especialidad: Readonly<{ id: string; nombre: string }>;
  }>;
}>;

export type CatalogosAdmin = Readonly<{
  especialidades: ReadonlyArray<Readonly<{ id: string; nombre: string }>>;
  consultorios: ReadonlyArray<Readonly<{ id: string; codigo: string; nombre: string }>>;
  medicos: ReadonlyArray<Readonly<{
    id: string;
    nombre: string;
    horasSemanales: number;
    especialidad: Readonly<{ id: string; nombre: string }>;
  }>>;
}>;

export type ItemProgramacionAdmin = Readonly<{
  consultorioId: string;
  diaSemana: number;
  turno: "MANANA" | "TARDE" | "NOCHE";
}>;

export type RevisionProgramacionAdmin = Readonly<{
  numero: number;
  vigenteDesde: string;
  items: ReadonlyArray<ItemProgramacionAdmin>;
}>;

export type ProgramacionAdmin = Readonly<{
  medico: CatalogosAdmin["medicos"][number];
  version: number;
  fechaLima: string;
  revisionAplicable: RevisionProgramacionAdmin | null;
  pendientes: ReadonlyArray<RevisionProgramacionAdmin>;
}>;

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
