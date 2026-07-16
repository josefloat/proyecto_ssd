## 1. Monorepo y Docker Compose

- [x] 1.1 Crear estructura de monorepo (`frontend/`, `backend/`) y `docker-compose.yml` (web, api, db) para desarrollo local; `scripts/verify-compose.sh` verifica el escenario "Arranque limpio desde un checkout nuevo" de `specs/local-environment/spec.md`
- [x] 1.2 Usar el fixture `scripts/compose-api-missing-db-url.yml` dentro de `scripts/verify-compose.sh` para confirmar que una configuración incompleta falla de forma visible en los logs; verifica el escenario "Configuración incompleta falla de forma visible" de `specs/local-environment/spec.md`

## 2. Backend: Prisma, migración baseline y health checks

- [x] 2.1 Fijar `prisma` y `@prisma/client` en 6.x en `package.json`, configurar el datasource con `url`/`directUrl`, y correr `prisma generate`; verifica el escenario "Generación del cliente con el pin de versión vigente" de `specs/local-environment/spec.md`
- [x] 2.2 Ejecutar `tests/prisma-version.test.ts`, que verifica el pin real 6.x y rechaza un manifiesto fixture con Prisma 7.x sin adaptación; verifica el escenario "Intento de actualizar a Prisma 7.x rechazado antes de generar código" de `specs/local-environment/spec.md`
- [x] 2.3 Generar la migración baseline con `prisma migrate dev` contra el Postgres de Docker Compose; verifica el escenario "Generación de la migración baseline" de `specs/local-environment/spec.md`
- [x] 2.4 Ejecutar `tests/migration-drift.test.ts`, que compara una copia descartable de schema con la base local usando `prisma migrate diff --exit-code`; verifica el escenario "Cambio de schema sin migración detectado localmente" de `specs/local-environment/spec.md`
- [x] 2.5 Implementar `GET /live` sin ninguna dependencia de la base de datos; verifica los escenarios "Proceso vivo responde sin tocar la base de datos" y "Base de datos inalcanzable no afecta la respuesta de /live" de `specs/health-check/spec.md`
- [x] 2.6 Implementar `GET /health` (`SELECT 1` vía Prisma, URL pooled) con su prueba de integración Supertest contra Postgres real de Docker Compose; verifica los escenarios "Backend y base de datos alcanzables" y "Base de datos inalcanzable" de `specs/health-check/spec.md`

## 3. Frontend: home placeholder y proxy

- [x] 3.1 Inicializar Next.js + TypeScript + Tailwind con home placeholder (`h1` + landmark semántico) y prueba Playwright + axe-core contra el build local; verifica los escenarios "Carga de la home" y "Regresión de accesibilidad detectada antes de integrar" de `specs/home-page/spec.md`
- [x] 3.2 Configurar el proxy (Route Handler catch-all) hacia el backend local vía variable de entorno server-side, con prueba de proxy exitoso; verifica el escenario "Proxy exitoso hacia el backend" de `specs/home-page/spec.md`
- [x] 3.3 Apuntar el proxy a un backend inexistente y confirmar la respuesta de error controlada (502/504) sin filtrar la URL interna; verifica el escenario "Backend de destino no configurado o inexistente" de `specs/home-page/spec.md`
