## ADDED Requirements

### Requirement: RECEP-1 Agenda diaria de recepción con filtros
`GET /personal/recepcion/agenda` SHALL exigir sesión RECEPCIONISTA, SHALL devolver las citas cuyo slot cae en la fecha Lima solicitada (por defecto hoy) con paciente, médico, especialidad, consultorio, hora y estado, y SHALL aceptar filtros opcionales por especialidad, médico y estado de cita combinables entre sí.

#### Scenario: RECEP-1.1 Agenda del día con filtros combinados
- **GIVEN** citas del día en distintos estados, especialidades y médicos, más citas de otras fechas
- **WHEN** recepción solicita la agenda sin filtros y después con especialidad+médico+estado combinados
- **THEN** la primera respuesta incluye exactamente las citas de ese día Lima con sus datos permitidos, y la segunda incluye únicamente las que cumplen los tres filtros a la vez
- **PRUEBA AUTOMATIZADA** `agenda-recepcion.integration.test.ts` usa Supertest/PostgreSQL reales y compara conjuntos exactos por combinación de filtros

#### Scenario: RECEP-1.2 Día o filtro sin coincidencias no inventa citas
- **GIVEN** una fecha Lima sin ninguna cita y, por separado, una combinación de filtros que ninguna cita cumple
- **WHEN** recepción consulta cada caso
- **THEN** ambos reciben `200` con lista vacía, sin error ni datos de otras fechas o filtros
- **PRUEBA AUTOMATIZADA** `agenda-recepcion.integration.test.ts` verifica ambos casos contra PostgreSQL real

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
