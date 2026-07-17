## 1. Persistencia y reserva pública

- [x] 1.1 Añadir `Paciente`, `Cita`, enums, relaciones, checks, unicidades e índice parcial mediante migración Prisma/SQL; crear fixtures y el límite transaccional de identidad/validación de `POST /citas`; completar y dejar pasando `patient-identity.integration.test.ts`. **Escenarios:** CITA-1.1, CITA-1.2. **Prueba primaria:** `patient-identity.integration.test.ts` parametrizada contra PostgreSQL real.
- [x] 1.2 Completar la reserva condicional de un slot `LIBRE` futuro (`inicioUtc > ahora`), advisory lock por `Idempotency-Key`, fingerprint canónico, replay exacto, fronteras pasado/ahora sin writes y reintento exclusivo de `codigoReserva`; completar y dejar pasando `booking-concurrency.integration.test.ts`. **Escenarios:** CITA-2.1, CITA-2.2. **Prueba primaria:** `booking-concurrency.integration.test.ts` con constraint real, payloads y tiempos parametrizados y concurrencia real.

## 2. Consulta, cancelación y expiración

- [x] 2.1 Implementar `POST /citas/consulta`, normalización DNI+código, DTO allow-list y error genérico sin coincidencias parciales; completar y dejar pasando `appointment-lookup.integration.test.ts`. **Escenarios:** CITA-3.1, CITA-3.2. **Prueba primaria:** `appointment-lookup.integration.test.ts` parametrizada con Supertest/PostgreSQL.
- [x] 2.2 Implementar `POST /citas/cancelacion`, locks en orden cita→slot, reintento idempotente y `venceEn = min(reservadaEn + 72 horas, slot.inicioUtc)` con el check SQL acotado; invocar expiración antes de disponibilidad/reserva/consulta/cancelación y dejar pasando `appointment-lifecycle.integration.test.ts`. **Escenarios:** CITA-4.1, CITA-4.2. **Prueba primaria:** `appointment-lifecycle.integration.test.ts` con reloj inyectado, límites parametrizados, estados y carrera cancelación/expiración.

## 3. Continuación visible de la reserva

- [x] 3.1 Crear el cliente tipado y estado de submit para `/reservar/datos`, incluyendo clave estable, validación, replay/conflictos, limpieza del slot ocupado y privacidad de URL/sesión; completar y dejar pasando `booking-submit-state.test.ts`. **Escenario:** FLOW-4.2. **Prueba primaria:** `booking-submit-state.test.ts` con respuestas equivalentes parametrizadas en Vitest AAA.
- [x] 3.2 Conectar “Continuar” desde fecha/hora y construir las pantallas Stitch 05–06 con datos reales, resumen, código copiable, vencimiento y el texto de pago acotado al inicio de la cita y a 72 horas; completar y dejar pasando el primer flujo integral `booking-completion.spec.ts`. **Escenario:** FLOW-4.1. **Prueba primaria:** `booking-completion.spec.ts` con frontend, Express y PostgreSQL reales.

## 4. Consulta/cancelación visible y calidad UI

- [x] 4.1 Activar “Ver mi cita”, conservar las demás acciones futuras deshabilitadas y construir `/mi-cita` con búsqueda, detalle, diálogo accesible y estado cancelado según Stitch 07–08; actualizar `home-patient.spec.ts`, crear `ui-home.contract.test.ts` y dejar pasando el segundo flujo integral `appointment-selfservice.spec.ts`. **Escenarios:** HOME-1.1, HOME-1.2, FLOW-7.1. **Pruebas primarias:** `home-patient.spec.ts`, `ui-home.contract.test.ts` parametrizada y `appointment-selfservice.spec.ts`.
- [x] 4.2 Ejecutar la revisión responsive/teclado/movimiento reducido y dejar pasando el único barrido axe `patient-selfservice-accessibility.spec.ts`; regenerar únicamente los cuatro baselines globales existentes —datos y detalle, móvil y escritorio— en `patient-selfservice-visual.spec.ts`. **Escenario:** FLOW-7.2. **Prueba primaria:** `patient-selfservice-accessibility.spec.ts`; los cuatro screenshots verifican únicamente fidelidad visual de FLOW-4.1/FLOW-7.1 sin repetir reglas de dominio.

## 5. Gate final y trazabilidad

- [x] 5.1 Ejecutar migración desde cero, las cuatro suites de integración de citas, `public-availability.integration.test.ts`, Vitest, exactamente los dos flujos Playwright integrales, la navegación home, el único barrido axe, los cuatro baselines, builds y cobertura mínima de 80% en lógica de dominio; comprobar la matriz requisito→escenario→prueba→tarea y `openspec validate --all --strict` antes de marcar el change listo. **Escenarios:** CITA-1.1–CITA-4.2, PUB-3.1–PUB-3.3, FLOW-4.1–FLOW-4.2, FLOW-7.1–FLOW-7.2 y HOME-1.1–HOME-1.2. **Pruebas primarias:** únicamente las nombradas en las specs, sin duplicación entre capas.
