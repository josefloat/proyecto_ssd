import { PrismaClient } from "@prisma/client";
import { ejecutarSeed } from "../src/seed/ejecutar-seed";

const prisma = new PrismaClient();

ejecutarSeed(prisma, process.env.SEED_ANCHOR_DATE)
  .then((resultado) => {
    console.log(
      `Seed completo: ${resultado.insertados}/${resultado.considerados} slots nuevos en [${resultado.desde}, ${resultado.hastaExclusiva})`,
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
