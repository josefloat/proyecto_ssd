## ADDED Requirements

### Requirement: SLOT-7 Reconciliación por vigencia preserva ocupación materializada
Guardar una revisión SHALL reconciliar, bajo el mismo lock global del horizonte, únicamente las fechas de sus 28 días que caigan desde `vigenteDesde`: SHALL eliminar los slots de revisiones sustituidas que sigan `LIBRE`, materializar los `LIBRE` esperados por la nueva revisión y conservar sin cambios todo slot `RESERVADO` o `BLOQUEADO`. Antes de insertar, SHALL omitir cualquier intervalo que se solape con un slot preservado del mismo médico o consultorio. `asegurarHorizonte()` SHALL seleccionar la revisión aplicable por fecha y mantener su idempotencia.

#### Scenario: SLOT-7.1 La nueva vigencia sustituye solo disponibilidad libre
- **GIVEN** un horizonte con slots `LIBRE` de la revisión anterior y una nueva revisión vigente dentro del horizonte
- **WHEN** se guarda la revisión y se asegura nuevamente el horizonte
- **THEN** desaparecen solo los `LIBRE` sustituidos, aparecen exactamente los intervalos libres de la nueva revisión desde `vigenteDesde`, las fechas anteriores no cambian y una repetición ejecuta cero escrituras
- **PRUEBA AUTOMATIZADA** `programacion-reconciliacion.integration.test.ts` instrumenta INSERT/DELETE contra PostgreSQL real y compara claves, fronteras e idempotencia

#### Scenario: SLOT-7.2 Reservados y bloqueados sobreviven y evitan dobles intervalos
- **GIVEN** slots futuros `RESERVADO` y `BLOQUEADO` de la revisión anterior que se solapan por médico o consultorio con la nueva revisión
- **WHEN** se guarda y reconcilia el nuevo plan
- **THEN** ambos conservan id, programación histórica y estado, no se cancelan citas y no se crea ningún slot nuevo que se solape con ellos
- **PRUEBA AUTOMATIZADA** `programacion-reconciliacion.integration.test.ts` parametriza ambos estados, relee cita/slots y verifica ausencia de solapamientos y escrituras sobre los preservados
