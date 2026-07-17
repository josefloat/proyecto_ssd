## Context

El backend actual solo contiene infraestructura y health checks. Este cambio introduce el primer modelo de dominio: una programación semanal recurrente se proyecta en slots persistidos para que el siguiente cambio pueda exponer disponibilidad sin calcularla durante cada respuesta HTTP.

La clínica opera en `America/Lima` y todos los instantes se guardan en UTC. El frontend ya usa un Route Handler same-origin con timeout upstream de 10 segundos, pero este cambio no modifica el frontend ni publica endpoints. El seed de Prisma será la fuente determinista de catálogos y programación hasta que `panel-admin` incorpore su gestión en Sprint 4.

## Goals / Non-Goals

**Goals:**

- Modelar especialidades, médicos, consultorios, programación semanal y slots con invariantes verificables.
- Completar las 28 fechas civiles del horizonte `[hoy Lima, hoy Lima + 28 días)` mediante un único servicio idempotente.
- Reutilizar exactamente el mismo servicio de horizonte desde el seed, pruebas y producción.
- Consultar internamente slots libres por `fechaLima` y bloquear slots concretos sin alterar la programación.
- Hacer que migración y seed sean un único gate previo a todos los despliegues.

**Non-Goals:**

- `GET /disponibilidad`, DTO público o cualquier endpoint nuevo.
- Reserva, cita, paciente, autenticación o autorización.
- Frontend, pantallas o paneles de cualquier rol.
- Vigencia, versionado, edición o supersesión de `ProgramacionSemanal`; se diseñarán en `panel-admin` durante Sprint 4.
- Resolver el cold start de Render o cambiar el timeout del Route Handler.

## Decisions

### 1. Modelo de datos y catálogo fijo

Prisma incorporará:

- `Turno`: enum fijo `MANANA | TARDE | NOCHE`, interpretado como 09:00–13:00, 15:00–19:00 y 19:00–23:00 en Lima.
- `EstadoSlot`: enum `LIBRE | RESERVADO | BLOQUEADO`.
- `Especialidad`: nombre canónico único y duración entera entre 1 y 240 minutos, inclusive.
- `Medico`: nombre, horas semanales positivas y relación obligatoria con una especialidad.
- `Consultorio`: nombre o código único.
- `ProgramacionSemanal`: médico, día ISO `1..7`, turno y consultorio.
- `Slot`: programación de origen, `inicioUtc`, `finUtc`, `fechaLima` y estado.

Las colisiones se eliminan en el origen mediante:

```prisma
@@unique([medicoId, diaSemana, turno])
@@unique([consultorioId, diaSemana, turno])
```

Así, un médico no puede estar en dos consultorios y un consultorio no puede alojar dos médicos durante el mismo turno semanal. Se descarta un constraint de rangos sobre `Slot`: las programaciones mutuamente excluyentes y los intervalos consecutivos de una misma programación hacen el solapamiento imposible por construcción. En Sprint 4, el versionado de programación deberá revisar expresamente estas dos unicidades; no se añaden ahora campos de vigencia sin requisito ni prueba.

La clave natural e idempotente de slot será exclusivamente:

```prisma
@@unique([programacionSemanalId, inicioUtc])
```

Ninguna colisión distinta se tratará como duplicado inocuo.

PostgreSQL añade un check explícito para `diaSemana BETWEEN 1 AND 7`; los valores 0 y 8 se rechazan aunque una escritura interna eluda la validación de aplicación.

Para proteger el límite de horas semanales contra write-skew, el servicio abre una transacción y ejecuta `SELECT ... FOR UPDATE` sobre la fila de `Medico` antes de sumar sus programaciones e insertar la nueva. Dos solicitudes del mismo médico se serializan sobre esa fila: la segunda espera, adquiere el lock, recalcula el total ya actualizado y solo entonces decide si inserta o rechaza. Se prefiere este lock de fila a confiar únicamente en el aislamiento por defecto, que permitiría que ambas transacciones leyesen el mismo total anterior.

