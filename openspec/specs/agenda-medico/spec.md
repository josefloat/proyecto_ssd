# agenda-medico Specification

## Purpose
Definir la agenda diaria de solo lectura disponible para cada médico autenticado.

## Requirements

### Requirement: MEDICO-1 Agenda diaria del médico, exclusivamente de lectura
`GET /personal/medico/agenda` SHALL exigir sesión con rol MEDICO, SHALL devolver únicamente las citas del día Lima cuyo slot pertenece al `Medico` vinculado a ese `Usuario` (vía `medicoId`), y el rol MEDICO SHALL no tener disponible ninguna ruta bajo `/personal/**` que escriba datos de cita, paciente o agenda.

#### Scenario: MEDICO-1.1 El médico ve exactamente su propia agenda del día
- **GIVEN** citas del día Lima repartidas entre dos médicos distintos
- **WHEN** el usuario MEDICO vinculado al primer médico consulta su agenda
- **THEN** recibe `200` con únicamente las citas de su propio médico para ese día, sin citas del segundo médico
- **PRUEBA AUTOMATIZADA** `agenda-medico.integration.test.ts` usa Supertest/PostgreSQL reales y compara el conjunto exacto por `medicoId`

#### Scenario: MEDICO-1.2 Ninguna acción de escritura es alcanzable para el rol médico
- **GIVEN** una sesión válida de rol MEDICO y una cita real de su propia agenda
- **WHEN** intenta `POST /personal/recepcion/citas/:id/pago` y cualquier otro verbo de escritura bajo `/personal/**`
- **THEN** todos responden `403` antes de tocar la base de datos y la cita permanece con su estado original
- **PRUEBA AUTOMATIZADA** `agenda-medico.integration.test.ts` recorre las rutas de escritura existentes con Supertest/PostgreSQL reales y confirma ausencia de cambios; `personal-medico.spec.ts` (segundo flujo Playwright) confirma que la UI del médico no ofrece ningún control de escritura
