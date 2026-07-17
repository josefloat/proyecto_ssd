import { randomUUID } from "node:crypto";
import { EstadoSlot, Turno } from "@prisma/client";
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

export async function crearFixtureSlots(options?: {
  cantidad?: number;
  inicioUtc?: Date;
  estado?: EstadoSlot;
  prefijo?: string;
}) {
  const base = await crearFixtureProgramacion({
    prefijo: options?.prefijo,
    diaSemana: 5,
  });
  const inicioBase = options?.inicioUtc ?? new Date("2026-07-24T14:00:00.000Z");
  const slots = [];
  for (let indice = 0; indice < (options?.cantidad ?? 1); indice += 1) {
    const inicioUtc = new Date(inicioBase.getTime() + indice * 30 * 60 * 1_000);
    slots.push(
      await testPrisma.slot.create({
        data: {
          programacionSemanalId: base.programacion.id,
          inicioUtc,
          finUtc: new Date(inicioUtc.getTime() + 30 * 60 * 1_000),
          fechaLima: new Date("2026-07-24T00:00:00.000Z"),
          estado: options?.estado ?? EstadoSlot.LIBRE,
        },
      }),
    );
  }
  return { ...base, slots };
}
