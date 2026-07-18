## Why

Hasta Sprint 3, Señal de Vida solo atiende al paciente público (sin contraseña). No existe ningún mecanismo para que recepción registre pagos, para que el médico consulte su propia agenda, ni para que un administrador gestione médicos, recepcionistas o la programación semanal. Sin esto, el sistema no puede operar en un escenario real: nadie con contraseña puede iniciar sesión, y el flujo de pago/atención de una cita reservada no tiene ninguna interfaz. Este change (4A) cierra la mitad operativa mínima: login con contraseña, autorización por rol, y las dos superficies internas que dependen directamente de la cita ya reservada (recepción y médico). La administración de usuarios y programación semanal queda en un change posterior (4B) porque depende de la autenticación aquí construida y tiene su propio presupuesto de requisitos.

## What Changes

- Nuevo modelo `Usuario` (email institucional único, `passwordHash`, `rol` ADMIN|RECEPCIONISTA|MEDICO, `activo`, `medicoId` opcional y único para rol MEDICO) y modelo `Sesion` (token opaco, solo se persiste su hash SHA-256, expiración a las 8 horas).
- `POST /personal/sesion` (login): valida email + contraseña con `crypto.scrypt`/`timingSafeEqual`, crea una sesión opaca y la entrega en cookie `HttpOnly; Secure; SameSite=Strict`.
- `DELETE /personal/sesion` (logout): revoca la sesión activa.
- Middleware de autorización: toda ruta privada exige sesión vigente, usuario `activo` y rol permitido; una sesión revocada o expirada deja de autenticar de inmediato.
- Bootstrap idempotente del primer `Usuario` ADMIN desde `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` (variables de entorno, nunca credenciales en el repositorio); ejecuciones repetidas no duplican ni sobrescriben.
- `GET /personal/recepcion/agenda`: agenda del día para recepción, filtrable por especialidad, médico y estado de cita.
- `POST /personal/recepcion/citas/:id/pago`: transición `RESERVADA → PAGADA` exclusivamente; rechaza cualquier otro estado de origen y resuelve sin duplicar bajo intentos concurrentes sobre la misma cita.
- Vista de constancia HTML imprimible (`window.print()`) y enlace `wa.me` generado en el cliente a partir de datos reales de la cita ya `PAGADA`; ninguno de los dos es una escritura nueva.
- `GET /personal/medico/agenda`: agenda del día del médico autenticado, exclusivamente de lectura — sin ninguna ruta de escritura alcanzable para el rol MEDICO.
- Frontend: `/personal/login`, `/personal/recepcion/agenda`, `/personal/recepcion/citas/[id]`, `/personal/medico/agenda`, implementadas sobre las pantallas Stitch `01`–`05` de `design/stitch/personal/`.
- **BREAKING**: ninguno. Todo lo anterior es aditivo; no modifica ningún endpoint ni comportamiento público del paciente.

**Fuera de alcance (este change):** estados `ATENDIDA`/`NO_ASISTIO`; recuperación de contraseña; refresh tokens o "mantener sesión iniciada"; pagos en línea; historia clínica o cualquier escritura médica; creación manual de citas por recepción; reportes, métricas o recaudación; gestión de médicos/recepcionistas y programación semanal (change 4B).

## Capabilities

### New Capabilities
- `autenticacion-personal`: login con contraseña, sesiones opacas, autorización por rol y bootstrap idempotente del primer administrador.
- `agenda-recepcion`: agenda diaria filtrable, registro de pago (`RESERVADA → PAGADA`), constancia imprimible y enlace `wa.me`.
- `agenda-medico`: agenda diaria del médico autenticado, exclusivamente de lectura.

### Modified Capabilities
- `home-page`: el requisito `Proxy same-origin del frontend hacia el backend` amplía su contrato para transportar la sesión del personal — reenvía y propaga exclusivamente la cookie `sdv_personal_session` (creación en login, reenvío en requests autenticados, eliminación en logout) y soporta `DELETE`; el resto del proxy (reenvío 1:1, errores `502`/`504` controlados) no cambia.

## Impact

- **Backend**: nueva migración Prisma (`Usuario`, `Sesion`, enum `RolUsuario`); `backend/src/domain/auth.ts` (hash/verificación de contraseña, validación de sesión); `backend/src/services/auth.ts`; `backend/src/services/agenda-personal.ts`; `backend/src/http/personal-routes.ts` con su propio middleware de autorización; extensión de `backend/prisma/seed.ts` o script de bootstrap dedicado para el admin inicial; nuevas variables de entorno `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (documentadas como intervención humana obligatoria, nunca committeadas).
- **Frontend**: nuevas rutas bajo `/personal/**`; cliente de sesión (cookie httpOnly, sin `localStorage`); componentes basados en `design/stitch/personal/01-login` a `05-medico-agenda`.
- **Sin impacto** en `citas-paciente-api`, `disponibilidad-publica-api` ni `flujo-disponibilidad-paciente`: el paciente sigue sin contraseña y sus endpoints no cambian. `home-page` sí cambia, pero únicamente en el transporte de cookies del proxy (ver Modified Capabilities); el requisito `HOME-1` de esa misma spec no se toca.
- **Dependencia para 4B**: la administración de usuarios y programación semanal (change `administracion-programacion`) reutiliza el modelo `Usuario`, el middleware de autorización y las sesiones definidos aquí.