### 2. Seed determinista y única fuente del algoritmo

El seed define exactamente estas especialidades canónicas:

| Especialidad | Duración |
| --- | ---: |
| Medicina General | 20 min |
| Cardiología | 30 min |
| Pediatría | 20 min |
| Traumatología | 30 min |
| Ginecología | 30 min |
| Dermatología | 15 min |

Los nombres amigables de Stitch pertenecen a presentación y no se guardan como nombre de dominio. El fixture versionado incluirá, además, al menos un médico por especialidad, consultorios y programaciones sin colisiones, todos con claves estables. Los nombres sintéticos exactos de médicos y consultorios son datos técnicos del fixture, no requisitos funcionales; su conjunto completo se comparará en pruebas para impedir deriva accidental.

`prisma db seed` hará upsert por claves naturales y llamará a `asegurarHorizonte(fechaAncla)`. No contendrá una segunda implementación de fechas o slots. La fecha ancla se inyecta explícitamente en pruebas; si se omite, el adaptador de reloj obtiene la fecha civil actual mediante `America/Lima`. Repetir el seed no duplica catálogos, programaciones ni slots y no cambia el estado de slots existentes.

### 3. Horizonte y conversión temporal

`asegurarHorizonte(ancla)` recibe una fecha civil `YYYY-MM-DD` validada. Recorre todas las fechas del intervalo semiabierto `[ancla, ancla + 28 días)`; para cada programación cuyo día ISO coincide, crea todos los intervalos definidos por la duración de su especialidad dentro del turno. Con la base vacía cubre las 28 fechas, no solo la fecha 28.

Toda especialidad admite una duración entera entre 1 y 240 minutos. El generador avanza desde el inicio del turno en intervalos de esa duración y materializa un slot únicamente cuando su fin no supera el cierre: nunca extiende el turno ni crea un slot parcial. Si queda un remanente menor que la duración, se descarta. Por ejemplo, 25 minutos dentro de `MANANA` 09:00–13:00 producen exactamente nueve slots; el último va de 12:20 a 12:45 y los 15 minutos restantes no son reservables.

`inicioUtc` y `finUtc` se persisten como `timestamptz`; `fechaLima` se persiste como `DATE`. `fechaLima` nunca forma parte de una entrada externa: el generador la deriva de la fecha civil que está proyectando. Un check de PostgreSQL exige que coincida con `(inicioUtc AT TIME ZONE 'America/Lima')::date`, evitando inconsistencias incluso ante una escritura interna defectuosa. Caso crítico: un turno `NOCHE` del 2026-07-17 empieza a las 19:00 Lima, se guarda como `2026-07-18T00:00:00Z` y conserva `fechaLima = 2026-07-17`.

Todas las consultas internas por día filtran `fechaLima`; no truncan `inicioUtc` según la zona del proceso.

### 4. Concurrencia de todas las operaciones actuales sobre slots

| Operación | Transacción y bloqueo | Constraint/predicado | Resultado ante carrera |
| --- | --- | --- | --- |
| Generar horizonte | Transacción corta con `pg_advisory_xact_lock` global del generador | `UNIQUE(programacionSemanalId, inicioUtc)` | Las ejecuciones se serializan; cada insert usa `ON CONFLICT` únicamente sobre esa clave y las repeticiones convergen |
| Consultar internamente | Lectura por sentencia | `estado = LIBRE` y `fechaLima` | Devuelve un snapshot consistente sin bloquear al generador o bloqueador |
| Bloquear slot | `UPDATE` condicional atómico dentro de transacción | `WHERE id = ? AND estado = LIBRE` | Solo una transición gana; reintentar un bloqueo ya aplicado es idempotente y `RESERVADO` produce conflicto |

