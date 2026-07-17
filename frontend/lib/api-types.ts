export type EspecialidadDto = Readonly<{ id: string; nombre: string }>;
export type MedicoDto = Readonly<{ id: string; nombre: string }>;

export type EspecialidadesResponse = Readonly<{
  items: EspecialidadDto[];
}>;

export type MedicosResponse = Readonly<{
  especialidad: EspecialidadDto;
  items: MedicoDto[];
}>;

export type SlotDto = Readonly<{
  id: string;
  fechaLima: string;
  inicioUtc: string;
  finUtc: string;
  medico: MedicoDto;
  consultorio: Readonly<{ id: string; codigo: string; nombre: string }>;
}>;

export type DisponibilidadResponse = Readonly<{
  especialidad: EspecialidadDto;
  zonaHoraria: "America/Lima";
  horizonte: Readonly<{
    desde: string;
    hastaExclusiva: string;
    fechas: string[];
  }>;
  items: SlotDto[];
}>;

export type EstadoCita =
  | "RESERVADA"
  | "PAGADA"
  | "ATENDIDA"
  | "NO_ASISTIO"
  | "CANCELADA";

export type DetalleCita = Readonly<{
  id: string;
  codigoReserva: string;
  estado: EstadoCita;
  motivoCancelacion: "PACIENTE" | "EXPIRACION" | null;
  reservadaEn: string;
  venceEn: string;
  canceladaEn: string | null;
  paciente: Readonly<{ nombre: string }>;
  slot: Readonly<{
    id: string;
    fechaLima: string;
    inicioUtc: string;
    finUtc: string;
    especialidad: EspecialidadDto;
    medico: MedicoDto;
    consultorio: Readonly<{ id: string; codigo: string; nombre: string }>;
  }>;
}>;

export type ApiErrorResponse = Readonly<{
  error: Readonly<{ code: string; message: string }>;
}>;
