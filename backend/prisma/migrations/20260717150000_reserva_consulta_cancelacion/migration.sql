-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('RESERVADA', 'PAGADA', 'ATENDIDA', 'NO_ASISTIO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MotivoCancelacion" AS ENUM ('PACIENTE', 'EXPIRACION');

-- CreateTable
CREATE TABLE "Paciente" (
    "id" UUID NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Paciente_dni_check" CHECK ("dni" ~ '^[0-9]{8}$'),
    CONSTRAINT "Paciente_telefono_check" CHECK ("telefono" ~ '^[0-9]{9}$'),
    CONSTRAINT "Paciente_nombre_check" CHECK (char_length("nombre") BETWEEN 1 AND 120)
);

-- CreateTable
CREATE TABLE "Cita" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "codigoReserva" TEXT NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'RESERVADA',
    "motivoCancelacion" "MotivoCancelacion",
    "reservadaEn" TIMESTAMPTZ(3) NOT NULL,
    "venceEn" TIMESTAMPTZ(3) NOT NULL,
    "canceladaEn" TIMESTAMPTZ(3),
    "idempotencyKey" UUID NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Cita_codigoReserva_check"
        CHECK ("codigoReserva" ~ '^SV-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'),
    CONSTRAINT "Cita_fingerprint_check"
        CHECK ("idempotencyFingerprint" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "Cita_venceEn_check"
        CHECK ("venceEn" = "reservadaEn" + INTERVAL '72 hours'),
    CONSTRAINT "Cita_cancelacion_check" CHECK (
        ("estado" = 'CANCELADA' AND "motivoCancelacion" IS NOT NULL AND "canceladaEn" IS NOT NULL)
        OR
        ("estado" <> 'CANCELADA' AND "motivoCancelacion" IS NULL AND "canceladaEn" IS NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_dni_key" ON "Paciente"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Cita_codigoReserva_key" ON "Cita"("codigoReserva");

-- CreateIndex
CREATE UNIQUE INDEX "Cita_idempotencyKey_key" ON "Cita"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Cita_slotId_idx" ON "Cita"("slotId");

-- CreateIndex
CREATE INDEX "Cita_estado_venceEn_idx" ON "Cita"("estado", "venceEn");

-- Un slot puede conservar varias citas históricas, pero solo una activa.
CREATE UNIQUE INDEX "Cita_slot_activa_key"
    ON "Cita"("slotId")
    WHERE "estado" IN ('RESERVADA', 'PAGADA');

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_pacienteId_fkey"
    FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_slotId_fkey"
    FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
