# local-environment Specification

## Purpose
TBD - created by syncing change `cimientos-y-despliegue`. Update Purpose after archive.

## Requirements

### Requirement: Entorno de desarrollo local reproducible vía Docker Compose
El monorepo SHALL levantar frontend, backend y una base de datos Postgres local mediante un único `docker-compose.yml`, sin depender de instalaciones locales de Node, Postgres, etc.

#### Scenario: Arranque limpio desde un checkout nuevo
- **GIVEN** un checkout limpio del repositorio con Docker instalado y sin ninguna otra dependencia local
- **WHEN** se ejecuta `docker compose up`
- **THEN** los tres servicios (web, api, db) arrancan y el backend puede conectarse a la base de datos local sin configuración manual adicional

#### Scenario: Configuración incompleta falla de forma visible
- **GIVEN** el archivo `docker-compose.yml` o sus variables de entorno están mal configurados (por ejemplo, falta `DATABASE_URL` para el servicio `api`)
- **WHEN** se ejecuta `docker compose up`
- **THEN** el servicio `api` falla al arrancar o su chequeo de salud local falla de forma visible en los logs, en vez de arrancar silenciosamente en un estado roto

### Requirement: Configuración de Prisma fija a la versión 6.x con conexión pooled/directa
El backend SHALL fijar `prisma` y `@prisma/client` en la versión 6.x en `package.json`, con el datasource configurado con `url` (pooled) y `directUrl` (directa) como variables de entorno, para que las migraciones no choquen con el pooler de Neon.

#### Scenario: Generación del cliente con el pin de versión vigente
- **GIVEN** `package.json` fija `prisma` y `@prisma/client` en la misma versión 6.x
- **WHEN** se instala el proyecto y se corre `prisma generate`
- **THEN** el cliente se genera sin errores usando `url`/`directUrl` en el datasource

#### Scenario: Intento de actualizar a Prisma 7.x rechazado antes de generar código
- **GIVEN** un manifiesto de prueba intenta usar `prisma` y `@prisma/client` en la versión 7.x sin migrar a `prisma.config.ts` ni a un driver adapter
- **WHEN** corre la prueba automatizada del pin de versión
- **THEN** la prueba falla indicando que ambas dependencias deben permanecer en 6.x, evitando que el cambio incompatible llegue a `prisma generate` o al build

### Requirement: Migración baseline creada localmente
El backend SHALL tener una migración baseline de Prisma generada localmente contra el Postgres de Docker Compose, versionada en el repositorio y lista para aplicarse en producción por el job de migración (en `pipeline-de-despliegue`).

#### Scenario: Generación de la migración baseline
- **GIVEN** el `schema.prisma` inicial (sin tablas de dominio todavía)
- **WHEN** se ejecuta `prisma migrate dev` contra el Postgres de Docker Compose
- **THEN** se genera una carpeta de migración baseline versionada en el repositorio, aplicable después con `prisma migrate deploy`

#### Scenario: Cambio de schema sin migración detectado localmente
- **GIVEN** una copia descartable de `schema.prisma` contiene una tabla adicional que no existe ni en la base local ni en las migraciones versionadas
- **WHEN** la prueba automatizada ejecuta `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --exit-code`
- **THEN** el comando termina con código `2`, evidenciando la diferencia sin modificar la base local, el schema real ni las migraciones versionadas
