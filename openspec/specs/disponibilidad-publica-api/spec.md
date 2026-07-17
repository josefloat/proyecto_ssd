# disponibilidad-publica-api Specification

## Purpose
TBD - created by archiving change disponibilidad-publica. Update Purpose after archive.
## Requirements
### Requirement: PUB-1 Catálogo público de especialidades mínimo y canónico
El sistema SHALL exponer `GET /especialidades` sin autenticación, SHALL devolver exclusivamente `id` y `nombre` dentro de `items`, y SHALL ordenar las especialidades según `ESPECIALIDADES_CANONICAS` sin inventar elementos ausentes.

#### Scenario: PUB-1.1 Especialidades existentes en orden canónico
- **GIVEN** PostgreSQL contiene las seis especialidades canónicas con sus identificadores
- **WHEN** un cliente solicita `GET /especialidades`
- **THEN** recibe `200` con seis items en el orden canónico y cada item contiene exactamente `id` y `nombre`
- **PRUEBA AUTOMATIZADA** `public-specialties.integration.test.ts` usa Supertest contra la app y PostgreSQL reales, compara orden, claves y ausencia de `duracionCitaMinutos`

#### Scenario: PUB-1.2 Catálogo vacío no se rellena desde el frontend
- **GIVEN** PostgreSQL no contiene especialidades
- **WHEN** un cliente solicita `GET /especialidades`
- **THEN** recibe `200` con `{ "items": [] }` y ningún dato sintético de respaldo
- **PRUEBA AUTOMATIZADA** `public-specialties.integration.test.ts` limpia el catálogo real, invoca el endpoint y compara el cuerpo exacto

#### Scenario: PUB-1.3 Catálogo temporalmente indisponible
- **GIVEN** la dependencia de almacenamiento del catálogo falla mediante un fixture local sin exponer credenciales
- **WHEN** un cliente solicita `GET /especialidades`
- **THEN** recibe `503` con el error estable `SERVICIO_NO_DISPONIBLE`, sin stack, SQL ni URL interna
- **PRUEBA AUTOMATIZADA** `public-api-errors.integration.test.ts` inyecta el servicio fallido en la app Supertest y verifica status y allow-list del error

### Requirement: PUB-2 Médicos públicos filtrados por especialidad
El sistema SHALL exponer `GET /especialidades/:especialidadId/medicos` sin autenticación, SHALL devolver la especialidad seleccionada y `items` con exclusivamente `id` y `nombre`, ordenados por nombre e identificador, y SHALL distinguir entrada inválida de recurso inexistente.

#### Scenario: PUB-2.1 Médicos de la especialidad existente
- **GIVEN** una especialidad existente con dos médicos y otro médico de una especialidad distinta
- **WHEN** un cliente solicita `GET /especialidades/:especialidadId/medicos`
- **THEN** recibe `200`, la especialidad mínima y solo los dos médicos relacionados en orden determinista, sin horas, fotografía, rating ni próxima cita
- **PRUEBA AUTOMATIZADA** `public-doctors.integration.test.ts` usa Supertest y PostgreSQL reales y compara el DTO completo y sus claves permitidas

#### Scenario: PUB-2.2 Especialidad existente sin médicos
- **GIVEN** una especialidad existente que no tiene médicos relacionados
- **WHEN** un cliente solicita sus médicos
- **THEN** recibe `200`, la especialidad solicitada y `items: []`
- **PRUEBA AUTOMATIZADA** `public-doctors.integration.test.ts` persiste la especialidad sin médicos en PostgreSQL real y compara la respuesta exacta

#### Scenario: PUB-2.3 Identificador inválido o especialidad inexistente
- **GIVEN** un identificador que no es UUID y un UUID válido que no existe
- **WHEN** se solicita el endpoint con cada valor
- **THEN** el primero recibe `400 QUERY_INVALIDA`, el segundo `404 RECURSO_NO_ENCONTRADO` y ninguno filtra detalles internos
- **PRUEBA AUTOMATIZADA** `public-doctors.integration.test.ts` recorre ambos casos con Supertest y verifica códigos, cuerpos y ausencia de consulta para el UUID malformado

