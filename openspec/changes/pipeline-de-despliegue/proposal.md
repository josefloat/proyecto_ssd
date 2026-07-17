## Why

`cimientos-y-despliegue` deja el monorepo funcional y verificado en local: Docker Compose, Prisma con migración baseline, y los endpoints `/live`/`/health`. Pero un proyecto que debe quedar DESPLEGADO no lo está hasta que ese código corre en producción real y alguien (o algo) lo verifica contra las URLs en vivo, no contra `localhost`. Este cambio construye esa ruta: CI que bloquea código roto, una migración que corre donde Render Free lo permite, despliegues anclados al commit exacto, un rollout que verifica antes de exponer al público, y smoke tests que cubren tanto el backend directo como el recorrido completo a través del Route Handler del frontend.

Se separa de `cimientos-y-despliegue` porque combinar ambos alcances en una sola propuesta excedía las 15 tareas permitidas por cambio, y porque son dos preocupaciones distintas: que el código funcione (el otro cambio) y que el código esté desplegado y verificado en vivo (este).

## What Changes

- Workflow de GitHub Actions con un gate de build + pruebas de integración (Postgres real de servicio en CI) que bloquea cualquier despliegue si falla.
- Job de migración (`prisma migrate deploy` con `DIRECT_URL`) ejecutado en GitHub Actions después del gate anterior, ya que Render Free no admite pre-deploy command ni jobs one-off.
- Despliegue anclado al commit exacto (`github.sha`) a Render (vía API) y Vercel (vía CLI), con los auto-deploys nativos de ambos proveedores desactivados para evitar que desplieguen un commit distinto al verificado por el pipeline.
- Rollout preview-first en Vercel: se despliega primero a un preview protegido por Vercel Authentication, el pipeline accede mediante un bypass exclusivo para automatización, se corre el smoke test y un escaneo axe-core contra esa URL, y solo se promueve a producción si ambos pasan. Promover dispara un rebuild completo (mismo source commit, variables de Production) — comportamiento documentado de Vercel, no un artefacto idéntico — por lo que el pipeline verifica el deployment de producción real resultante (vía `targets.production` de la API de Vercel: `READY`, dominio real, commit de origen igual a `github.sha`) en vez de re-consultar la URL de preview, y solo entonces hace el smoke HTTP post-promoción.
- Smoke test de runtime contra `/health` (backend directo) y un smoke test separado del recorrido completo a través del Route Handler del frontend (`<frontend-url>/api/health`), dado el riesgo de que los cold starts de Render y Neon provoquen uno o más `504` controlados antes de que un reintento responda correctamente.
- Provisión manual (humana) de cuentas y credenciales en Neon, Render y Vercel — incluido el secreto de Protection Bypass for Automation de Vercel — y su almacenamiento como GitHub Secrets, declarada explícitamente como bloqueante del resto del pipeline.
- **BREAKING**: N/A — no existe despliegue previo que romper.

## Capabilities

### New Capabilities

- `deployment-pipeline`: pipeline de CI/CD que construye, prueba con Postgres real, migra, despliega de forma anclada al commit y con rollout preview-first, y verifica automáticamente contra las URLs reales de producción — incluido el recorrido completo a través del Route Handler `/api/[...path]`.

### Modified Capabilities

_(Ninguna. `health-check` y `home-page` — definidos en `cimientos-y-despliegue` — se consumen aquí para verificación, pero sus requisitos no cambian.)_

## Impact

- **Infraestructura externa**: cuentas y proyectos en Vercel, Render y Neon (planes gratuitos), sus credenciales y el bypass de automatización de Vercel como GitHub Secrets.
- **CI/CD**: workflows de GitHub Actions (build, pruebas, migración, despliegue, smoke, accesibilidad).
- **Datos**: primera aplicación real de la migración baseline (generada en `cimientos-y-despliegue`) contra Neon.
- **Fuera de alcance**: dominio propio/DNS personalizado, monitoreo o alertas más allá del smoke test de CI, el Postgres gratuito de Render (no se usa; la base de datos es exclusivamente Neon), y cualquier lógica de negocio o pantalla real de `/design`.
