import { PrismaClient } from "@prisma/client";

export const testPrisma = new PrismaClient();

export async function limpiarDominio(): Promise<void> {
  await testPrisma.slot.deleteMany();
  await testPrisma.programacionSemanal.deleteMany();
  await testPrisma.medico.deleteMany();
  await testPrisma.consultorio.deleteMany();
  await testPrisma.especialidad.deleteMany();
}
