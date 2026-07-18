> **Prerrequisito humano obligatorio, antes de fusionar este change:** configurar los GitHub Secrets `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` en el repositorio. Un agente no puede crearlos, confirmarlos ni imprimir sus valores — sin ellos el bootstrap de la tarea 1.1 se salta silenciosamente (BOOT-1.2) y no queda ningún administrador utilizable en el primer deploy.

## 1. Modelo y bootstrap del administrador

- [x] 1.1 Migración Prisma para `Usuario`/`Sesion`/`RolUsuario`, incluido el `CHECK` que exige `medicoId` no nulo solo cuando `rol = MEDICO` (D2); `backend/src/domain/auth.ts` con hash/verificación `scrypt`+`timingSafeEqual` y normalización de email; bootstrap idempotente del admin inicial desde `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` dentro del seed existente; el workflow de CI SHALL pasar ambas variables como `env` explícito del step `prisma db seed` (D5/Migration Plan), no solo como secrets del repositorio. **Escenarios:** BOOT-1.1, BOOT-1.2. **Prueba primaria:** `bootstrap-admin.integration.test.ts` contra PostgreSQL real (incluye el intento de insertar un MEDICO sin `medicoId` y un ADMIN con `medicoId` contra el `CHECK`), más un test de dominio unitario para `auth.ts` (Vitest AAA, hash≠contraseña, salts distintos no colisionan).

## 2. Sesión, autorización y proxy same-origin

- [x] 2.1 Implementar `POST /personal/sesion`, `DELETE /personal/sesion`, el middleware `requireSesion(roles)` y `backend/src/http/personal-routes.ts`; extender `frontend/app/api/[...path]/route.ts` para reenviar/propagar únicamente la cookie `sdv_personal_session` (nunca el header `Cookie` completo, `Authorization` ni cabeceras internas) y soportar `DELETE`, según el contrato exacto de D5 y la delta spec `MODIFIED` de `home-page` (`specs/home-page/spec.md`). **Escenarios:** AUTH-1.1, AUTH-1.2, AUTH-2.1, AUTH-2.2, y los dos escenarios de la spec `home-page` (Proxy exitoso, Backend ausente/inaccesible). **Prueba primaria:** `personal-sesion.integration.test.ts` con Supertest/PostgreSQL reales (reloj inyectado para expiración, tabla parametrizada rol→ruta) y `frontend/e2e/proxy.spec.ts` (archivo existente, ampliado con el ciclo login→request autenticado→logout; no se crea otro archivo ni otro flujo Playwright).

## 3. Agenda y pago de recepción

- [x] 3.1 Implementar `GET /personal/recepcion/agenda` con filtros combinables y `POST /personal/recepcion/citas/:id/pago` con escritura condicionada por estado dentro de transacción. **Escenarios:** RECEP-1.1, RECEP-1.2, RECEP-2.1, RECEP-2.2. **Prueba primaria:** `agenda-recepcion.integration.test.ts` con Supertest/PostgreSQL reales, incluida la carrera de doble pago con `Promise.allSettled`.

## 4. Agenda del médico

- [x] 4.1 Implementar `GET /personal/medico/agenda` filtrando por `medicoId` del usuario autenticado y confirmar que ninguna ruta de escritura es alcanzable para el rol MEDICO. **Escenarios:** MEDICO-1.1, MEDICO-1.2. **Prueba primaria:** `agenda-medico.integration.test.ts` con Supertest/PostgreSQL reales.

## 5. Frontend — acceso del personal

- [x] 5.1 Construir `/personal/login` sobre Stitch `01-login` (sin "olvidó su clave" ni "mantener sesión"), con envío de credenciales, cookie de sesión y comportamiento tras `AUTH-1.1` definido por rol: RECEPCIONISTA redirige a `/personal/recepcion/agenda`, MEDICO redirige a `/personal/medico/agenda`, y ADMIN permanece en la misma pantalla de login con un aviso accesible "El panel administrativo se habilitará en la siguiente etapa" y una acción para cerrar sesión — sin crear el dashboard de 4B ni ninguna pantalla o baseline visual adicional; error genérico de `AUTH-1.2` para credenciales inválidas.

## 6. Frontend — recepción

- [x] 6.1 Construir `/personal/recepcion/agenda` (Stitch `02`) con filtros reales y `/personal/recepcion/citas/[id]` (Stitch `03`) con "Marcar como pagada", constancia HTML imprimible con `window.print()` (Stitch `04`) y enlace `wa.me` real, sin datos ilustrativos (recaudación, "nueva cita", historial). **Escenario:** AUTH-1.1, RECEP-1.1, RECEP-2.1. **Prueba primaria:** primer flujo integral `personal-recepcion.spec.ts` con frontend, Express y PostgreSQL reales.

## 7. Frontend — médico

- [x] 7.1 Construir `/personal/medico/agenda` (Stitch `05`) exclusivamente de lectura, sin "ver historial" ni ningún control de escritura. **Escenarios:** MEDICO-1.1, MEDICO-1.2. **Prueba primaria:** segundo flujo integral `personal-medico.spec.ts` con frontend, Express y PostgreSQL reales.

## 8. Calidad UI y accesibilidad

- [x] 8.1 Ejecutar el único barrido axe sobre login (vacío/inválido), agenda de recepción (con datos y vacía), detalle/pago/constancia y agenda del médico; regenerar exactamente los cuatro baselines visuales (login, agenda de recepción, detalle de cita, agenda del médico) en escritorio. **Escenarios:** AUTH-1.2, AUTH-2.1, RECEP-1.2 (verificados en su faceta de accesibilidad/UI, sin repetir la regla de negocio ya cubierta en integración). **Prueba primaria:** `personal-accessibility.spec.ts` (único barrido axe) y `personal-visual.spec.ts` (cuatro baselines).

## 9. Gate final y trazabilidad

- [x] 9.1 Ejecutar migración desde cero, las cuatro suites de integración nuevas, el test de dominio de `auth.ts`, los dos flujos Playwright integrales, el único barrido axe, los cuatro baselines, builds de ambos paquetes y cobertura mínima de 80% en lógica de dominio; comprobar la matriz requisito→escenario→prueba→tarea y `openspec validate --all --strict` antes de marcar el change listo. **Escenarios:** AUTH-1.1–AUTH-2.2, BOOT-1.1–BOOT-1.2, RECEP-1.1–RECEP-2.2, MEDICO-1.1–MEDICO-1.2. **Pruebas primarias:** únicamente las nombradas en las specs, sin duplicación entre capas.
