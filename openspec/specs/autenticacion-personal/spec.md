# autenticacion-personal Specification

## Purpose
Definir autenticación, autorización por rol y bootstrap seguro del personal autorizado de Señal de Vida.

## Requirements

### Requirement: AUTH-1 Login con contraseña para personal autorizado
`POST /personal/sesion` SHALL aceptar email y contraseña, SHALL normalizar el email (trim + minúsculas) antes de buscarlo, SHALL verificar la contraseña con `crypto.scrypt` más `timingSafeEqual` contra el `passwordHash` almacenado, y SHALL crear una sesión opaca entregada en cookie `HttpOnly; Secure; SameSite=Strict` únicamente cuando el usuario existe, está `activo` y la contraseña coincide; SHALL responder el mismo error genérico para email inexistente, contraseña incorrecta o usuario inactivo, sin distinguir cuál falló.

#### Scenario: AUTH-1.1 Credenciales correctas crean una sesión válida
- **GIVEN** un `Usuario` activo con email normalizado y `passwordHash` conocido para cada rol (ADMIN, RECEPCIONISTA, MEDICO)
- **WHEN** se envía `POST /personal/sesion` con ese email (en cualquier capitalización) y su contraseña correcta
- **THEN** recibe `200`, una cookie de sesión `HttpOnly`/`Secure`/`SameSite=Strict`, el rol del usuario en el cuerpo, y la sesión persiste con `expiraEn` a 8 horas
- **PRUEBA AUTOMATIZADA** `personal-sesion.integration.test.ts` usa Supertest/PostgreSQL reales y parametriza los tres roles

#### Scenario: AUTH-1.2 Email inexistente, contraseña incorrecta o usuario inactivo no crean sesión
- **GIVEN** un email inexistente, un `Usuario` existente con contraseña incorrecta, y un `Usuario` con `activo: false` y contraseña correcta
- **WHEN** cada caso envía `POST /personal/sesion`
- **THEN** los tres reciben el mismo `401` con mensaje genérico, ninguno crea fila en `Sesion` y ninguna respuesta distingue cuál de los tres ocurrió
- **PRUEBA AUTOMATIZADA** `personal-sesion.integration.test.ts` recorre los tres casos con Supertest/PostgreSQL reales y compara status, cuerpo y ausencia de escritura

### Requirement: AUTH-2 Autorización estricta por rol y sesión revocada
Toda ruta bajo `/personal/**` SHALL exigir una sesión vigente (no expirada, no revocada) de un `Usuario` `activo` cuyo `rol` esté en la allow-list de esa ruta; `DELETE /personal/sesion` SHALL revocar la sesión activa de forma inmediata; una sesión revocada o expirada SHALL dejar de autenticar en la siguiente solicitud sin excepción.

#### Scenario: AUTH-2.1 Rol no autorizado recibe 403 sin ejecutar la acción
- **GIVEN** una sesión válida de RECEPCIONISTA y, por separado, una sesión válida de MEDICO, y una cita `RESERVADA` real del día
- **WHEN** la sesión de RECEPCIONISTA intenta `GET /personal/medico/agenda` y la sesión de MEDICO intenta `POST /personal/recepcion/citas/:id/pago` sobre esa cita
- **THEN** ambas reciben `403`, ninguna de las dos rutas ejecuta su acción y la cita permanece `RESERVADA` sin ninguna fila nueva en `Sesion` ni cambio de estado
- **PRUEBA AUTOMATIZADA** `personal-sesion.integration.test.ts` parametriza estas dos combinaciones rol-vs-ruta (ambas ya reales en este change) con Supertest/PostgreSQL reales y compara status y ausencia de escritura

#### Scenario: AUTH-2.2 Logout o expiración invalidan la sesión de inmediato
- **GIVEN** una sesión válida que hace logout (`DELETE /personal/sesion`), y por separado una sesión cuyo `expiraEn` ya pasó
- **WHEN** cada una reintenta cualquier ruta privada con la misma cookie
- **THEN** ambas reciben `401` en el siguiente request, sin importar que la cookie del navegador siga presente
- **PRUEBA AUTOMATIZADA** `personal-sesion.integration.test.ts` revoca y congela el reloj con Supertest/PostgreSQL reales para ambos casos

