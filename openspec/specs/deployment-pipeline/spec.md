# deployment-pipeline Specification

## Purpose
Definir y verificar el pipeline CI/CD que construye y prueba el monorepo,
aplica migraciones en Neon, despliega el commit exacto en Render y Vercel,
valida el frontend en un Preview protegido antes de promoverlo y confirma
automáticamente la salud del sistema en producción.
## Requirements
### Requirement: Build y pruebas de integración bloquean el despliegue
El pipeline de CI SHALL construir la imagen Docker real del backend y el build de producción del frontend, y ejecutar las pruebas de integración (Supertest) contra un Postgres real de servicio en CI, antes de permitir cualquier despliegue a producción.

#### Scenario: Build y pruebas en verde
- **GIVEN** un push a `main` con código que compila y cuyas pruebas pasan
- **WHEN** el pipeline de CI corre
- **THEN** el build de ambos paquetes (incluida la imagen Docker del backend) y las pruebas de integración contra Postgres real terminan en verde, y el pipeline avanza al job de migración

#### Scenario: Fallo de build o pruebas bloquea el deploy
- **GIVEN** un workflow fixture fuerza deliberadamente el fallo del job de build o de pruebas de integración (por ejemplo, una rama de prueba con un test roto a propósito)
- **WHEN** el pipeline de CI corre en GitHub Actions
- **THEN** el job de despliegue queda con `conclusion: "skipped"` según la API de GitHub Actions (`GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`), confirmando que el gate bloquea el despliegue y no solo que el YAML lo declara

### Requirement: Migración con URL directa, aislada del runtime
El pipeline SHALL ejecutar `prisma migrate deploy` en un job de GitHub Actions usando `DIRECT_URL`, después de que el build y las pruebas estén en verde. En el mismo gate, inmediatamente después de una migración exitosa, SHALL ejecutar el seed idempotente mediante `prisma db seed`; solo si migración y seed terminan correctamente SHALL habilitar cualquier despliegue de Render o Vercel, ya que Render Free no admite pre-deploy command ni jobs one-off.

#### Scenario: DP-1.1 Migración y seed exitosos habilitan los despliegues
- **GIVEN** build y pruebas están en verde, `DIRECT_URL` es válida y el seed puede conectarse a PostgreSQL
- **WHEN** el job previo al despliegue ejecuta `prisma migrate deploy` seguido de `prisma db seed`
- **THEN** las migraciones se aplican, el seed idempotente termina correctamente y solo después quedan habilitados los jobs de Render y Vercel
- **PRUEBA AUTOMATIZADA** `pipeline-seed-gate.test.ts` valida el orden y dependencias del workflow con fixture local, mientras `seed.integration.test.ts` ejecuta el seed dos veces contra PostgreSQL real

#### Scenario: DP-1.2 URL directa inválida detiene migración, seed y despliegues
- **GIVEN** `DIRECT_URL` es inválida o Neon no es alcanzable para la conexión directa
- **WHEN** el job ejecuta `prisma migrate deploy`
- **THEN** la migración falla, `prisma db seed` no se ejecuta y los jobs de Render y Vercel quedan `skipped`
- **PRUEBA AUTOMATIZADA** el mecanismo existente `workflow_dispatch.force_invalid_direct_url` inyecta una conexión local inalcanzable sin alterar el secreto real y la verificación de jobs confirma el fallo de `migrate` y la omisión de seed y despliegues

#### Scenario: DP-1.3 Seed fallido después de migrar bloquea ambos despliegues
- **GIVEN** `prisma migrate deploy` terminó correctamente y un fixture local fuerza un código de salida no cero en `prisma db seed`
- **WHEN** el gate ejecuta el seed posterior a la migración
- **THEN** el gate falla y los jobs de Render y Vercel quedan `skipped` sin llamar a Neon, Render ni Vercel
- **PRUEBA AUTOMATIZADA** `pipeline-seed-gate.test.ts` ejecuta el fixture local de seed fallido, usa spies de despliegue y valida el DAG para confirmar que ninguno puede ejecutarse

