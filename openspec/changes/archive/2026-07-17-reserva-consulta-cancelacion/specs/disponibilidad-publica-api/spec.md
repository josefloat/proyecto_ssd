## MODIFIED Requirements

### Requirement: PUB-3 Disponibilidad pública cubre 28 fechas y solo slots libres futuros
El sistema SHALL exponer `GET /disponibilidad` sin autenticación, SHALL asegurar y devolver el intervalo semiabierto `[hoy Lima, hoy Lima + 28 días)`, SHALL incluir exactamente sus 28 fechas civiles, zona `America/Lima` y únicamente slots `LIBRE` cuyo `inicioUtc` sea estrictamente posterior a `ahora`, y SHALL fijar `Cache-Control: no-store`.

#### Scenario: PUB-3.1 Horizonte completo con DTO mínimo, futuro y ordenado
- **GIVEN** una fecha y hora de reloj Lima fijas, una especialidad con slots libres pasados, con inicio exactamente en `ahora` y futuros, además de slots reservados y bloqueados dentro y fuera del horizonte
- **WHEN** un cliente solicita `GET /disponibilidad?especialidadId=<uuid>`
- **THEN** recibe `200`, `zonaHoraria: "America/Lima"`, las 28 fechas exactas, `desde` y `hastaExclusiva`, header `Cache-Control: no-store` e items exclusivamente `LIBRE` con `inicioUtc > ahora`, ordenados y con solo `id`, `fechaLima`, `inicioUtc`, `finUtc`, médico y consultorio
- **PRUEBA AUTOMATIZADA** `public-availability.integration.test.ts` usa reloj inyectado, Supertest y PostgreSQL reales para comparar fronteras, las 28 fechas, orden, estados y tiempos excluidos y allow-list del DTO

#### Scenario: PUB-3.2 Horizonte válido sin slots disponibles
- **GIVEN** una especialidad existente sin slots libres futuros en las próximas 28 fechas
- **WHEN** un cliente consulta su disponibilidad
- **THEN** recibe `200`, el horizonte con exactamente 28 fechas y `items: []`
- **PRUEBA AUTOMATIZADA** `public-availability.integration.test.ts` carga únicamente slots pasados, bloqueados, reservados o ninguna programación y verifica horizonte y vacío contra PostgreSQL real

#### Scenario: PUB-3.3 Query ausente, repetida o malformada
- **GIVEN** solicitudes sin `especialidadId`, con el parámetro repetido o con UUID malformado
- **WHEN** llegan a `GET /disponibilidad`
- **THEN** cada una recibe `400 QUERY_INVALIDA` antes de asegurar el horizonte o consultar slots
- **PRUEBA AUTOMATIZADA** `public-availability-validation.domain.test.ts` usa Vitest AAA con spies no invocados y `public-availability.integration.test.ts` confirma los tres status mediante Supertest
