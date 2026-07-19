# agenda-recepcion Specification

## Purpose
Definir la consulta de agenda semanal móvil y el registro seguro de pagos operados por recepción.

## Requirements

### Requirement: RECEP-1 Agenda diaria de recepción con filtros
`GET /personal/recepcion/agenda` SHALL exigir sesión RECEPCIONISTA y devolver la agenda global dentro de la ventana móvil de fechas civiles `fechaLima` `[hoy en America/Lima, hoy + 7 días)`: hoy y los seis días siguientes, con +7 excluido. SHALL incluir paciente, médico, especialidad, consultorio, fecha, hora y estado, ordenar cronológicamente y aceptar filtros combinables por especialidad, médico y estado sobre toda la ventana. La UI SHALL representar exactamente los siete días y marcar “Sin citas” los vacíos sin derivar la fecha desde UTC.

#### Scenario: RECEP-1.1 Ventana global y filtros combinados cubren mañana y +6
- **GIVEN** citas hoy, mañana, +6 y +7 entre distintas especialidades, médicos y estados
- **WHEN** RECEPCIÓN consulta sin filtros y luego combina especialidad+médico+estado
- **THEN** la primera respuesta incluye hoy, mañana y +6 pero excluye +7; la segunda contiene solo coincidencias de los tres filtros en cualquier día incluido, ordenadas por fecha/hora
- **PRUEBA AUTOMATIZADA** `agenda-recepcion.integration.test.ts` amplía los conjuntos exactos y filtros contra PostgreSQL real

#### Scenario: RECEP-1.2 Días y filtros vacíos son visibles sin inventar citas
- **GIVEN** días sin citas dentro de la ventana y una combinación de filtros sin coincidencias
- **WHEN** RECEPCIÓN consulta la agenda
- **THEN** los siete grupos siguen consultables, cada día vacío muestra “Sin citas” y ninguna cita de +7 o contraria a filtros aparece
- **PRUEBA AUTOMATIZADA** `agenda-recepcion.integration.test.ts` conserva los casos vacíos y el componente existente se verifica sin E2E nuevo

### Requirement: RECEP-2 Registro de pago, constancia y enlace de contacto
`POST /personal/recepcion/citas/:id/pago` SHALL exigir sesión RECEPCIONISTA, SHALL mover la cita de `RESERVADA` a `PAGADA` mediante una escritura condicionada al estado de origen dentro de una transacción, y SHALL responder `409` sin ninguna escritura cuando el estado de origen no sea `RESERVADA` o cuando otra solicitud ya haya ganado la transición; la constancia HTML imprimible y el enlace `wa.me` SHALL construirse únicamente a partir de datos reales de una cita `PAGADA` (paciente, médico, especialidad, consultorio, horario, código), sin ejecutar ninguna escritura adicional.

#### Scenario: RECEP-2.1 Pago exitoso habilita constancia y enlace real
- **GIVEN** una cita `RESERVADA` del día
- **WHEN** recepción registra el pago
- **THEN** la cita queda `PAGADA`, la constancia muestra paciente, médico, especialidad, consultorio, horario y código reales de esa cita, y el enlace `wa.me` se construye con el teléfono normalizado del paciente
- **PRUEBA AUTOMATIZADA** `agenda-recepcion.integration.test.ts` ejecuta el POST contra PostgreSQL real y compara estado y DTO devuelto; `personal-recepcion.spec.ts` (primer flujo Playwright) recorre login → agenda → detalle → pago → constancia → enlace con backend real

#### Scenario: RECEP-2.2 Estado no permitido y doble pago concurrente no duplican la transición
- **GIVEN** citas `PAGADA`, `CANCELADA`, `ATENDIDA` y `NO_ASISTIO`, y por separado una cita `RESERVADA` disputada por dos solicitudes de pago concurrentes
- **WHEN** se intenta registrar el pago sobre cada estado no permitido y, en paralelo, ambas solicitudes concurrentes se ejecutan sobre la misma cita
- **THEN** los cuatro estados no permitidos reciben `409` sin cambiar la cita; en la carrera solo una solicitud recibe `200` y la cita termina `PAGADA` exactamente una vez
- **PRUEBA AUTOMATIZADA** `agenda-recepcion.integration.test.ts` recorre los estados no permitidos y usa `Promise.allSettled` para la carrera contra la API/PostgreSQL reales
