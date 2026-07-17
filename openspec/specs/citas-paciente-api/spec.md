# citas-paciente-api Specification

## Purpose
TBD - created by archiving change reserva-consulta-cancelacion. Update Purpose after archive.
## Requirements
### Requirement: CITA-1 Identidad mínima del paciente sin sobrescritura
El sistema SHALL exigir nombre no vacío, DNI de exactamente ocho dígitos y teléfono de exactamente nueve dígitos para reservar; SHALL crear un único paciente por DNI en su primer uso; SHALL reutilizarlo únicamente cuando el teléfono normalizado coincida; SHALL conservar el nombre y teléfono originales sin actualizarlos desde este flujo; y SHALL permitir que distintos DNI compartan un teléfono.

#### Scenario: CITA-1.1 Alta y reutilización válida del paciente
- **GIVEN** dos slots libres, un DNI todavía inexistente y después el mismo DNI con el mismo teléfono normalizado
- **WHEN** el paciente confirma una cita en cada slot usando claves de idempotencia distintas
- **THEN** ambas citas referencian una sola fila de paciente, sus datos iniciales permanecen iguales y los dos slots quedan `RESERVADO`
- **PRUEBA AUTOMATIZADA** `patient-identity.integration.test.ts` usa Supertest y PostgreSQL real para confirmar unicidad, reutilización y teléfono compartible por otro DNI

#### Scenario: CITA-1.2 Datos inválidos o teléfono incompatible no escriben
- **GIVEN** casos parametrizados con DNI, teléfono o nombre inválidos y un DNI existente acompañado por un teléfono diferente
- **WHEN** cada caso intenta reservar un slot libre
- **THEN** la entrada inválida recibe `400 QUERY_INVALIDA`, la incompatibilidad recibe `409 DATOS_PACIENTE_NO_COINCIDEN` y ningún caso crea o modifica paciente, cita ni slot
- **PRUEBA AUTOMATIZADA** `patient-identity.integration.test.ts` recorre la tabla de variantes equivalentes con Supertest/PostgreSQL y compara el estado completo antes y después

### Requirement: CITA-2 Reserva atómica, idempotente y con código recuperable
`POST /citas` SHALL exigir `Idempotency-Key` UUID y un slot `LIBRE` cuyo `inicioUtc` sea estrictamente posterior a `ahora`, y SHALL confirmar en una sola transacción el cambio `Slot.LIBRE → RESERVADO`, la resolución del paciente y la creación de una cita `RESERVADA`; SHALL generar un código único `SV-` más ocho caracteres del alfabeto legible aprobado; SHALL reintentar toda la transacción con un código nuevo únicamente ante colisión de `codigoReserva`; SHALL devolver la misma cita y código para la misma clave y payload canónico; y SHALL responder `409` sin ninguna escritura cuando esa clave se reutilice con un payload diferente, cuando otra solicitud gane el slot o cuando el slot sea pasado o empiece exactamente ahora.

#### Scenario: CITA-2.1 Replay idéntico y colisión de código convergen en la misma cita
- **GIVEN** un slot libre, una clave y payload válidos, y un generador controlado cuyo primer código ya existe
- **WHEN** se confirma la reserva y después se repite la misma clave con exactamente el mismo payload
- **THEN** la colisión regenera el código sin `500`, ambas respuestas devuelven exactamente el mismo identificador y código final, y existe una sola cita, un solo paciente aplicable y un slot `RESERVADO`
- **PRUEBA AUTOMATIZADA** `booking-concurrency.integration.test.ts` fuerza la constraint única real, repite el POST con Supertest y compara cuerpos, conteos y estado PostgreSQL

#### Scenario: CITA-2.2 Clave divergente, frontera temporal y carrera no dejan writes parciales
- **GIVEN** una reserva ya confirmada, slots `LIBRE` pasado y con inicio exactamente en `ahora`, y por separado un slot futuro disputado por solicitudes válidas con claves distintas
- **WHEN** se reutiliza la primera clave con cada payload divergente parametrizado, se intenta reservar cada slot no futuro y las otras solicitudes se ejecutan concurrentemente
- **THEN** cada clave divergente recibe `409 IDEMPOTENCIA_EN_CONFLICTO` sin modificar cita, paciente ni slot; cada slot no futuro recibe `409 SLOT_NO_DISPONIBLE` sin crear paciente ni cita ni cambiar el slot; y en la carrera solo una solicitud recibe `201`, con una sola cita activa para el slot futuro
- **PRUEBA AUTOMATIZADA** `booking-concurrency.integration.test.ts` usa tablas parametrizadas para fingerprints y fronteras temporales y `Promise.allSettled` contra la API/PostgreSQL reales

