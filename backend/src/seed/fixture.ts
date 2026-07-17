import { Turno } from "@prisma/client";

export type SeedEspecialidad = Readonly<{
  id: string;
  nombre: string;
  duracionCitaMinutos: number;
}>;

export type SeedMedico = Readonly<{
  id: string;
  nombre: string;
  horasSemanales: number;
  especialidadId: string;
}>;

export type SeedConsultorio = Readonly<{
  id: string;
  codigo: string;
  nombre: string;
}>;

export type SeedProgramacion = Readonly<{
  id: string;
  medicoId: string;
  consultorioId: string;
  diaSemana: number;
  turno: Turno;
}>;

export type FixtureSeed = Readonly<{
  especialidades: readonly SeedEspecialidad[];
  medicos: readonly SeedMedico[];
  consultorios: readonly SeedConsultorio[];
  programaciones: readonly SeedProgramacion[];
}>;

export const FIXTURE_SEED: FixtureSeed = {
  especialidades: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      nombre: "Medicina General",
      duracionCitaMinutos: 20,
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      nombre: "Cardiología",
      duracionCitaMinutos: 30,
    },
    {
      id: "10000000-0000-4000-8000-000000000003",
      nombre: "Pediatría",
      duracionCitaMinutos: 20,
    },
    {
      id: "10000000-0000-4000-8000-000000000004",
      nombre: "Traumatología",
      duracionCitaMinutos: 30,
    },
    {
      id: "10000000-0000-4000-8000-000000000005",
      nombre: "Ginecología",
      duracionCitaMinutos: 30,
    },
    {
      id: "10000000-0000-4000-8000-000000000006",
      nombre: "Dermatología",
      duracionCitaMinutos: 15,
    },
  ],
  medicos: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      nombre: "Dra. Elena Vargas",
      horasSemanales: 4,
      especialidadId: "10000000-0000-4000-8000-000000000001",
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      nombre: "Dr. Carlos Rojas",
      horasSemanales: 4,
      especialidadId: "10000000-0000-4000-8000-000000000002",
    },
    {
      id: "20000000-0000-4000-8000-000000000003",
      nombre: "Dra. Lucía Salazar",
      horasSemanales: 4,
      especialidadId: "10000000-0000-4000-8000-000000000003",
    },
    {
      id: "20000000-0000-4000-8000-000000000004",
      nombre: "Dr. Miguel Torres",
      horasSemanales: 4,
      especialidadId: "10000000-0000-4000-8000-000000000004",
    },
    {
      id: "20000000-0000-4000-8000-000000000005",
      nombre: "Dra. Patricia León",
      horasSemanales: 4,
      especialidadId: "10000000-0000-4000-8000-000000000005",
    },
    {
      id: "20000000-0000-4000-8000-000000000006",
      nombre: "Dr. Andrés Medina",
      horasSemanales: 4,
      especialidadId: "10000000-0000-4000-8000-000000000006",
    },
  ],
  consultorios: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      codigo: "C-101",
      nombre: "Consultorio 101",
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      codigo: "C-102",
      nombre: "Consultorio 102",
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      codigo: "C-103",
      nombre: "Consultorio 103",
    },
  ],
  programaciones: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      medicoId: "20000000-0000-4000-8000-000000000001",
      consultorioId: "30000000-0000-4000-8000-000000000001",
      diaSemana: 1,
      turno: Turno.MANANA,
    },
    {
      id: "40000000-0000-4000-8000-000000000002",
      medicoId: "20000000-0000-4000-8000-000000000002",
      consultorioId: "30000000-0000-4000-8000-000000000002",
      diaSemana: 1,
      turno: Turno.MANANA,
    },
    {
      id: "40000000-0000-4000-8000-000000000003",
      medicoId: "20000000-0000-4000-8000-000000000003",
      consultorioId: "30000000-0000-4000-8000-000000000001",
      diaSemana: 2,
      turno: Turno.TARDE,
    },
    {
      id: "40000000-0000-4000-8000-000000000004",
      medicoId: "20000000-0000-4000-8000-000000000004",
      consultorioId: "30000000-0000-4000-8000-000000000002",
      diaSemana: 2,
      turno: Turno.TARDE,
    },
    {
      id: "40000000-0000-4000-8000-000000000005",
      medicoId: "20000000-0000-4000-8000-000000000005",
      consultorioId: "30000000-0000-4000-8000-000000000001",
      diaSemana: 3,
      turno: Turno.NOCHE,
    },
    {
      id: "40000000-0000-4000-8000-000000000006",
      medicoId: "20000000-0000-4000-8000-000000000006",
      consultorioId: "30000000-0000-4000-8000-000000000001",
      diaSemana: 4,
      turno: Turno.MANANA,
    },
  ],
};
