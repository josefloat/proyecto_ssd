## MODIFIED Requirements

### Requirement: MEDICO-1 Agenda diaria del médico, exclusivamente de lectura
`GET /personal/medico/agenda` SHALL exigir sesión MEDICO y devolver únicamente las citas del `Medico` vinculado al Usuario dentro de la ventana móvil de fechas civiles `fechaLima` `[hoy en America/Lima, hoy + 7 días)`: hoy y los seis días siguientes, con +7 excluido. SHALL ordenar cronológicamente, incluir fecha y hora y permitir que la UI represente exactamente los siete días, marcando “Sin citas” los vacíos sin derivar la fecha desde UTC. El rol MEDICO SHALL no disponer de ninguna ruta de escritura de cita, paciente o agenda.

#### Scenario: MEDICO-1.1 Ventana propia incluye mañana y +6, excluye +7 y otros médicos
- **GIVEN** citas propias hoy, mañana, día +6 y +7, más una cita de otro médico dentro de la ventana
- **WHEN** el MEDICO consulta su agenda
- **THEN** recibe solo sus citas de hoy, mañana y +6 ordenadas por `fechaLima`/hora; +7 y el otro médico quedan excluidos, y los días intermedios vacíos aparecen como “Sin citas”
- **PRUEBA AUTOMATIZADA** `agenda-medico.integration.test.ts` amplía el conjunto exacto contra PostgreSQL real y el componente existente se verifica sin E2E nuevo

#### Scenario: MEDICO-1.2 La ventana completa continúa exclusivamente de lectura
- **GIVEN** una sesión MEDICO y citas propias en varios días de la ventana
- **WHEN** recorre todos los grupos e intenta las rutas de escritura existentes
- **THEN** ve fecha/hora sin controles de mutación y cada escritura responde `403` sin cambiar citas, pacientes ni agenda
- **PRUEBA AUTOMATIZADA** `agenda-medico.integration.test.ts` conserva la tabla de rutas prohibidas y `personal-medico.spec.ts` existente confirma UI de solo lectura
