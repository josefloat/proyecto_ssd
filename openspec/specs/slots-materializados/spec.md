# slots-materializados Specification

## Purpose
TBD - created by archiving change motor-de-disponibilidad. Update Purpose after archive.
## Requirements
### Requirement: SLOT-1 Horizonte móvil completo de 28 fechas
`asegurarHorizonte()` SHALL generar todos los slots faltantes para cada fecha civil del intervalo semiabierto `[fechaAncla Lima, fechaAncla Lima + 28 días)`, usando la programación semanal, turno y duración de especialidad; si la base está vacía SHALL cubrir las 28 fechas. Cada slot SHALL caber completo dentro del turno: el generador nunca SHALL extender el cierre ni crear un slot parcial y SHALL descartar cualquier remanente final menor que la duración.

#### Scenario: SLOT-1.1 Base vacía cubre las 28 fechas
- **GIVEN** una base sin slots, una programación válida y una fecha ancla fija de Lima
- **WHEN** se ejecuta `asegurarHorizonte(fechaAncla)`
- **THEN** materializa los slots de todas las fechas coincidentes dentro de las 28 fechas y ninguno fuera del intervalo
- **PRUEBA AUTOMATIZADA** `horizonte.integration.test.ts` ejecuta el servicio contra PostgreSQL real y compara fechas esperadas, primera y última frontera

#### Scenario: SLOT-1.2 Fecha ancla inválida no genera parcialmente
- **GIVEN** una fecha imposible o con formato distinto de `YYYY-MM-DD`
- **WHEN** se invoca `asegurarHorizonte()`
- **THEN** retorna un error de validación antes de abrir la generación y no crea slots
- **PRUEBA AUTOMATIZADA** `horizonte.domain.test.ts` prueba fixtures inválidos con Vitest AAA y un spy de repositorio no invocado

#### Scenario: SLOT-1.3 Intervalos exactos para duración de 25 minutos
- **GIVEN** una especialidad de 25 minutos y una programación `MANANA` para la fecha Lima 2026-07-17
- **WHEN** el generador materializa los intervalos de esa fecha dentro de 09:00–13:00
- **THEN** crea exactamente nueve slots; el primero guarda `inicioUtc` 2026-07-17T14:00:00Z y `finUtc` 2026-07-17T14:25:00Z, el último guarda `inicioUtc` 2026-07-17T17:20:00Z y `finUtc` 2026-07-17T17:45:00Z, y no crea ningún slot para los 15 minutos restantes
- **PRUEBA AUTOMATIZADA** `intervalos.domain.test.ts` verifica con Vitest AAA los nueve pares exactos y `horizonte.integration.test.ts` confirma conteo e instantes persistidos contra PostgreSQL real

### Requirement: SLOT-2 Generación idempotente distingue la única colisión inocua
La generación SHALL ejecutarse con exclusión mutua transaccional y SHALL ignorar únicamente el conflicto exacto de `programacionSemanalId` más `inicioUtc`; ejecuciones repetidas o concurrentes SHALL converger sin alterar estados existentes, y ninguna otra violación SHALL ocultarse como duplicado.

#### Scenario: SLOT-2.1 Generaciones repetidas y concurrentes convergen
- **GIVEN** una misma programación y fecha ancla
- **WHEN** dos invocaciones concurrentes aseguran el horizonte y después se repite una tercera
- **THEN** cada clave natural existe una vez y los estados existentes permanecen iguales
- **PRUEBA AUTOMATIZADA** `horizonte.integration.test.ts` ejecuta las tres invocaciones contra PostgreSQL real y compara unicidad, conteo y estados

#### Scenario: SLOT-2.2 Conflicto distinto no se silencia
- **GIVEN** un fixture que provoca una FK, check o restricción distinta de la clave natural de slot
- **WHEN** el generador intenta persistirlo
- **THEN** la transacción falla y no trata el error como idempotencia
- **PRUEBA AUTOMATIZADA** `horizonte.integration.test.ts` induce una violación local controlada y verifica rechazo y rollback, demostrando que no existe `skipDuplicates` general

### Requirement: SLOT-3 Fecha Lima deriva consistentemente del instante UTC
El generador SHALL derivar y persistir `fechaLima` como `DATE` desde la fecha civil proyectada, SHALL guardar inicio y fin como UTC y SHALL impedir que una fecha Lima inconsistente con `inicioUtc` sea persistida.

#### Scenario: SLOT-3.1 Turno noche cruza el día UTC
- **GIVEN** una programación `NOCHE` para la fecha Lima 2026-07-17
- **WHEN** el generador materializa el slot de las 19:00
- **THEN** guarda `inicioUtc` 2026-07-18T00:00:00Z y conserva `fechaLima` 2026-07-17
- **PRUEBA AUTOMATIZADA** `zona-horaria.integration.test.ts` genera el slot contra PostgreSQL real y compara ambos campos y sus tipos

#### Scenario: SLOT-3.2 Fecha Lima forjada no puede persistirse
- **GIVEN** un fixture interno con `inicioUtc` correspondiente a una fecha de Lima pero una `fechaLima` diferente
- **WHEN** intenta insertar el slot
- **THEN** PostgreSQL rechaza la inconsistencia y no crea la fila
- **PRUEBA AUTOMATIZADA** `zona-horaria.integration.test.ts` intenta la escritura contra PostgreSQL real y verifica el check de consistencia

