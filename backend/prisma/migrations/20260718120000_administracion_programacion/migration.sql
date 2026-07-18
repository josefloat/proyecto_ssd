-- Sprint 4B: cuentas administradas y programación semanal versionada.
ALTER TABLE "Usuario"
  ADD COLUMN "nombre" TEXT,
  ADD COLUMN "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false;

-- La credencial sembrada previamente debe rotarse desde el producto, sin
-- reemplazar su hash durante despliegues posteriores.
UPDATE "Usuario"
SET "debeCambiarPassword" = true
WHERE "rol" = 'ADMIN';

CREATE TABLE "RevisionProgramacion" (
  "id" UUID NOT NULL,
  "medicoId" UUID NOT NULL,
  "numero" INTEGER NOT NULL,
  "vigenteDesde" DATE NOT NULL,
  "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevisionProgramacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RevisionProgramacion_numero_check" CHECK ("numero" > 0)
);

CREATE UNIQUE INDEX "RevisionProgramacion_medicoId_numero_key"
  ON "RevisionProgramacion"("medicoId", "numero");
CREATE UNIQUE INDEX "RevisionProgramacion_id_medicoId_key"
  ON "RevisionProgramacion"("id", "medicoId");
CREATE INDEX "RevisionProgramacion_medicoId_vigenteDesde_numero_idx"
  ON "RevisionProgramacion"("medicoId", "vigenteDesde", "numero");

ALTER TABLE "RevisionProgramacion"
  ADD CONSTRAINT "RevisionProgramacion_medicoId_fkey"
  FOREIGN KEY ("medicoId") REFERENCES "Medico"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cada médico que ya tenía programación recibe una revisión base. Reutilizar
-- su UUID hace el backfill determinista y evita depender de extensiones SQL.
INSERT INTO "RevisionProgramacion" ("id", "medicoId", "numero", "vigenteDesde")
SELECT DISTINCT "medicoId", "medicoId", 1, DATE '1970-01-01'
FROM "ProgramacionSemanal";

ALTER TABLE "ProgramacionSemanal" ADD COLUMN "revisionId" UUID;
UPDATE "ProgramacionSemanal" SET "revisionId" = "medicoId";
ALTER TABLE "ProgramacionSemanal" ALTER COLUMN "revisionId" SET NOT NULL;

DROP INDEX "ProgramacionSemanal_medicoId_diaSemana_turno_key";
DROP INDEX "ProgramacionSemanal_consultorioId_diaSemana_turno_key";

CREATE UNIQUE INDEX "ProgramacionSemanal_revisionId_diaSemana_turno_key"
  ON "ProgramacionSemanal"("revisionId", "diaSemana", "turno");
CREATE UNIQUE INDEX "ProgramacionSemanal_revisionId_consultorioId_diaSemana_turno_key"
  ON "ProgramacionSemanal"("revisionId", "consultorioId", "diaSemana", "turno");
CREATE INDEX "ProgramacionSemanal_medicoId_diaSemana_turno_idx"
  ON "ProgramacionSemanal"("medicoId", "diaSemana", "turno");
CREATE INDEX "ProgramacionSemanal_consultorioId_diaSemana_turno_idx"
  ON "ProgramacionSemanal"("consultorioId", "diaSemana", "turno");

ALTER TABLE "ProgramacionSemanal"
  ADD CONSTRAINT "ProgramacionSemanal_revisionId_medicoId_fkey"
  FOREIGN KEY ("revisionId", "medicoId")
  REFERENCES "RevisionProgramacion"("id", "medicoId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