No se usará `createMany({ skipDuplicates: true })`: podría ocultar una violación distinta de la clave natural. El SQL `ON CONFLICT (programacionSemanalId, inicioUtc) DO NOTHING` será explícito. Cualquier FK, check u otra unicidad fallará y revertirá la transacción.

### 5. Tabla de transición de estados

| Estado origen | Operación | Estado destino | En este cambio | Resultado |
| --- | --- | --- | --- | --- |
| inexistente | generar | `LIBRE` | Sí | Inserción; conflicto natural exacto es idempotente |
| `LIBRE` | bloquear | `BLOQUEADO` | Sí | Update condicional atómico |
| `BLOQUEADO` | bloquear | `BLOQUEADO` | Sí | Reintento idempotente sin nueva transición |
| `RESERVADO` | bloquear | `BLOQUEADO` | No | Conflicto; no se sobrescribe |
| `LIBRE` | reservar | `RESERVADO` | No | Pertenece a reserva de cita |
| `BLOQUEADO` | liberar | `LIBRE` | No | Se definirá con el panel administrativo |
| `RESERVADO` | cancelar/liberar | `LIBRE` | No | Pertenece al ciclo de cita |

`RESERVADO` forma parte del modelo y de las pruebas de exclusión/conflicto, pero este cambio no implementa la operación de reservar.

### 6. Servicio interno de consulta

El servicio recibe filtros tipados de especialidad, médico opcional y `fechaLima`, valida la fecha civil y devuelve solamente slots `LIBRE` ordenados por inicio y médico. Es una frontera de aplicación, no Express: `disponibilidad-publica` decidirá el contrato HTTP, validación de query, DTO y exposición sin autenticación.

Como no existe una superficie HTTP nueva en este cambio, las integraciones de dominio se prueban directamente contra PostgreSQL real mediante Prisma. Supertest se aplicará en `disponibilidad-publica`, cuando exista un endpoint. Forzar un endpoint solo para satisfacer la herramienta de prueba contradiría el alcance confirmado.

### 7. Gate de migración y seed

El job existente de migración ejecutará, en este orden:

1. `prisma migrate deploy` con `DIRECT_URL`.
2. `prisma db seed` con las variables de conexión requeridas.
3. Solo si ambos terminan en verde, habilitar `deploy-render` y `deploy-vercel`.

El seed se prueba contra PostgreSQL real con una fecha fija. El orden y el bloqueo de despliegues se verifican con un fixture local del gate y validación automatizada del DAG del workflow; no se provoca un fallo real en Neon, Render o Vercel.

El escenario histórico de `DIRECT_URL` inválida conserva su mecanismo independiente: el input `workflow_dispatch.force_invalid_direct_url` sustituye solo la URL directa por una conexión local inalcanzable, hace fallar `prisma migrate deploy` y confirma que seed y despliegues quedan omitidos. El fallo deliberado del seed usa otro fixture local, ejecutado después de una migración válida, para demostrar por separado que ambos despliegues también quedan bloqueados sin llamar a Neon, Render o Vercel.

### 8. Estrategia de pruebas y trazabilidad

- Vitest en patrón Arrange/Act/Assert para fecha civil, turnos, intervalos, validaciones y estados.
- Prisma contra PostgreSQL real de Docker para migración, constraints, seed, generación concurrente, consultas y bloqueos.
- Fixtures locales para los caminos negativos del pipeline.
- Cobertura de líneas mínima de 80% sobre `src/domain/**`.
- Cada escenario tiene una prueba prevista y cada tarea enumera los escenarios que cierra.

## Matriz requisito → escenario → prueba ejecutada → tarea

Todas las filas participan además en la suite, cobertura y auditoría final de la tarea 5.1.