### Requirement: SLOT-4 Bloqueo concreto respeta estados y programación
El servicio de bloqueo SHALL cambiar atómicamente un slot `LIBRE` a `BLOQUEADO` sin modificar `ProgramacionSemanal`; repetir el bloqueo de un slot ya `BLOQUEADO` SHALL ser idempotente y un slot `RESERVADO` SHALL permanecer reservado con respuesta de conflicto.

#### Scenario: SLOT-4.1 Bloqueo exitoso e idempotente
- **GIVEN** un slot `LIBRE` vinculado a una programación
- **WHEN** dos solicitudes intentan bloquearlo y una se reintenta
- **THEN** el estado final es `BLOQUEADO`, ambas rutas idempotentes convergen y la programación no cambia
- **PRUEBA AUTOMATIZADA** `bloqueo.integration.test.ts` ejecuta solicitudes concurrentes/reintento contra PostgreSQL real y relee slot y programación

#### Scenario: SLOT-4.2 Slot reservado rechaza el bloqueo
- **GIVEN** un fixture local de slot `RESERVADO`
- **WHEN** el servicio intenta bloquearlo
- **THEN** retorna conflicto y el slot permanece `RESERVADO`
- **PRUEBA AUTOMATIZADA** `bloqueo.integration.test.ts` espera el error tipado y verifica el estado inalterado en PostgreSQL real

### Requirement: SLOT-5 Consulta interna filtra por fecha Lima y libertad
El servicio interno de consulta SHALL aceptar especialidad, médico opcional y `fechaLima`, SHALL filtrar el día mediante la columna `fechaLima`, SHALL devolver solo slots `LIBRE` y SHALL ordenar por inicio y médico.

#### Scenario: SLOT-5.1 Consulta mixta devuelve solo libres del día Lima
- **GIVEN** slots de varias fechas, médicos y estados, incluido un turno noche que cruza de día UTC
- **WHEN** se consulta una especialidad, médico opcional y fecha Lima
- **THEN** devuelve únicamente las coincidencias `LIBRE` de esa fecha civil en orden determinista
- **PRUEBA AUTOMATIZADA** `consulta-disponibilidad.integration.test.ts` carga fixtures contra PostgreSQL real y compara la secuencia exacta

#### Scenario: SLOT-5.2 Filtro de fecha inválido
- **GIVEN** una fecha imposible o con formato no canónico
- **WHEN** se invoca el servicio interno de consulta
- **THEN** retorna error de validación sin consultar el repositorio
- **PRUEBA AUTOMATIZADA** `consulta-disponibilidad.domain.test.ts` usa Vitest AAA y verifica el error y un spy de repositorio no invocado

### Requirement: SLOT-6 Reconciliación inserta únicamente claves naturales faltantes
Dentro del advisory lock transaccional, `asegurarHorizonte()` SHALL obtener las claves `programacionSemanalId + inicioUtc` existentes del horizonte, SHALL filtrar en memoria los intervalos esperados, SHALL terminar sin ejecutar `INSERT` cuando no falte ninguno y SHALL insertar solo los faltantes conservando `ON CONFLICT (programacionSemanalId, inicioUtc) DO NOTHING`; cualquier slot existente SHALL contar sin importar si está `LIBRE`, `RESERVADO` o `BLOQUEADO`.

#### Scenario: SLOT-6.1 Horizonte caliente realiza cero escrituras INSERT
- **GIVEN** un horizonte completo generado para una fecha ancla fija
- **WHEN** se ejecuta `asegurarHorizonte()` por segunda vez con la misma ancla
- **THEN** reporta cero insertados y no ejecuta ninguna sentencia `INSERT INTO "Slot"`
- **PRUEBA AUTOMATIZADA** `horizonte-reconciliacion.integration.test.ts` usa PostgreSQL real y eventos de query de Prisma para contar cero INSERT, sin usar duración temporal como aserción principal

#### Scenario: SLOT-6.2 Horizonte parcialmente incompleto repone solo faltantes
- **GIVEN** un horizonte previamente completo al que un fixture local elimina tres claves naturales concretas
- **WHEN** se ejecuta nuevamente `asegurarHorizonte()`
- **THEN** ejecuta exactamente tres escrituras de slot, restaura esas claves y no reescribe ninguna de las existentes
- **PRUEBA AUTOMATIZADA** `horizonte-reconciliacion.integration.test.ts` elimina tres filas en PostgreSQL real, instrumenta queries y compara INSERT, claves y conteo final

#### Scenario: SLOT-6.3 Slots reservados y bloqueados cuentan como existentes
- **GIVEN** un horizonte completo donde un slot está `RESERVADO` y otro `BLOQUEADO`
- **WHEN** se vuelve a asegurar el horizonte
- **THEN** ambos se consideran presentes, conservan identificador y estado, y la reconciliación no ejecuta INSERT ni UPDATE para sus claves
- **PRUEBA AUTOMATIZADA** `horizonte-reconciliacion.integration.test.ts` cambia ambos estados en PostgreSQL real, registra queries y relee id/estado después de la ejecución

#### Scenario: SLOT-6.4 Dos reconciliaciones concurrentes convergen
- **GIVEN** un horizonte parcial y dos generadores que comienzan concurrentemente para la misma ancla
- **WHEN** ambos ejecutan `asegurarHorizonte()` con `Promise.all`
- **THEN** el advisory lock serializa la lectura de claves, cada clave termina una sola vez, la suma de insertados coincide con los faltantes y no se oculta ningún conflicto distinto de la clave natural
- **PRUEBA AUTOMATIZADA** `horizonte-reconciliacion.integration.test.ts` ejecuta ambos servicios contra PostgreSQL real, compara resultados, unicidad, queries y estados existentes