### Requirement: Despliegue del commit exacto, sin auto-deploys duplicados
El pipeline SHALL desplegar el commit exacto de `github.sha` a Render y a Vercel, con los auto-deploys nativos de ambos proveedores desactivados, y SHALL consultar la API de cada proveedor hasta confirmar que ese commit específico está live antes de correr el smoke test.

#### Scenario: Commit de github.sha confirmado como live en ambos proveedores
- **GIVEN** el job de migración terminó en verde
- **WHEN** el pipeline dispara el deploy de Render (API con `commitId: github.sha`) y de Vercel (CLI con el mismo commit)
- **THEN** el pipeline consulta las APIs respectivas hasta que ambos reportan ese commit como el desplegado actualmente, antes de continuar al smoke test

#### Scenario: Desajuste de commit detectado y bloqueado
- **GIVEN** los auto-deploys nativos de Render o Vercel siguen activos y se dispara un deploy de un commit distinto al de este pipeline (por ejemplo, un push concurrente)
- **WHEN** el pipeline consulta el commit live en cada proveedor
- **THEN** detecta el desajuste y falla explícitamente, en vez de correr el smoke test contra un commit equivocado y reportar un falso verde

### Requirement: Rollout preview-first en Vercel antes de promover a producción
El pipeline SHALL desplegar primero el frontend a un deployment de preview de Vercel protegido por Vercel Authentication (build hecho con `vercel pull --environment=preview` + `vercel build` + `vercel deploy --prebuilt`), acceder mediante `x-vercel-protection-bypass` con un secreto exclusivo de automatización, ejecutar el smoke test y el escaneo axe-core contra esa URL de preview, y solo promoverla a producción si ambos pasan. Promover un deployment de Preview a producción SHALL disparar un rebuild completo con variables de entorno de Production (comportamiento documentado de Vercel, no evitable): lo que este requisito garantiza es que se reconstruye el mismo *source commit* que pasó el gate de preview, no que el binario sea idéntico. Por eso la verificación posterior a la promoción SHALL confirmar el deployment de producción real resultante (ver "Verificación del deployment de producción real tras la promoción"), no la URL de preview. El backend en Render no tiene un gate de preview equivalente y se verifica post-deploy directo (ver "Smoke test de runtime contra /health").

#### Scenario: Preview verificado se promueve a producción
- **GIVEN** el commit pasó build, pruebas y migración, y GitHub Actions dispone de `VERCEL_AUTOMATION_BYPASS_SECRET`
- **WHEN** se despliega a un preview protegido de Vercel y el smoke test más el escaneo axe-core pasan contra esa URL enviando `x-vercel-protection-bypass`
- **THEN** el pipeline promueve ese preview (mismo source commit, rebuild con variables de Production) y continúa con la verificación del deployment de producción real

#### Scenario: Preview protegido solo permite el gate con bypass
- **GIVEN** Vercel Authentication está activa para deployments de preview y existe un bypass exclusivo de automatización
- **WHEN** el pipeline consulta la misma URL primero sin bypass y después con `x-vercel-protection-bypass`
- **THEN** la solicitud sin bypass redirige al SSO de Vercel, la solicitud con bypass recibe la aplicación con 200, y el secreto nunca se imprime en los logs

#### Scenario: Violación de accesibilidad en preview bloquea la promoción
- **GIVEN** un fixture de preview incluye una página deliberadamente inaccesible (por ejemplo, un botón sin contraste suficiente o sin texto alternativo, añadido a propósito en una rama de prueba)
- **WHEN** el escaneo axe-core corre contra esa URL de preview usando el bypass de automatización
- **THEN** detecta la violación, el pipeline NO promueve ese deployment a producción, y la regresión nunca llega a estar públicamente live

### Requirement: Verificación del deployment de producción real tras la promoción
El pipeline SHALL identificar el deployment de producción real resultante de `vercel promote` consultando `targets.production` en `GET /v9/projects/{id}` de la API de Vercel — no la URL de Preview usada antes de promover. SHALL hacer polling de `targets.production.readyState` hasta `READY`, rechazar explícitamente un payload cuyo `target` no sea `"production"`, confirmar que `targets.production.alias` incluye al menos un dominio real, comparar el commit de origen (`targets.production.meta.commitSha`) contra `github.sha`, y solo entonces ejecutar un smoke HTTP `200` contra ese dominio real.