| Requisito | Escenario | Prueba automatizada ejecutada | Tarea primaria |
| --- | --- | --- | --- |
| CAT-1 | CAT-1.1 Catálogo canónico completo | `catalogo-seed.integration.test.ts` | 4.1 |
| CAT-1 | CAT-1.2 Fixture de especialidad divergente | `catalogo.domain.test.ts` | 1.2 |
| CAT-2 | CAT-2.1 Médico válido relacionado | `catalogo.integration.test.ts` | 1.1 |
| CAT-2 | CAT-2.2 Horas o especialidad inválidas | `catalogo.integration.test.ts` | 1.1 |
| CAT-3 | CAT-3.1 Catálogo fijo de turnos | `turnos.domain.test.ts` | 1.2 |
| CAT-3 | CAT-3.2 Consultorio duplicado o turno ajeno al enum | `catalogo.integration.test.ts` | 1.1 |
| CAT-4 | CAT-4.1 Duración válida que no divide el turno | `catalogo-duracion.integration.test.ts` | 1.2 |
| CAT-4 | CAT-4.2 Duración fuera de 1..240 | `catalogo-duracion.integration.test.ts` | 1.1, 1.2 |
| PROG-1 | PROG-1.1 Recursos distintos comparten franja | `programacion.integration.test.ts` | 2.1 |
| PROG-1 | PROG-1.2 Colisión de médico o consultorio | `programacion.integration.test.ts` | 2.1 |
| PROG-1 | PROG-1.3 Día ISO fuera de 1..7 | `programacion.integration.test.ts` | 2.1 |
| PROG-2 | PROG-2.1 Asignaciones dentro del máximo | `programacion.integration.test.ts` | 2.2 |
| PROG-2 | PROG-2.2 Solicitudes concurrentes exceden el máximo | `programacion.integration.test.ts` | 2.2 |
| PROG-3 | PROG-3.1 Seed repetido conserva el conjunto | `seed.integration.test.ts` | 4.1 |
| PROG-3 | PROG-3.2 Fixture inválido revierte el seed | `seed.integration.test.ts` | 4.1 |
| SLOT-1 | SLOT-1.1 Base vacía cubre 28 fechas | `horizonte.integration.test.ts` | 3.2 |
| SLOT-1 | SLOT-1.2 Fecha ancla inválida | `horizonte.domain.test.ts` | 3.1 |
| SLOT-1 | SLOT-1.3 Nueve slots completos de 25 minutos | `intervalos.domain.test.ts` y `horizonte.integration.test.ts` | 3.1, 3.2 |
| SLOT-2 | SLOT-2.1 Generaciones concurrentes convergen | `horizonte.integration.test.ts` | 3.2 |
| SLOT-2 | SLOT-2.2 Conflicto distinto no se silencia | `horizonte.integration.test.ts` | 3.2 |
| SLOT-3 | SLOT-3.1 Turno noche cruza el día UTC | `zona-horaria.integration.test.ts` | 3.1, 3.3 |
| SLOT-3 | SLOT-3.2 Fecha Lima forjada | `zona-horaria.integration.test.ts` | 1.1, 3.3 |
| SLOT-4 | SLOT-4.1 Bloqueo exitoso e idempotente | `bloqueo.integration.test.ts` | 3.4 |
| SLOT-4 | SLOT-4.2 Reservado rechaza bloqueo | `bloqueo.integration.test.ts` | 3.4 |
| SLOT-5 | SLOT-5.1 Consulta mixta por fecha Lima | `consulta-disponibilidad.integration.test.ts` | 3.5 |
| SLOT-5 | SLOT-5.2 Filtro de fecha inválido | `consulta-disponibilidad.domain.test.ts` | 3.5 |
| DP-1 | DP-1.1 Migración y seed exitosos | `pipeline-seed-gate.test.ts` y `seed.integration.test.ts` | 4.2 |
| DP-1 | DP-1.2 DIRECT_URL inválida | `pipeline-seed-gate.test.ts` + input existente `force_invalid_direct_url` | 4.2 |
| DP-1 | DP-1.3 Seed fallido tras migración | `pipeline-seed-gate.test.ts` con fixture local | 4.2 |

