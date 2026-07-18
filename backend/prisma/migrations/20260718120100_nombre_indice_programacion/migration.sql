-- PostgreSQL limita los identificadores a 63 bytes. Asignar un nombre
-- explícito mantiene estable el índice entre Prisma y la base real.
ALTER INDEX "ProgramacionSemanal_revisionId_consultorioId_diaSemana_turno_ke"
  RENAME TO "Programacion_revision_consultorio_key";
