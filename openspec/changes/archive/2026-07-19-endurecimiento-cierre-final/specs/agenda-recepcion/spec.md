## MODIFIED Requirements

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
