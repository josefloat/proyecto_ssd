Ninguna tarea se marcará hasta que sus pruebas focalizadas pasen. Las tareas se ejecutan en orden; la suite completa y la cobertura cierran el change.

## 1. Motor de slots

- [x] 1.1 Reconciliar el horizonte bajo el advisory lock leyendo claves existentes, omitiendo el INSERT en caliente e insertando solo faltantes con la única protección `ON CONFLICT(programacionSemanalId, inicioUtc)`; instrumentar queries sobre PostgreSQL real y ejecutar `horizonte-reconciliacion.integration.test.ts`. Verifica `SLOT-6.1`, `SLOT-6.2`, `SLOT-6.3` y `SLOT-6.4`.

## 2. API pública

- [x] 2.1 Implementar validación UUID/query, errores tipados y middleware de respuesta segura con dependencias inyectables; ejecutar tests focalizados de validación y fallos Supertest sin servicios externos. Verifica `PUB-1.3`, `PUB-2.3`, `PUB-3.3`, `PUB-4.2` y `PUB-4.3`.
- [x] 2.2 Implementar `GET /especialidades` con DTO por allow-list y orden de `ESPECIALIDADES_CANONICAS`; ejecutar `public-specialties.integration.test.ts` contra PostgreSQL real. Verifica `PUB-1.1` y `PUB-1.2`.
- [x] 2.3 Implementar `GET /especialidades/:especialidadId/medicos` con especialidad mínima, filtro y orden estable; ejecutar `public-doctors.integration.test.ts` contra PostgreSQL real. Verifica `PUB-2.1` y `PUB-2.2`.
- [x] 2.4 Implementar el servicio/ruta `GET /disponibilidad`: reloj Lima inyectable, `asegurarHorizonte()`, lectura única de 28 fechas, médico opcional, solo libres, DTO mínimo y `Cache-Control: no-store`; ejecutar `public-availability.integration.test.ts` y la validación AAA focalizada. Verifica `PUB-3.1`, `PUB-3.2` y `PUB-4.1`.

## 3. Experiencia del paciente

- [x] 3.1 Añadir Lucide, Framer Motion y soporte de tests de contrato; empaquetar Atkinson Hyperlegible local y, usando `imagegen` durante apply, crear la ilustración original local; implementar la home real, aviso académico y acciones futuras deshabilitadas. Ejecutar `home-patient.spec.ts`, `ui-assets.contract.test.ts`, `ui-copy.contract.test.ts` y screenshot focalizado. Verifica `HOME-1.1`, `HOME-1.2` y `HOME-1.3`.
- [x] 3.2 Implementar el shell transaccional fiel a Stitch y las funciones puras de URL con replace/push, limpieza jerárquica, redirección y revalidación; ejecutar `booking-url-state.spec.ts`. Verifica `FLOW-1.2` y `FLOW-1.3`.
- [x] 3.3 Implementar el coordinador cancelable y la máquina loading/preparing/ready/empty/offline/invalid/error con siete intentos, deadline nominal de 88 s y reintento manual; ejecutar `booking-network-states.spec.ts` con reloj/fixtures deterministas. Verifica `FLOW-3.1`, `FLOW-3.2`, `FLOW-3.3` y `FLOW-3.4`.
- [x] 3.4 Implementar `/reservar/especialidad` desde el API, con selección, loading/empty y mapeo canónico con fallback; ejecutar `specialty-presentation.domain.test.ts` y casos focalizados de `booking-network-states.spec.ts`. Verifica `FLOW-2.1`, `FLOW-2.2` y `FLOW-2.3` para especialidades.
- [x] 3.5 Implementar `/reservar/medico` desde el API con resumen de especialidad, avatares de iniciales, selección y estados sin fotografías/ratings; ejecutar casos focalizados reales y vacíos. Verifica `FLOW-2.1` y `FLOW-2.2` para médicos.
- [x] 3.6 Implementar `/reservar/fecha-hora` con las 28 fechas, agrupación por turno, resumen, slot en URL, revalidación y “Continuar” disabled sin escrituras; ejecutar casos focalizados reales y de slot retirado. Verifica `FLOW-2.1`, `FLOW-2.2`, `FLOW-4.1` y `FLOW-4.2`.

## 4. Pruebas E2E, accesibilidad y visuales

- [x] 4.1 Configurar Playwright con Express/PostgreSQL/seed/reloj reales para el flujo feliz, avanzar, volver, recargar y comprobar ausencia de métodos de escritura; ejecutar `booking-flow.real-backend.spec.ts`. Verifica `FLOW-1.1`, consolida `FLOW-2.1` y vuelve a comprobar `FLOW-4.1`.
- [x] 4.2 Automatizar axe-core, teclado, foco visible, texto ≥18 px y targets ≥48×48 en las cuatro pantallas y estados, incluido fixture negativo local; ejecutar `booking-accessibility.spec.ts` y `booking-accessibility-fixture.spec.ts`. Verifica `FLOW-5.1` y `FLOW-5.2`.
- [x] 4.3 Congelar Chromium, viewports, locale, zona, reloj, fuente, color scheme y reduced-motion; versionar screenshots móvil/escritorio de cuatro pantallas, preparación y selección, y probar movimiento normal/reducido y fixtures de deriva. Ejecutar `booking-visual.spec.ts`, `booking-motion.spec.ts` y `booking-visual-fixture.spec.ts`. Verifica `FLOW-6.1`, `FLOW-6.2` y `FLOW-6.3`.

## 5. Calidad y trazabilidad final

