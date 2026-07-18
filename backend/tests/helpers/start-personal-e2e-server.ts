import { randomInt, randomUUID } from "node:crypto";
import { EstadoCita, EstadoSlot, PrismaClient, RolUsuario, Turno } from "@prisma/client";
import { createApp } from "../../src/app";
import { hashPassword } from "../../src/domain/auth";

const database = new PrismaClient();
const port = Number(process.env.PORT ?? 4030);
const AHORA = new Date("2026-07-17T15:00:00.000Z"); // 10:00 Lima → hoy = 2026-07-17
const FECHA_LIMA = "2026-07-17";

// Credenciales fijas para los flujos E2E del personal. No son secretos de
// producción; solo existen en este servidor efímero de prueba.
const RECEPCION = { email: "recepcion@senaldevida.pe", password: "Recepcion-123" };
const MEDICO = { email: "medico@senaldevida.pe", password: "Medico-123" };
const ADMIN = { email: "admin@senaldevida.pe", password: "Admin-123" };

async function limpiar() {
  await database.sesion.deleteMany();
  await database.usuario.deleteMany();
  await database.cita.deleteMany();
  await database.paciente.deleteMany();
  await database.slot.deleteMany();
  await database.programacionSemanal.deleteMany();
  await database.medico.deleteMany();
  await database.consultorio.deleteMany();
  await database.especialidad.deleteMany();
}

async function crearMedicoConCitas(options: {
  medicoNombre: string;
  especialidadNombre: string;
  consultorioCodigo: string;
  citas: Array<{
    inicioUtcMin: number; // minutos desde 2026-07-17T14:00Z
    estado: EstadoCita;
    paciente: { dni: string; telefono: string; nombre: string };
  }>;
}) {
  const especialidad = await database.especialidad.create({
    data: { nombre: options.especialidadNombre, duracionCitaMinutos: 30 },
  });
  const medico = await database.medico.create({
    data: { nombre: options.medicoNombre, horasSemanales: 8, especialidadId: especialidad.id },
  });
  const consultorio = await database.consultorio.create({
    data: { codigo: options.consultorioCodigo, nombre: `Consultorio ${options.consultorioCodigo}` },
  });
  const programacion = await database.programacionSemanal.create({
    data: { medicoId: medico.id, consultorioId: consultorio.id, diaSemana: 5, turno: Turno.MANANA },
  });
  const alfabeto = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  for (const item of options.citas) {
    const inicioUtc = new Date(`2026-07-17T14:00:00.000Z`);
    inicioUtc.setUTCMinutes(inicioUtc.getUTCMinutes() + item.inicioUtcMin);
    const reservado = item.estado === EstadoCita.RESERVADA || item.estado === EstadoCita.PAGADA;
    const slot = await database.slot.create({
      data: {
        programacionSemanalId: programacion.id,
        inicioUtc,
        finUtc: new Date(inicioUtc.getTime() + 30 * 60 * 1_000),
        fechaLima: new Date(`${FECHA_LIMA}T00:00:00.000Z`),
        estado: reservado ? EstadoSlot.RESERVADO : EstadoSlot.LIBRE,
      },
    });
    const paciente = await database.paciente.create({ data: item.paciente });
    let codigo = "SV-";
    for (let i = 0; i < 8; i += 1) codigo += alfabeto[randomInt(alfabeto.length)];
    const reservadaEn = new Date(inicioUtc.getTime() - 24 * 60 * 60 * 1_000);
    await database.cita.create({
      data: {
        pacienteId: paciente.id,
        slotId: slot.id,
        codigoReserva: codigo,
        estado: item.estado,
        motivoCancelacion: item.estado === EstadoCita.CANCELADA ? "PACIENTE" : null,
        reservadaEn,
        venceEn: new Date(reservadaEn.getTime() + 72 * 60 * 60 * 1_000),
        canceladaEn: item.estado === EstadoCita.CANCELADA ? reservadaEn : null,
        idempotencyKey: randomUUID(),
        idempotencyFingerprint: "0".repeat(64),
      },
    });
  }
  return medico;
}

async function main() {
  await limpiar();

  const medicoPrincipal = await crearMedicoConCitas({
    medicoNombre: "Dr. Carlos Rojas",
    especialidadNombre: "Cardiología",
    consultorioCodigo: "C-101",
    citas: [
      { inicioUtcMin: 120, estado: EstadoCita.RESERVADA, paciente: { dni: "45812678", telefono: "987654321", nombre: "Rosa Huamán Quispe" } },
      { inicioUtcMin: 180, estado: EstadoCita.PAGADA, paciente: { dni: "09283746", telefono: "976543210", nombre: "Carlos Pizarro León" } },
    ],
  });

  // Segundo médico con su propia cita del día: prueba el alcance por médico.
  await crearMedicoConCitas({
    medicoNombre: "Dra. María Reiche",
    especialidadNombre: "Pediatría",
    consultorioCodigo: "C-102",
    citas: [
      { inicioUtcMin: 150, estado: EstadoCita.RESERVADA, paciente: { dni: "70123499", telefono: "912345678", nombre: "Ana García Ríos" } },
    ],
  });

  await database.usuario.create({
    data: { email: RECEPCION.email, passwordHash: hashPassword(RECEPCION.password), rol: RolUsuario.RECEPCIONISTA },
  });
  await database.usuario.create({
    data: { email: MEDICO.email, passwordHash: hashPassword(MEDICO.password), rol: RolUsuario.MEDICO, medicoId: medicoPrincipal.id },
  });
  await database.usuario.create({
    data: { email: ADMIN.email, passwordHash: hashPassword(ADMIN.password), rol: RolUsuario.ADMIN },
  });

  const app = createApp(database, { reloj: () => AHORA });
  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`E2E personal API ready on ${port}`);
  });
  const shutdown = () => {
    server.close(() => {
      void database.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main().catch(async (error) => {
  console.error(error);
  await database.$disconnect();
  process.exit(1);
});
