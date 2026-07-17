## 1. Esquema y catálogos

- [x] 1.1 Implementar enums, modelos, relaciones, checks de duración `1..240`/día ISO `1..7`, constraints y migración Prisma; ejecutar las pruebas focalizadas de PostgreSQL para CAT-2.1, CAT-2.2, CAT-3.2, CAT-4.2 y SLOT-3.2 antes de marcar la tarea.
- [x] 1.2 Implementar el catálogo fijo de turnos, la validación del catálogo canónico y las duraciones enteras `1..240` con Vitest AAA; ejecutar las pruebas focalizadas para CAT-1.2, CAT-3.1, CAT-4.1 y CAT-4.2 antes de marcar la tarea.

## 2. Programación semanal

- [x] 2.1 Implementar la creación de `ProgramacionSemanal`, el rango ISO `1..7` y sus unicidades de médico/consultorio; ejecutar las pruebas focalizadas contra PostgreSQL real para PROG-1.1, PROG-1.2 y PROG-1.3 antes de marcar la tarea.
- [x] 2.2 Implementar el límite concurrente de horas semanales bloqueando `Medico` con `SELECT ... FOR UPDATE` y recalculando dentro de la misma transacción; ejecutar la prueba real con `Promise.allSettled` para PROG-2.1 y PROG-2.2 antes de marcar la tarea.

## 3. Motor de slots

- [x] 3.1 Implementar fecha civil Lima, reloj inyectable, catálogo horario y cálculo puro de intervalos completos con descarte de remanente; ejecutar con Vitest AAA el conteo e instantes exactos para SLOT-1.2, SLOT-1.3 y SLOT-3.1 antes de marcar la tarea.
- [x] 3.2 Implementar `asegurarHorizonte()` con advisory lock y `ON CONFLICT` limitado a `(programacionSemanalId, inicioUtc)`; ejecutar las pruebas focalizadas de conteo/inicio/fin contra PostgreSQL real para SLOT-1.1, SLOT-1.3, SLOT-2.1 y SLOT-2.2 antes de marcar la tarea.
- [x] 3.3 Persistir y proteger la consistencia de `fechaLima` frente a `inicioUtc`; ejecutar las pruebas focalizadas del turno noche y del check contra PostgreSQL real para SLOT-3.1 y SLOT-3.2 antes de marcar la tarea.
- [x] 3.4 Implementar el bloqueo atómico, concurrente e idempotente sin cambiar la programación; ejecutar las pruebas focalizadas contra PostgreSQL real para SLOT-4.1 y SLOT-4.2 antes de marcar la tarea.
- [x] 3.5 Implementar el servicio interno de consulta por especialidad, médico opcional y `fechaLima`; ejecutar las pruebas focalizadas Vitest/PostgreSQL para SLOT-5.1 y SLOT-5.2 antes de marcar la tarea.

## 4. Seed y gate de despliegue

- [x] 4.1 Implementar el fixture estable y `prisma db seed` idempotente reutilizando `asegurarHorizonte()` con fecha ancla inyectable; ejecutar las pruebas focalizadas contra PostgreSQL real para CAT-1.1, PROG-3.1 y PROG-3.2 antes de marcar la tarea.
- [x] 4.2 Modificar el gate del pipeline para ejecutar seed después de migración y antes de ambos despliegues; conservar la prueba existente de `DIRECT_URL` inválida y añadir solo el fixture local de seed fallido, ejecutando las pruebas focalizadas para DP-1.1, DP-1.2 y DP-1.3 antes de marcar la tarea.

## 5. Calidad y trazabilidad

- [x] 5.1 Configurar y demostrar cobertura de líneas mínima de 80% en `src/domain/**`, ejecutar build y suites completas, y auditar la matriz de los escenarios CAT-1.1–CAT-4.2, PROG-1.1–PROG-3.2, SLOT-1.1–SLOT-5.2 y DP-1.1–DP-1.3 antes de marcar la tarea.
