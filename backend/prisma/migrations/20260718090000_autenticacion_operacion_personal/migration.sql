-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'RECEPCIONISTA', 'MEDICO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "medicoId" UUID,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Usuario_email_check" CHECK ("email" = lower(btrim("email")) AND char_length("email") BETWEEN 3 AND 254),
    -- Invariante de dominio irrepresentable en la BD: un MEDICO exige medicoId;
    -- ADMIN y RECEPCIONISTA nunca lo tienen.
    CONSTRAINT "Usuario_medicoId_segun_rol_check" CHECK (
        ("rol" = 'MEDICO' AND "medicoId" IS NOT NULL)
        OR
        ("rol" IN ('ADMIN', 'RECEPCIONISTA') AND "medicoId" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMPTZ(3) NOT NULL,
    "revocadaEn" TIMESTAMPTZ(3),

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Sesion_tokenHash_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "Sesion_expiraEn_check" CHECK ("expiraEn" > "creadaEn")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_medicoId_key" ON "Usuario"("medicoId");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_tokenHash_key" ON "Sesion"("tokenHash");

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_medicoId_fkey"
    FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
