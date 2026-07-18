import { randomInt, randomUUID } from "node:crypto";
import { EstadoCita, EstadoSlot, RolUsuario, Turno } from "@prisma/client";
import { hashPassword } from "../../src/domain/auth";
import { testPrisma } from "./database";

const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function codigoReservaValido(): string {
  let cuerpo = "";
  for (let i = 0; i < 8; i += 1) {
    cuerpo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  }
  return `SV-${cuerpo}`;
}

function dniAleatorio(): string {
  let dni = "";
  for (let i = 0; i < 8; i += 1) {
    dni += randomInt(10).toString();
  }
  return dni;
}

// Crea un usuario del personal con contraseña. Para rol MEDICO exige medicoId
// (el CHECK de la BD lo obliga); para ADMIN/RECEPCIONISTA debe ser null.
export async function crearUsuario(options: {
  rol: RolUsuario;
  password: string;
  email?: string;
  activo?: boolean;
  medicoId?: string | null;
}) {
  return testPrisma.usuario.create({
    data: {
      email: options.email ?? `${randomUUID().slice(0, 8)}@senaldevida.pe`,
      passwordHash: hashPassword(options.password),
      rol: options.rol,
      activo: options.activo ?? true,
      medicoId: options.rol === RolUsuario.MEDICO ? options.medicoId! : null,
    },
  });
}

// Crea una especialidad, médico, consultorio, programación y un slot para una
// fecha Lima dada, y opcionalmente una cita en ese slot. Devuelve todo.
export async function crearCitaFixture(options: {
  fechaLima: string; // YYYY-MM-DD
  inicioUtc: Date;
  estadoCita?: EstadoCita;
  prefijo?: string;
  dni?: string;
  telefono?: string;
  nombrePaciente?: string;
}) {
  const prefijo = options.prefijo ?? randomUUID().slice(0, 8);
  const especialidad = await testPrisma.especialidad.create({
    data: { nombre: `Especialidad ${prefijo}`, duracionCitaMinutos: 30 },
  });
  const medico = await testPrisma.medico.create({
    data: {
      nombre: `Médico ${prefijo}`,
      horasSemanales: 8,
      especialidadId: especialidad.id,
    },
  });
  const consultorio = await testPrisma.consultorio.create({
    data: { codigo: `C-${prefijo}`, nombre: `Consultorio ${prefijo}` },
  });
  const programacion = await testPrisma.programacionSemanal.create({
    data: {
      medicoId: medico.id,
      consultorioId: consultorio.id,
      diaSemana: 5,
      turno: Turno.MANANA,
    },
  });
  const estadoCita = options.estadoCita ?? EstadoCita.RESERVADA;
  const slotReservado =
    estadoCita === EstadoCita.RESERVADA || estadoCita === EstadoCita.PAGADA;
  const slot = await testPrisma.slot.create({
    data: {
      programacionSemanalId: programacion.id,
      inicioUtc: options.inicioUtc,
      finUtc: new Date(options.inicioUtc.getTime() + 30 * 60 * 1_000),
      fechaLima: new Date(`${options.fechaLima}T00:00:00.000Z`),
      estado: slotReservado ? EstadoSlot.RESERVADO : EstadoSlot.LIBRE,
    },
  });
  const paciente = await testPrisma.paciente.create({
    data: {
      dni: options.dni ?? dniAleatorio(),
      telefono: options.telefono ?? "987654321",
      nombre: options.nombrePaciente ?? `Paciente ${prefijo}`,
    },
  });
  const reservadaEn = new Date(options.inicioUtc.getTime() - 24 * 60 * 60 * 1_000);
  const cita = await testPrisma.cita.create({
    data: {
      pacienteId: paciente.id,
      slotId: slot.id,
      codigoReserva: codigoReservaValido(),
      estado: estadoCita,
      motivoCancelacion:
        estadoCita === EstadoCita.CANCELADA ? "PACIENTE" : null,
      reservadaEn,
      venceEn: new Date(reservadaEn.getTime() + 72 * 60 * 60 * 1_000),
      canceladaEn: estadoCita === EstadoCita.CANCELADA ? reservadaEn : null,
      idempotencyKey: randomUUID(),
      idempotencyFingerprint: "0".repeat(64),
    },
  });
  return { especialidad, medico, consultorio, programacion, slot, paciente, cita };
}
