import { randomUUID } from "node:crypto";
import { Turno } from "@prisma/client";
import { testPrisma } from "./database";

export async function crearFixtureProgramacion(options?: {
  duracionCitaMinutos?: number;
  turno?: Turno;
  diaSemana?: number;
  horasSemanales?: number;
  prefijo?: string;
}) {
  const prefijo = options?.prefijo ?? randomUUID().slice(0, 8);
  const especialidad = await testPrisma.especialidad.create({
    data: {
      nombre: `Especialidad ${prefijo}`,
      duracionCitaMinutos: options?.duracionCitaMinutos ?? 30,
    },
  });
  const medico = await testPrisma.medico.create({
    data: {
      nombre: `Médico ${prefijo}`,
      horasSemanales: options?.horasSemanales ?? 8,
      especialidadId: especialidad.id,
    },
  });
  const consultorio = await testPrisma.consultorio.create({
    data: {
      codigo: `C-${prefijo}`,
      nombre: `Consultorio ${prefijo}`,
    },
  });
  const programacion = await testPrisma.programacionSemanal.create({
    data: {
      medicoId: medico.id,
      consultorioId: consultorio.id,
      diaSemana: options?.diaSemana ?? 5,
      turno: options?.turno ?? Turno.MANANA,
    },
  });
  return { especialidad, medico, consultorio, programacion };
}
