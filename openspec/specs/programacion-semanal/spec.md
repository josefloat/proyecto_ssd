# programacion-semanal Specification

## Purpose
TBD - created by archiving change motor-de-disponibilidad. Update Purpose after archive.
## Requirements
### Requirement: PROG-1 Programación usa día ISO válido e impide colisiones
El sistema SHALL aceptar únicamente un día ISO entre 1 (lunes) y 7 (domingo), SHALL impedir más de una `ProgramacionSemanal` para el mismo médico, día ISO y turno, y SHALL impedir más de una para el mismo consultorio, día ISO y turno.

#### Scenario: PROG-1.1 Recursos distintos comparten franja semanal
- **GIVEN** dos médicos y dos consultorios distintos
- **WHEN** se programan el mismo día y turno usando pares de recursos diferentes
- **THEN** ambas programaciones quedan persistidas
- **PRUEBA AUTOMATIZADA** `programacion.integration.test.ts` inserta ambas asignaciones contra PostgreSQL real y comprueba sus claves

#### Scenario: PROG-1.2 Colisión de médico o consultorio
- **GIVEN** una programación existente y otra que reutiliza su médico o consultorio en el mismo día y turno
- **WHEN** se intenta confirmar la segunda programación
- **THEN** PostgreSQL la rechaza y conserva una única asignación para el recurso
- **PRUEBA AUTOMATIZADA** `programacion.integration.test.ts` prueba por separado ambas unicidades contra PostgreSQL real

#### Scenario: PROG-1.3 Día ISO fuera del rango
- **GIVEN** dos intentos de programación con `diaSemana` 0 y 8 respectivamente
- **WHEN** se intenta persistir cada programación
- **THEN** PostgreSQL rechaza ambos valores mediante el check `1..7` y no deja ninguna fila
- **PRUEBA AUTOMATIZADA** `programacion.integration.test.ts` ejecuta ambos inserts contra PostgreSQL real y verifica el conteo final en cero

### Requirement: PROG-2 Programación respeta horas semanales
El sistema SHALL crear una programación solo si la suma de sus turnos de cuatro horas no supera las horas semanales declaradas por el médico; validación e inserción SHALL ocurrir en una transacción protegida contra solicitudes concurrentes.

#### Scenario: PROG-2.1 Asignaciones dentro del máximo
- **GIVEN** un médico de ocho horas semanales sin programación
- **WHEN** se le asignan dos turnos de cuatro horas en días diferentes
- **THEN** ambas asignaciones se confirman y totalizan ocho horas
- **PRUEBA AUTOMATIZADA** `programacion.integration.test.ts` usa el servicio real y verifica el total en PostgreSQL

#### Scenario: PROG-2.2 Solicitudes concurrentes exceden el máximo
- **GIVEN** un médico de cuatro horas y dos solicitudes concurrentes para días distintos
- **WHEN** ambas intentan crear un turno de cuatro horas
- **THEN** solo una confirma y la otra recibe el error de límite sin write-skew
- **PRUEBA AUTOMATIZADA** `programacion.integration.test.ts` usa `Promise.allSettled` contra PostgreSQL real y verifica un éxito, un rechazo y una fila

### Requirement: PROG-3 Seed de programación es determinista e idempotente
`prisma db seed` SHALL sembrar médicos, consultorios y programaciones desde un único fixture versionado con claves estables, SHALL reutilizar `asegurarHorizonte()` y SHALL poder ejecutarse repetidamente sin duplicar ni cambiar los datos existentes.

#### Scenario: PROG-3.1 Seed repetido conserva el mismo conjunto
- **GIVEN** una base migrada y una fecha ancla fija
- **WHEN** se ejecuta `prisma db seed` dos veces
- **THEN** catálogos, programaciones y slots coinciden exactamente con el resultado de la primera ejecución
- **PRUEBA AUTOMATIZADA** `seed.integration.test.ts` ejecuta el entrypoint dos veces contra PostgreSQL real y compara claves, conteos y estados

#### Scenario: PROG-3.2 Fixture de programación inválido revierte el seed
- **GIVEN** un fixture local con dos programaciones que colisionan en médico o consultorio
- **WHEN** el seed intenta persistir el fixture
- **THEN** falla antes de asegurar el horizonte y la transacción no deja programaciones parciales
- **PRUEBA AUTOMATIZADA** `seed.integration.test.ts` inyecta el fixture inválido contra PostgreSQL real y verifica rollback y ausencia de slots