- [x] 5.1 Ejecutar todas las pruebas backend/frontend, concurrencia real, E2E real y con fixtures, builds, Docker Compose limpio, axe, screenshots y `vitest --coverage`; exigir ≥80% de líneas en `src/domain/**`, auditar cada fila de la matriz, ejecutar `openspec validate --all --strict` y marcar tareas solo con toda la evidencia verde. Verifica el cierre de `PUB-1..4`, `SLOT-6`, `HOME-1` y `FLOW-1..6`.

## 6. Matriz requisito → escenario → prueba → tarea

| Requisito | Escenario | Prueba automatizada propuesta | Tarea |
| --- | --- | --- | --- |
| PUB-1 | PUB-1.1 | `public-specialties.integration.test.ts` — orden, DTO mínimo, PostgreSQL real | 2.2 |
| PUB-1 | PUB-1.2 | `public-specialties.integration.test.ts` — catálogo vacío exacto | 2.2 |
| PUB-1 | PUB-1.3 | `public-api-errors.integration.test.ts` — servicio fallido, 503 seguro | 2.1 |
| PUB-2 | PUB-2.1 | `public-doctors.integration.test.ts` — filtro/orden/allow-list real | 2.3 |
| PUB-2 | PUB-2.2 | `public-doctors.integration.test.ts` — especialidad sin médicos | 2.3 |
| PUB-2 | PUB-2.3 | `public-doctors.integration.test.ts` — 400 vs 404 | 2.1 |
| PUB-3 | PUB-3.1 | `public-availability.integration.test.ts` — 28 fechas, libres, privacidad, no-store | 2.4 |
| PUB-3 | PUB-3.2 | `public-availability.integration.test.ts` — horizonte completo e items vacío | 2.4 |
| PUB-3 | PUB-3.3 | `public-availability-validation.domain.test.ts` + integración — query inválida sin I/O | 2.1 |
| PUB-4 | PUB-4.1 | `public-availability.integration.test.ts` — filtro de médico válido | 2.4 |
| PUB-4 | PUB-4.2 | `public-availability.integration.test.ts` — 404 y 422 | 2.1 |
| PUB-4 | PUB-4.3 | `public-api-errors.integration.test.ts` — fallos internos, 503 sin filtraciones | 2.1 |
| SLOT-6 | SLOT-6.1 | `horizonte-reconciliacion.integration.test.ts` — cero INSERT instrumentados | 1.1 |
| SLOT-6 | SLOT-6.2 | `horizonte-reconciliacion.integration.test.ts` — tres faltantes/tres escrituras | 1.1 |
| SLOT-6 | SLOT-6.3 | `horizonte-reconciliacion.integration.test.ts` — reservado/bloqueado inmutables | 1.1 |
| SLOT-6 | SLOT-6.4 | `horizonte-reconciliacion.integration.test.ts` — generadores concurrentes | 1.1 |
| HOME-1 | HOME-1.1 | `home-patient.spec.ts` + `home-visual.spec.ts` — home real y navegación | 3.1 |
| HOME-1 | HOME-1.2 | `home-patient.spec.ts` — futuras disabled, sin ruta/request | 3.1 |
| HOME-1 | HOME-1.3 | `ui-assets.contract.test.ts` + `ui-copy.contract.test.ts` — asset/copy prohibidos | 3.1 |
| FLOW-1 | FLOW-1.1 | `booking-flow.real-backend.spec.ts` — URL, recarga y atrás reales | 4.1 |
| FLOW-1 | FLOW-1.2 | `booking-url-state.spec.ts` + `doctor-screen.spec.ts` — limpieza, replace e historial | 3.2 |
| FLOW-1 | FLOW-1.3 | `booking-url-state.spec.ts` + `doctor-screen.spec.ts` — URL incompleta/inválida | 3.2 |
| FLOW-2 | FLOW-2.1 | `booking-flow.real-backend.spec.ts` + `ui-copy.contract.test.ts` — datos reales sin atributos inventados | 4.1 |
| FLOW-2 | FLOW-2.2 | `booking-network-states.spec.ts` — vacíos sin fallback sintético | 3.4–3.6 |
| FLOW-2 | FLOW-2.3 | `specialty-presentation.domain.test.ts` + E2E — fallback neutral | 3.4 |
| FLOW-3 | FLOW-3.1 | `booking-network-states.spec.ts` — errores transitorios y recuperación | 3.3 |
| FLOW-3 | FLOW-3.2 | `booking-network-states.spec.ts` — siete intentos, deadline y retry manual | 3.3 |
| FLOW-3 | FLOW-3.3 | `booking-network-states.spec.ts` — offline/online | 3.3 |
| FLOW-3 | FLOW-3.4 | `booking-network-states.spec.ts` — abort y respuesta tardía | 3.3 |
| FLOW-4 | FLOW-4.1 | `booking-flow.real-backend.spec.ts` — slot, disabled y cero escrituras | 3.6/4.1 |
| FLOW-4 | FLOW-4.2 | `availability-screen.spec.ts` — slot retirado, foco, cero escrituras y URL corregida | 3.6 |
| FLOW-5 | FLOW-5.1 | `booking-accessibility.spec.ts` — axe, teclado, foco y geometría | 4.2 |
| FLOW-5 | FLOW-5.2 | `booking-accessibility-fixture.spec.ts` — regresión deliberada detectada | 4.2 |
| FLOW-6 | FLOW-6.1 | `booking-visual.spec.ts` — baselines móvil/escritorio | 4.3 |
| FLOW-6 | FLOW-6.2 | `booking-motion.spec.ts` — reduce vs no-preference | 4.3 |
| FLOW-6 | FLOW-6.3 | `booking-visual-fixture.spec.ts` + contrato de assets — deriva detectada | 4.3 |