### Requirement: CITA-3 Consulta privada exclusivamente por DNI y código
`POST /citas/consulta` SHALL aceptar solo DNI y código en el cuerpo, SHALL normalizar el código, SHALL devolver únicamente la cita que coincide con ambos datos con paciente, estado, vencimiento, especialidad, médico, consultorio y horario permitidos, y SHALL usar un único resultado de no encontrado para toda coincidencia parcial sin exponer teléfono, IDs internos, SQL, stack ni existencia independiente de DNI o código.

#### Scenario: CITA-3.1 El par correcto devuelve el detalle de cualquier estado visible
- **GIVEN** citas `RESERVADA` y `CANCELADA` con códigos de distintos pacientes
- **WHEN** cada paciente consulta usando su DNI y código correcto con variantes equivalentes de mayúsculas y separadores
- **THEN** recibe `200` con solo su detalle y estado real, sin teléfono ni datos de otra cita
- **PRUEBA AUTOMATIZADA** `appointment-lookup.integration.test.ts` consulta fixtures reales mediante Supertest y compara la allow-list completa del DTO

#### Scenario: CITA-3.2 Entrada inválida o coincidencia parcial no revela existencia
- **GIVEN** una tabla de DNI/código malformados y pares bien formados con DNI incorrecto, código incorrecto o ambos inexistentes
- **WHEN** se consulta cada combinación
- **THEN** los malformados reciben `400 QUERY_INVALIDA`, todos los pares bien formados sin coincidencia reciben el mismo `404 CITA_NO_ENCONTRADA` y ninguna respuesta distingue qué dato existía
- **PRUEBA AUTOMATIZADA** `appointment-lookup.integration.test.ts` parametriza las combinaciones con Supertest y compara status, cuerpo mínimo y ausencia de campos sensibles

### Requirement: CITA-4 Cancelación y expiración liberan el slot una sola vez
El sistema SHALL permitir cancelar solo una cita `RESERVADA` antes de `slot.inicioUtc`, SHALL hacer idempotente el reintento de esa misma cancelación, SHALL cambiarla atómicamente a `CANCELADA/PACIENTE` y liberar su slot; además SHALL fijar `venceEn = min(reservadaEn + 72 horas, slot.inicioUtc)`, SHALL materializar una cita `RESERVADA` como `CANCELADA/EXPIRACION` al alcanzar ese instante y liberar el slot antes de disponibilidad, reserva, consulta o cancelación; carreras entre ambas operaciones SHALL producir una única transición y una única liberación.

#### Scenario: CITA-4.1 Cancelación válida e idempotente conserva la historia
- **GIVEN** una cita `RESERVADA` cuyo slot todavía no comenzó y credenciales DNI+código correctas
- **WHEN** el paciente cancela y repite la misma solicitud
- **THEN** ambas respuestas convergen en la misma cita `CANCELADA/PACIENTE`, `canceladaEn` no cambia, el slot queda `LIBRE` y la cita histórica no se elimina
- **PRUEBA AUTOMATIZADA** `appointment-lifecycle.integration.test.ts` ejecuta ambos POST contra PostgreSQL real y compara cita, timestamps, conteos y slot

#### Scenario: CITA-4.2 Vencimiento, estados no permitidos y carreras no duplican la liberación
- **GIVEN** fixtures cuyo límite es 72 horas y cuyo slot inicia antes de esas 72 horas, cada uno a un milisegundo antes y exactamente en su `venceEn`, citas `PAGADA`, `ATENDIDA` o `NO_ASISTIO`, y una cita vencida disputada concurrentemente por cancelación y expiración
- **WHEN** una operación pública aplica expiraciones o intenta cancelar cada caso
- **THEN** cada `venceEn` es posterior a `reservadaEn`, no supera 72 horas ni `slot.inicioUtc`; antes del límite la cita sigue `RESERVADA`; en el límite pasa una vez a `CANCELADA/EXPIRACION` y libera el slot; los estados no permitidos reciben conflicto sin cambios; y la carrera termina con un solo motivo persistido y el slot `LIBRE` una sola vez
- **PRUEBA AUTOMATIZADA** `appointment-lifecycle.integration.test.ts` congela el reloj, parametriza estados y ejecuta la carrera contra la API/PostgreSQL reales
