import { type PrismaClient } from "@prisma/client";

export async function crearRevisionBase(
  database: PrismaClient,
  medicoId: string,
) {
  return database.revisionProgramacion.create({
    data: {
      id: medicoId,
      medicoId,
      numero: 1,
      vigenteDesde: new Date("1970-01-01T00:00:00.000Z"),
    },
  });
}