### Requirement: BOOT-1 Bootstrap idempotente del administrador inicial
El seed SHALL crear como máximo un `Usuario` ADMIN a partir de `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` cuando ambas variables estén presentes, SHALL omitir el bootstrap con una advertencia visible (sin fallar el resto del seed) cuando falten, y SHALL ser idempotente: ejecuciones repetidas con el mismo email SHALL no duplicar el usuario ni sobrescribir su `passwordHash` existente.

#### Scenario: BOOT-1.1 Primera ejecución con variables presentes crea el admin
- **GIVEN** una base migrada sin usuarios y `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` configuradas
- **WHEN** corre el seed
- **THEN** existe exactamente un `Usuario` con `rol: ADMIN`, email normalizado desde `SEED_ADMIN_EMAIL` y `passwordHash` derivado de `SEED_ADMIN_PASSWORD` mediante `scrypt`
- **PRUEBA AUTOMATIZADA** `bootstrap-admin.integration.test.ts` ejecuta el seed contra PostgreSQL real y verifica la fila creada

#### Scenario: BOOT-1.2 Repetición no duplica y variables ausentes no rompen el seed
- **GIVEN** un admin ya sembrado con esas variables, y por separado una base sin usuarios y sin `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`
- **WHEN** el seed se ejecuta de nuevo en el primer caso y una sola vez en el segundo
- **THEN** el primer caso conserva exactamente un `Usuario` con el mismo `passwordHash` que antes, y el segundo caso completa el resto del seed (catálogos/programación) sin crear ningún `Usuario` ni fallar
- **PRUEBA AUTOMATIZADA** `bootstrap-admin.integration.test.ts` ejecuta ambos escenarios contra PostgreSQL real y compara conteos y `passwordHash`

### Requirement: AUTH-3 Credencial temporal de un solo uso y cambio obligatorio
La creación o reinicio administrativo SHALL generar la contraseña temporal en el servidor con entropía criptográfica, persistir únicamente su hash y devolver el valor en una sola respuesta que SHALL no registrarse. El usuario con `debeCambiarPassword = true` SHALL poder autenticar solo una sesión limitada a cambiar su propia contraseña; toda otra ruta privada SHALL responder `403`. Un cambio válido SHALL almacenar un hash nuevo, limpiar la marca, revocar todas sus sesiones —incluida la limitada— y exigir un login nuevo. El bootstrap SHALL marcar al admin inicial para cambio obligatorio sin sobrescribir su hash en despliegues posteriores.

#### Scenario: AUTH-3.1 Usuario cambia la temporal y vuelve a entrar con la nueva
- **GIVEN** el admin inicial o una cuenta creada/reiniciada con contraseña temporal entregada una sola vez
- **WHEN** inicia sesión, cambia la contraseña por una nueva válida y vuelve a iniciar sesión
- **THEN** antes del cambio solo accede a la operación de cambio, después todas las sesiones previas están revocadas, la temporal ya no autentica y la nueva contraseña da acceso al destino de su rol
- **PRUEBA AUTOMATIZADA** `personal-sesion.integration.test.ts` amplía la suite existente con el ciclo parametrizado por rol, sin duplicar login, expiración ni autorización ya cubiertos en AUTH-1/AUTH-2

#### Scenario: AUTH-3.2 Reutilización, contraseña inválida o reinicio revocan acceso inseguro
- **GIVEN** una sesión normal existente, una credencial temporal ya consumida y variantes de contraseña nueva inválida
- **WHEN** el ADMIN reinicia la credencial o el usuario intenta reutilizar la temporal/cambiar a una variante inválida
- **THEN** el reinicio revoca de inmediato la sesión normal y entrega una nueva temporal una sola vez; los otros intentos son rechazados sin exponer hashes, sin registrar contraseñas y sin dejar sesiones adicionales
- **PRUEBA AUTOMATIZADA** `personal-sesion.integration.test.ts` parametriza los errores nuevos y verifica hashes, conteos/revocación de sesiones y respuestas sanitizadas
