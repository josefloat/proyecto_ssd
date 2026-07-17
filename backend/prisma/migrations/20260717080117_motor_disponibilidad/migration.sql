-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANANA', 'TARDE', 'NOCHE');

-- CreateEnum
CREATE TYPE "EstadoSlot" AS ENUM ('LIBRE', 'RESERVADO', 'BLOQUEADO');

-- CreateTable
CREATE TABLE "Especialidad" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracionCitaMinutos" INTEGER NOT NULL,

    CONSTRAINT "Especialidad_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Especialidad_duracionCitaMinutos_check"
        CHECK ("duracionCitaMinutos" BETWEEN 1 AND 240)
);

-- CreateTable
CREATE TABLE "Medico" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "horasSemanales" INTEGER NOT NULL,
    "especialidadId" UUID NOT NULL,

    CONSTRAINT "Medico_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Medico_horasSemanales_check" CHECK ("horasSemanales" > 0)
);

-- CreateTable
CREATE TABLE "Consultorio" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Consultorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramacionSemanal" (
    "id" UUID NOT NULL,
    "medicoId" UUID NOT NULL,
    "consultorioId" UUID NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "turno" "Turno" NOT NULL,

    CONSTRAINT "ProgramacionSemanal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProgramacionSemanal_diaSemana_check"
        CHECK ("diaSemana" BETWEEN 1 AND 7)
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" UUID NOT NULL,
    "programacionSemanalId" UUID NOT NULL,
    "inicioUtc" TIMESTAMPTZ(3) NOT NULL,
    "finUtc" TIMESTAMPTZ(3) NOT NULL,
    "fechaLima" DATE NOT NULL,
    "estado" "EstadoSlot" NOT NULL DEFAULT 'LIBRE',

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Slot_intervalo_check" CHECK ("finUtc" > "inicioUtc"),
    CONSTRAINT "Slot_fechaLima_inicioUtc_check"
        CHECK ("fechaLima" = ("inicioUtc" AT TIME ZONE 'America/Lima')::date)
);

-- CreateIndex
CREATE UNIQUE INDEX "Especialidad_nombre_key" ON "Especialidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Consultorio_codigo_key" ON "Consultorio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramacionSemanal_medicoId_diaSemana_turno_key" ON "ProgramacionSemanal"("medicoId", "diaSemana", "turno");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramacionSemanal_consultorioId_diaSemana_turno_key" ON "ProgramacionSemanal"("consultorioId", "diaSemana", "turno");

-- CreateIndex
CREATE INDEX "Slot_fechaLima_estado_inicioUtc_idx" ON "Slot"("fechaLima", "estado", "inicioUtc");

-- CreateIndex
CREATE UNIQUE INDEX "Slot_programacionSemanalId_inicioUtc_key" ON "Slot"("programacionSemanalId", "inicioUtc");

-- AddForeignKey
ALTER TABLE "Medico" ADD CONSTRAINT "Medico_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "Especialidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramacionSemanal" ADD CONSTRAINT "ProgramacionSemanal_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramacionSemanal" ADD CONSTRAINT "ProgramacionSemanal_consultorioId_fkey" FOREIGN KEY ("consultorioId") REFERENCES "Consultorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_programacionSemanalId_fkey" FOREIGN KEY ("programacionSemanalId") REFERENCES "ProgramacionSemanal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
