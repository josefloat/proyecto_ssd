# catalogo-agenda Specification

## Purpose
TBD - created by archiving change motor-de-disponibilidad. Update Purpose after archive.
## Requirements
### Requirement: CAT-1 Seed de especialidades canónicas
El sistema SHALL sembrar exactamente las especialidades canónicas Medicina General (20 min), Cardiología (30 min), Pediatría (20 min), Traumatología (30 min), Ginecología (30 min) y Dermatología (15 min), usando el nombre canónico y no las etiquetas amigables de presentación.

#### Scenario: CAT-1.1 Catálogo canónico completo
- **GIVEN** una base migrada sin especialidades
- **WHEN** el seed persiste el catálogo confirmado
- **THEN** existen exactamente las seis especialidades con sus nombres y duraciones establecidos
- **PRUEBA AUTOMATIZADA** `catalogo-seed.integration.test.ts` ejecuta el seed contra PostgreSQL real y compara el conjunto completo

#### Scenario: CAT-1.2 Fixture de especialidad divergente
- **GIVEN** un fixture local que cambia el nombre o duración de una especialidad confirmada
- **WHEN** la validación previa del seed procesa ese fixture
- **THEN** rechaza la divergencia antes de persistir un catálogo parcial
- **PRUEBA AUTOMATIZADA** `catalogo.domain.test.ts` usa Vitest AAA con fixtures de nombre y duración incorrectos y espera el error de dominio

### Requirement: CAT-2 Médico pertenece a una especialidad y declara horas semanales
El sistema SHALL persistir cada médico con nombre, horas semanales positivas y una relación obligatoria con una especialidad existente.

#### Scenario: CAT-2.1 Médico válido relacionado
- **GIVEN** una especialidad existente y un médico con horas semanales positivas
- **WHEN** el catálogo persiste al médico
- **THEN** el médico conserva sus horas y referencia exactamente esa especialidad
- **PRUEBA AUTOMATIZADA** `catalogo.integration.test.ts` inserta y relee la relación con Prisma contra PostgreSQL real

#### Scenario: CAT-2.2 Horas o especialidad inválidas
- **GIVEN** un médico con cero horas o una especialidad inexistente
- **WHEN** se intenta persistir el registro
- **THEN** PostgreSQL rechaza la operación por check o FK y no deja un médico parcial
- **PRUEBA AUTOMATIZADA** `catalogo.integration.test.ts` prueba ambos casos contra PostgreSQL real y verifica ausencia de la fila

### Requirement: CAT-3 Consultorios únicos y turnos inmutables
El sistema SHALL persistir consultorios con identificador público único y SHALL limitar los turnos a `MANANA`, `TARDE` y `NOCHE`, cuyos límites Lima son respectivamente 09:00–13:00, 15:00–19:00 y 19:00–23:00.

#### Scenario: CAT-3.1 Catálogo fijo de turnos
- **GIVEN** el catálogo de turnos del dominio
- **WHEN** se consultan sus valores y límites
- **THEN** contiene exactamente los tres turnos y horarios establecidos
- **PRUEBA AUTOMATIZADA** `turnos.domain.test.ts` compara el mapa completo de enum a horarios usando Vitest AAA

#### Scenario: CAT-3.2 Consultorio duplicado o turno ajeno al enum
- **GIVEN** un consultorio con clave ya usada o una programación con un turno no catalogado
- **WHEN** el fixture intenta persistirlos
- **THEN** PostgreSQL rechaza la unicidad o el valor de enum sin alterar los registros válidos
- **PRUEBA AUTOMATIZADA** `catalogo.integration.test.ts` ejecuta ambos intentos contra PostgreSQL real y verifica las restricciones

### Requirement: CAT-4 Duración de especialidad dentro del rango operativo
El sistema SHALL aceptar una duración de cita entera entre 1 y 240 minutos, inclusive, y SHALL rechazar 0, valores negativos y valores mayores de 240 antes de que puedan usarse para generar slots.

#### Scenario: CAT-4.1 Duración válida que no divide el turno
- **GIVEN** una especialidad con duración entera de 25 minutos
- **WHEN** se validan y persisten sus datos
- **THEN** la duración es aceptada aunque no divida exactamente los 240 minutos del turno
- **PRUEBA AUTOMATIZADA** `catalogo-duracion.integration.test.ts` ejecuta la validación de dominio y persiste 25 minutos contra PostgreSQL real

#### Scenario: CAT-4.2 Duración fuera del rango permitido
- **GIVEN** especialidades con duración 0, -1 o 241 minutos
- **WHEN** se intenta validarlas y persistirlas
- **THEN** cada valor se rechaza y no queda ninguna fila inválida
- **PRUEBA AUTOMATIZADA** `catalogo-duracion.integration.test.ts` recorre los tres límites con Vitest AAA y confirma el check contra PostgreSQL real
