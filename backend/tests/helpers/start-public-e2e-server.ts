import { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app";
import { ejecutarSeed } from "../../src/seed/ejecutar-seed";

const database = new PrismaClient();
const port = Number(process.env.PORT ?? 4010);

async function limpiar() {
  await database.slot.deleteMany();
  await database.programacionSemanal.deleteMany();
  await database.medico.deleteMany();
  await database.consultorio.deleteMany();
  await database.especialidad.deleteMany();
}

async function main() {
  await limpiar();
  await ejecutarSeed(database, "2026-07-17");
  const app = createApp(database, {
    reloj: () => new Date("2026-07-17T15:00:00.000Z"),
  });
  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`E2E public API ready on ${port}`);
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
