## Why

Antes de escribir cualquier regla de negocio, el proyecto necesita un monorepo funcional que corra de punta a punta en local, con un contrato claro entre frontend y backend, antes de que ese contrato tenga que sobrevivir a un proveedor de hosting real. Este cambio cimenta esa base: estructura del monorepo, entorno reproducible vía Docker Compose, backend con Prisma configurado y sus endpoints de salud, y un frontend con home placeholder y proxy hacia el backend — todo verificable en la máquina del desarrollador, sin tocar producción.

El despliegue real a Vercel/Render/Neon, la migración contra la base de datos de producción, y la verificación post-deploy quedan en un cambio separado (`pipeline-de-despliegue`), porque combinar ambos alcances en una sola propuesta excedía el límite de tareas y mezclaba dos preocupaciones distintas: que el código funcione, y que el código esté desplegado y verificado en vivo.

## What Changes

- Crear el monorepo con `frontend/` (Next.js App Router + TypeScript + Tailwind) y `backend/` (Express + TypeScript + Prisma), con `docker-compose.yml` para desarrollo local (web, api, db).
- Fijar Prisma y `@prisma/client` en la versión 6.x, con el datasource configurado con `url` (pooled) y `directUrl` (directa) como variables de entorno, y generar la migración baseline localmente contra el Postgres de Docker Compose.
- Exponer `GET /live` (liveness, sin tocar la base de datos) y `GET /health` (readiness, verifica conectividad real a Postgres vía Prisma) en el backend, cada uno con su propósito y prueba de integración (Supertest) diferenciados.
- Crear una home placeholder en el frontend que renderiza sin errores y pasa un escaneo automatizado de accesibilidad (axe-core). No replica aún el flujo de reserva del diseño base `design/base-ui-ux-reservas.png`; ese flujo corresponde a un cambio posterior.
- Configurar un proxy same-origin en el frontend (Route Handler catch-all) para que el navegador solo hable con el origen del frontend; Next.js reenvía server-side al backend.
- **BREAKING**: N/A — no existe código previo que romper.

## Capabilities

### New Capabilities

- `local-environment`: monorepo reproducible vía Docker Compose, configuración de Prisma fijada a 6.x con conexión pooled/directa, y migración baseline generada localmente.
- `health-check`: endpoints `/live` (liveness) y `/health` (readiness con verificación real de base de datos), cada uno verificable localmente.
- `home-page`: página de inicio placeholder del frontend, accesible, y proxy same-origin hacia el backend.

### Modified Capabilities

_(Ninguna — no existen specs previas; este es el primer cambio del proyecto.)_

## Impact

- **Código nuevo**: `frontend/` (Next.js), `backend/` (Express + Prisma), `docker-compose.yml`.
- **Esquema de datos**: migración baseline de Prisma generada localmente (sin tablas de dominio todavía), lista para aplicarse en producción por `pipeline-de-despliegue`.
- **Fuera de alcance en este cambio** (vive en `pipeline-de-despliegue`): CI en GitHub Actions, migración contra la base de datos real de Neon, despliegue a Vercel/Render, smoke tests, escaneo de accesibilidad contra una URL viva, y las cuentas/secretos de los proveedores administrados.
- **Fuera de alcance del proyecto en general**: modelo de agendamiento (Turno, ProgramacionSemanal, Slot, Bloqueo, Cita), autenticación y roles, cualquier pantalla real de `/design`, recordatorios WhatsApp, dominio propio/DNS personalizado, y cobertura de dominio del 80% (no aplica: no hay lógica de dominio todavía).