#### Scenario: Deployment de producción real confirmado tras la promoción
- **GIVEN** `vercel promote` se ejecutó sobre el preview verificado
- **WHEN** el pipeline consulta `GET /v9/projects/{id}` hasta que `targets.production.readyState` es `READY`
- **THEN** confirma `target: "production"`, al menos un dominio en `alias`, que `meta.commitSha` coincide con `github.sha`, y un smoke HTTP contra ese dominio responde `200`

#### Scenario: Payload de Preview rechazado en la verificación de producción
- **GIVEN** un fixture simula una respuesta de la API de Vercel donde el objeto bajo `targets.production` tiene `target: "preview"` en vez de `"production"`
- **WHEN** el script de validación (`scripts/vercel-parse-production-target.sh`) procesa ese fixture
- **THEN** falla explícitamente sin confirmar el deployment ni intentar el smoke HTTP, sin necesidad de tocar la API real de Vercel

#### Scenario: SHA de producción vacío o distinto detectado y bloqueado
- **GIVEN** un fixture simula `targets.production.meta.commitSha` vacío, y otro fixture simula un valor distinto a `github.sha`
- **WHEN** el script de validación procesa cada fixture
- **THEN** ambos fallan explícitamente (reutilizando `scripts/assert-commit-match.sh`), en vez de reportar un falso verde

### Requirement: Smoke test de runtime contra /health, separado de la migración
El pipeline SHALL verificar, tras el despliegue, que `/health` responde `200` con `db: "ok"` usando la URL pooled en runtime. Un fallo aquí es independiente de si la migración (URL directa) tuvo éxito.

#### Scenario: /health responde db:ok tras el despliegue
- **GIVEN** el backend está desplegado y `DATABASE_URL` (pooled) es válida
- **WHEN** el smoke test consulta `<backend-url>/health`
- **THEN** responde `200` con `db: "ok"` dentro de una ventana de reintento tolerante al cold start de Render/Neon (hasta ~90s)

#### Scenario: URL pooled inválida detectada en un entorno efímero de prueba
- **GIVEN** un entorno efímero de prueba del smoke test se configura deliberadamente con una `DATABASE_URL` pooled inválida, sin tocar el Render/Neon reales de producción
- **WHEN** el script de smoke test consulta `/health` de ese entorno efímero
- **THEN** recibe `503` y el job de smoke test falla, confirmando que el smoke test detecta este fallo sin necesitar romper producción para probarlo

### Requirement: Verificación del recorrido completo a través del proxy
El pipeline SHALL verificar, además del backend directo, que el recorrido completo `<frontend-url>/api/health` a través del Route Handler de Next.js responde correctamente. Cada intento upstream está limitado a 10s por el propio Route Handler; el smoke test SHALL reintentar durante una ventana global de hasta 120s para tolerar el despertar de Render y Neon, distinguiendo un `504` generado por el Route Handler de un `503` reenviado desde el backend.

#### Scenario: Recorrido completo a través del proxy responde dentro de la ventana global
- **GIVEN** el frontend y el backend recién despertaron de inactividad (cold start acumulado de Render + Neon)
- **WHEN** el smoke test consulta `<frontend-url>/api/health` con reintentos durante una ventana global máxima de 120s
- **THEN** puede recibir `504` controlados en intentos intermedios, pero termina con `200` y `db: "ok"` antes de agotar la ventana

#### Scenario: Timeout de proxy distinguido de un fallo real de base de datos
- **GIVEN** un intento upstream supera los 10s o el backend responde `503` porque no puede consultar la base de datos
- **WHEN** el smoke test consulta `<frontend-url>/api/health`
- **THEN** reporta `504` como timeout generado por el Route Handler y `503` como fallo real de base de datos, sin confundir ambas causas
