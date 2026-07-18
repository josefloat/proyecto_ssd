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

### Requirement: PROG-4 Revisión semanal completa con vigencia futura
El ADMIN SHALL editar y guardar por médico un plan semanal completo compuesto por día ISO, turno canónico y consultorio. Cada guardado SHALL crear una revisión inmutable con versión monotónica y `vigenteDesde` civil de Lima explícito, nunca hoy ni una fecha pasada; la UI SHALL proponer el próximo lunes de Lima. Para cualquier fecha SHALL existir como máximo una revisión aplicable por médico, y las revisiones anteriores SHALL conservarse para resolver los slots históricos vinculados.

#### Scenario: PROG-4.1 Nueva revisión entra en vigor en la fecha elegida
- **GIVEN** un médico con una revisión vigente y un borrador semanal válido para el próximo lunes de Lima
- **WHEN** el ADMIN guarda el borrador completo
- **THEN** se crea la siguiente versión sin mutar la anterior, la revisión actual sigue aplicando antes de `vigenteDesde` y la nueva aplica desde esa fecha
- **PRUEBA AUTOMATIZADA** `administracion-programacion.integration.test.ts` guarda y consulta ambas fronteras civiles contra PostgreSQL real con reloj inyectado

#### Scenario: PROG-4.2 Vigencia inválida o plan incompleto no crea revisión
- **GIVEN** variantes con `vigenteDesde` hoy/pasado y un payload que omite la representación completa requerida del plan
- **WHEN** el ADMIN intenta guardarlas
- **THEN** recibe `400`, no aumenta la versión y la revisión vigente permanece exactamente igual
- **PRUEBA AUTOMATIZADA** `administracion-programacion.integration.test.ts` parametriza las variantes y compara conteo, versión y filas del plan

### Requirement: PROG-5 Guardado atómico con versión optimista y locks de recursos
El endpoint de guardado SHALL exigir la versión leída por el cliente, bloquear transaccionalmente el médico y los consultorios afectados, y validar el plan completo reutilizando PROG-1 y PROG-2. Planes independientes SHALL poder confirmarse; una versión obsoleta, colisión de recurso o exceso de horas SHALL responder `409` y revertir la revisión completa, sin write-skew ni filas parciales.

#### Scenario: PROG-5.1 Planes independientes concurrentes se confirman
- **GIVEN** dos médicos, consultorios distintos y versiones actuales conocidas
- **WHEN** dos ADMIN guardan concurrentemente planes válidos que no comparten recursos
- **THEN** ambos confirman, cada médico avanza una sola versión y cada revisión contiene exactamente su plan completo
- **PRUEBA AUTOMATIZADA** `administracion-programacion.integration.test.ts` usa `Promise.all` contra la API/PostgreSQL reales y compara versiones y conjuntos exactos

#### Scenario: PROG-5.2 Ediciones rivales o inválidas no dejan escritura parcial
- **GIVEN** dos ediciones con la misma versión base para un médico y variantes que violan colisión u horas ya cubiertas por PROG-1/PROG-2
- **WHEN** las ediciones rivales se guardan concurrentemente y las variantes inválidas se envían por separado
- **THEN** solo una rival confirma, las demás reciben `409`, existe una única versión nueva completa y no queda ninguna fila de revisión parcial
- **PRUEBA AUTOMATIZADA** `administracion-programacion.integration.test.ts` prueba la carrera y una tabla mínima de códigos de conflicto, confiando en `programacion.integration.test.ts` para las variantes de regla de dominio existentes
