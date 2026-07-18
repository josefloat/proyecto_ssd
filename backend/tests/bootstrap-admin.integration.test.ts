import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { RolUsuario } from "@prisma/client";
import { bootstrapAdmin } from "../src/seed/bootstrap-admin";
import { ejecutarSeed } from "../src/seed/ejecutar-seed";
import { verifyPassword } from "../src/domain/auth";
import { limpiarDominio, testPrisma } from "./helpers/database";

const ENV_CON_ADMIN: NodeJS.ProcessEnv = {
  SEED_ADMIN_EMAIL: "  Admin@SenalDeVida.PE ",
  SEED_ADMIN_PASSWORD: "Clave-Admin-Inicial-123",
};

describe("bootstrap idempotente del administrador inicial", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("crea exactamente un admin con email normalizado y hash scrypt (BOOT-1.1)", async () => {
    // Act
    const resultado = await bootstrapAdmin(testPrisma, ENV_CON_ADMIN);

    // Assert
    expect(resultado).toEqual({ estado: "creado", email: "admin@senaldevida.pe" });
    const admins = await testPrisma.usuario.findMany();
    expect(admins).toHaveLength(1);
    expect(admins[0].rol).toBe(RolUsuario.ADMIN);
    expect(admins[0].email).toBe("admin@senaldevida.pe");
    expect(admins[0].medicoId).toBeNull();
    expect(admins[0].debeCambiarPassword).toBe(true);
    expect(admins[0].passwordHash).not.toContain("Clave-Admin-Inicial-123");
    expect(
      verifyPassword("Clave-Admin-Inicial-123", admins[0].passwordHash),
    ).toBe(true);
  });

  it("repetir no duplica ni sobrescribe; sin variables el seed completa sin usuarios (BOOT-1.2)", async () => {
    // Arrange: primera creación
    await bootstrapAdmin(testPrisma, ENV_CON_ADMIN);
    const original = await testPrisma.usuario.findUniqueOrThrow({
      where: { email: "admin@senaldevida.pe" },
    });

    // Act 1: repetir con las mismas variables no duplica ni cambia el hash
    const repetido = await bootstrapAdmin(testPrisma, ENV_CON_ADMIN);

    // Assert 1
    expect(repetido).toEqual({ estado: "ya_existia", email: "admin@senaldevida.pe" });
    expect(await testPrisma.usuario.count()).toBe(1);
    const trasRepetir = await testPrisma.usuario.findUniqueOrThrow({
      where: { email: "admin@senaldevida.pe" },
    });
    expect(trasRepetir.passwordHash).toBe(original.passwordHash);

    // Act 2: seed completo SIN las variables, partiendo de base limpia
    await limpiarDominio();
    const resultadoSeed = await ejecutarSeed(testPrisma, "2026-07-17", undefined, {});

    // Assert 2: catálogos sembrados y NINGÚN administrador sin variables.
    // El seed sí crea las cuentas MEDICO gestionables de los médicos
    // sembrados (una por médico del fixture, con cambio de clave forzado).
    expect(resultadoSeed.insertados).toBeGreaterThan(0);
    expect(await testPrisma.especialidad.count()).toBeGreaterThan(0);
    expect(await testPrisma.usuario.count({ where: { rol: "ADMIN" } })).toBe(0);
    const cuentasMedico = await testPrisma.usuario.findMany({
      where: { rol: "MEDICO" },
    });
    expect(cuentasMedico).toHaveLength(6);
    expect(
      cuentasMedico.every(
        (cuenta) => cuenta.debeCambiarPassword && cuenta.medicoId !== null,
      ),
    ).toBe(true);
  });

  it("el CHECK exige medicoId según rol (invariante Usuario–Médico)", async () => {
    // Arrange: un médico real al que enlazar
    const especialidad = await testPrisma.especialidad.create({
      data: { nombre: `Esp ${randomUUID().slice(0, 8)}`, duracionCitaMinutos: 30 },
    });
    const medico = await testPrisma.medico.create({
      data: { nombre: "Dra. Real", horasSemanales: 8, especialidadId: especialidad.id },
    });

    // Act / Assert: MEDICO sin medicoId → rechazado por el CHECK
    await expect(
      testPrisma.usuario.create({
        data: {
          email: `medico-${randomUUID().slice(0, 8)}@senaldevida.pe`,
          passwordHash: "x".repeat(32) + ":" + "y".repeat(128),
          rol: RolUsuario.MEDICO,
          medicoId: null,
        },
      }),
    ).rejects.toThrow();

    // ADMIN con medicoId → rechazado por el CHECK
    await expect(
      testPrisma.usuario.create({
        data: {
          email: `admin-${randomUUID().slice(0, 8)}@senaldevida.pe`,
          passwordHash: "x".repeat(32) + ":" + "y".repeat(128),
          rol: RolUsuario.ADMIN,
          medicoId: medico.id,
        },
      }),
    ).rejects.toThrow();

    // MEDICO con medicoId → aceptado
    const valido = await testPrisma.usuario.create({
      data: {
        email: `medico-ok-${randomUUID().slice(0, 8)}@senaldevida.pe`,
        passwordHash: "x".repeat(32) + ":" + "y".repeat(128),
        rol: RolUsuario.MEDICO,
        medicoId: medico.id,
      },
    });
    expect(valido.medicoId).toBe(medico.id);
  });
});
