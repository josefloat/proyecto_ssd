## Why

El flujo de reservas necesita una fuente de disponibilidad determinista antes de exponerla al paciente. Este cambio incorpora el motor que convierte la programación semanal de la clínica en slots materializados, consultables internamente y seguros ante reintentos y concurrencia.

## What Changes

- Incorporar especialidades con duración entera de 1 a 240 minutos, médicos con horas semanales y relación obligatoria con una especialidad, y consultorios.
- Definir el enum fijo de turnos `MANANA` 09:00–13:00, `TARDE` 15:00–19:00 y `NOCHE` 19:00–23:00.
- Incorporar `ProgramacionSemanal` por médico, día, turno y consultorio, impidiendo colisiones de médico o consultorio desde el origen.
- Materializar slots `LIBRE`, `RESERVADO` o `BLOQUEADO` con `inicioUtc`, `finUtc` y `fechaLima` derivada.
- Incorporar `asegurarHorizonte()` para completar idempotentemente todas las fechas faltantes de `[hoy Lima, hoy Lima + 28 días)`, con fecha ancla inyectable y únicamente slots completos: nunca extiende el turno y descarta el remanente final.
- Incorporar servicios internos para generar, consultar y bloquear slots concretos sin modificar la programación semanal.
- Incorporar un seed Prisma idempotente con seis especialidades, médicos, consultorios y programación determinista; el seed reutiliza `asegurarHorizonte()`.
- Modificar el pipeline para ejecutar `prisma db seed` después de `prisma migrate deploy` y antes de cualquier despliegue, bloqueando Render y Vercel si falla.
- Añadir pruebas Vitest AAA, integración con PostgreSQL real y cobertura mínima de 80% para lógica de dominio.

## Capabilities

### New Capabilities

- `catalogo-agenda`: Especialidades con duración entera entre 1 y 240 minutos, catálogo canónico confirmado, médicos, horas semanales, consultorios y catálogo fijo de turnos.
- `programacion-semanal`: Asignación recurrente por médico, día, turno y consultorio, con límites semanales y prevención de colisiones.
- `slots-materializados`: Horizonte móvil, generación idempotente de intervalos completos con descarte de remanentes, fecha civil de Lima, servicios internos de consulta/bloqueo y máquina de estados de slot.

### Modified Capabilities

- `deployment-pipeline`: El gate de migración incorpora un seed Prisma idempotente que debe terminar correctamente antes de habilitar los despliegues de Render y Vercel.

## Impact

- `backend/prisma`: modelos, enums, migración de dominio y seed determinista.
- `backend/src`: lógica de catálogo, programación, generación, consulta interna y bloqueo de slots.
- `backend/tests`: pruebas unitarias e integración contra PostgreSQL real.
- `.github/workflows`: paso de seed entre migración y despliegue, más fixtures locales para verificar sus gates.
- No se modifica el frontend ni se crea un endpoint público en este cambio.

## Fuera de alcance

- `GET /disponibilidad`, DTOs públicos y pantallas del paciente; pertenecen a `disponibilidad-publica`.
- Reservas, citas y cualquier dato de pacientes.
- Autenticación y autorización.
- Paneles de administrador, recepción o médico.
- Vigencia, versionado, edición o supersesión de `ProgramacionSemanal`; se definirán en `panel-admin` durante Sprint 4.
- Cambios generales de infraestructura o despliegue distintos del paso de seed requerido en el pipeline.
