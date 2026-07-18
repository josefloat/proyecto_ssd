## ADDED Requirements

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
