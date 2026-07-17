## ADDED Requirements

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