## Evidencia de implementación

Evidencia obtenida el 2026-07-17 en la rama `sprint-2-motor-disponibilidad`:

- Las pruebas focalizadas se ejecutaron antes de marcar cada tarea 1.1–4.2; las integraciones de restricciones, programación, generación, bloqueo, consulta y seed usaron PostgreSQL 16 real de Docker.
- La suite completa terminó con 19 archivos y 43 pruebas aprobadas. Incluye concurrencia real mediante `Promise.allSettled` para el límite semanal, dos generadores concurrentes bajo advisory lock y bloqueos concurrentes sobre un mismo slot.
- La auditoría automática de identificadores encontró los mismos 29 escenarios en delta specs y pruebas: ninguno quedó sin evidencia y ninguna prueba declaró un escenario inexistente.
- `seed.integration.test.ts` verificó una primera generación no vacía y una segunda con cero inserciones, comparando claves, conteos y estados. El entrypoint real `prisma db seed` se ejecutó además dos veces con ancla `2026-07-17` y ambas repeticiones convergieron en `0/256` slots nuevos sobre el conjunto ya sembrado.
- La cobertura V8 sobre `src/domain/**` fue 96.98% de líneas, superior al umbral obligatorio de 80%.
- `npm run build` compiló el backend con TypeScript; `scripts/verify-compose.sh` reconstruyó y levantó Postgres, API y web desde volúmenes limpios y comprobó sus rutas de salud con limpieza posterior.
- `actionlint .github/workflows/ci.yml` aprobó el workflow. `pipeline-seed-gate.test.ts` verificó el orden migrate → seed, preservó el mecanismo independiente de `DIRECT_URL` inválida y demostró el fallo de seed solo con spies/fixture local, sin llamadas a Neon, Render ni Vercel.
- `openspec validate --all --strict` aprobó las specs canónicas y este change antes del cierre de la tarea 5.1.

## Risks / Trade-offs

- [El Route Handler aborta el upstream a los 10s y Render Free puede tardar aproximadamente 60s en despertar tras inactividad] → `disponibilidad-publica` deberá diseñar la recuperación que verá el usuario; pre-generar slots mejora la latencia de base de datos, pero no elimina el cold start.
- [El advisory lock global serializa todas las generaciones] → El horizonte y volumen iniciales son pequeños; se privilegia consistencia. Puede particionarse en un cambio futuro con pruebas de rangos superpuestos.
- [Los médicos, consultorios y programaciones del seed son datos sintéticos visibles en el siguiente cambio] → Se mantienen en un único fixture versionado con claves estables; `disponibilidad-publica` deberá revisar su idoneidad de presentación antes de exponerlos.
- [La unicidad semanal no contempla versiones activas simultáneas] → Es deliberado en Sprint 2. `panel-admin` deberá revisar los constraints al introducir vigencia en Sprint 4.
- [El seed forma parte del gate de producción y un defecto suyo bloquea ambos despliegues] → Es la conducta buscada; la suite ejecuta el seed dos veces contra PostgreSQL real antes del job productivo.

## Migration Plan

1. Aplicar la migración aditiva con enums, tablas, FKs, checks y constraints.
2. Ejecutar el seed idempotente con fecha ancla controlada en local/CI.
3. En el pipeline, ejecutar migración y después seed antes de los jobs de despliegue.
4. Verificar con fixtures locales el camino de fallo del seed, sin tocar proveedores reales.

Rollback: retirar primero el código que consume las tablas; cualquier rollback de esquema o datos se ensaya solo en PostgreSQL local. No se ejecutan despliegues negativos ni borrados destructivos en producción.

## Open Questions

No queda una decisión material abierta para implementar este cambio. La vigencia de programación y la presentación final de los datos sintéticos se decidirán en los cambios propietarios (`panel-admin` y `disponibilidad-publica`) antes de habilitar esas capacidades.
