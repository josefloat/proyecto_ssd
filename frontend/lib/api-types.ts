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