### Requirement: PUB-3 Disponibilidad pública cubre 28 fechas y solo slots libres
El sistema SHALL exponer `GET /disponibilidad` sin autenticación, SHALL asegurar y devolver el intervalo semiabierto `[hoy Lima, hoy Lima + 28 días)`, SHALL incluir exactamente sus 28 fechas civiles, zona `America/Lima` y únicamente slots `LIBRE`, y SHALL fijar `Cache-Control: no-store`.

#### Scenario: PUB-3.1 Horizonte completo con DTO mínimo y ordenado
- **GIVEN** una fecha de reloj Lima fija, una especialidad con slots libres, reservados y bloqueados dentro y fuera del horizonte
- **WHEN** un cliente solicita `GET /disponibilidad?especialidadId=<uuid>`
- **THEN** recibe `200`, `zonaHoraria: "America/Lima"`, las 28 fechas exactas, `desde` y `hastaExclusiva`, header `Cache-Control: no-store` e items libres ordenados con solo `id`, `fechaLima`, `inicioUtc`, `finUtc`, médico y consultorio
- **PRUEBA AUTOMATIZADA** `public-availability.integration.test.ts` usa reloj inyectado, Supertest y PostgreSQL reales para comparar fronteras, las 28 fechas, orden, estados excluidos y allow-list del DTO

#### Scenario: PUB-3.2 Horizonte válido sin slots disponibles
- **GIVEN** una especialidad existente sin slots libres en las próximas 28 fechas
- **WHEN** un cliente consulta su disponibilidad
- **THEN** recibe `200`, el horizonte con exactamente 28 fechas y `items: []`
- **PRUEBA AUTOMATIZADA** `public-availability.integration.test.ts` carga únicamente slots bloqueados/reservados o ninguna programación y verifica horizonte y vacío contra PostgreSQL real

#### Scenario: PUB-3.3 Query ausente, repetida o malformada
- **GIVEN** solicitudes sin `especialidadId`, con el parámetro repetido o con UUID malformado
- **WHEN** llegan a `GET /disponibilidad`
- **THEN** cada una recibe `400 QUERY_INVALIDA` antes de asegurar el horizonte o consultar slots
- **PRUEBA AUTOMATIZADA** `public-availability-validation.domain.test.ts` usa Vitest AAA con spies no invocados y `public-availability.integration.test.ts` confirma los tres status mediante Supertest

### Requirement: PUB-4 Filtro opcional de médico mantiene coherencia y errores controlados
El sistema SHALL aceptar un único `medicoId` opcional en `GET /disponibilidad`, SHALL devolver solo slots de ese médico cuando pertenece a la especialidad, SHALL responder `404` por recursos inexistentes, `422` por relación especialidad-médico incompatible y `503` por indisponibilidad interna.

#### Scenario: PUB-4.1 Médico válido reduce la disponibilidad
- **GIVEN** una especialidad con slots libres de dos médicos y uno de ellos pertenece a la especialidad solicitada
- **WHEN** un cliente consulta disponibilidad con su `medicoId`
- **THEN** recibe `200`, conserva el horizonte completo y todos los items pertenecen exclusivamente a ese médico
- **PRUEBA AUTOMATIZADA** `public-availability.integration.test.ts` crea ambos médicos y slots en PostgreSQL real y compara identificadores, fechas y orden

#### Scenario: PUB-4.2 Recurso inexistente o médico de otra especialidad
- **GIVEN** un UUID inexistente de especialidad, un UUID inexistente de médico y un médico existente de otra especialidad
- **WHEN** se consulta disponibilidad con cada combinación
- **THEN** los recursos inexistentes reciben `404 RECURSO_NO_ENCONTRADO` y la combinación incompatible recibe `422 MEDICO_NO_PERTENECE_ESPECIALIDAD`
- **PRUEBA AUTOMATIZADA** `public-availability.integration.test.ts` ejecuta los tres casos con Supertest/PostgreSQL real y verifica que no se devuelven slots

#### Scenario: PUB-4.3 Servicio interno no disponible
- **GIVEN** una especialidad válida y un fixture local cuyo servicio de horizonte o consulta falla
- **WHEN** un cliente solicita disponibilidad
- **THEN** recibe `503 SERVICIO_NO_DISPONIBLE` sin datos parciales, pacientes, estado de slots, stack ni secretos
- **PRUEBA AUTOMATIZADA** `public-api-errors.integration.test.ts` inyecta cada fallo en la app Supertest y compara el envelope mínimo sin llamar servicios externos
