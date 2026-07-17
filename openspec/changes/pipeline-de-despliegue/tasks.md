## 1. Provisión manual de infraestructura [HUMANO OBLIGATORIO] — bloquea las secciones 2-5

- [x] 1.1 [HUMANO OBLIGATORIO] Crear cuenta y proyecto en Neon; obtener connection string pooled y directa
- [x] 1.2 [HUMANO OBLIGATORIO] Crear cuenta y Web Service en Render; obtener deploy hook, API key y service ID
- [x] 1.3 [HUMANO OBLIGATORIO] Crear cuenta/proyecto en Vercel; obtener token, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` y un secreto de Protection Bypass for Automation manteniendo activo `Require Log In`
- [x] 1.4 [HUMANO OBLIGATORIO] Guardar todas las credenciales anteriores como GitHub Secrets del repositorio, incluido `VERCEL_AUTOMATION_BYPASS_SECRET`

## 2. CI: build, pruebas y gate de migración

- [x] 2.1 Workflow de build (ambos paquetes + imagen Docker del backend) y pruebas de integración contra Postgres real de servicio en CI, con un fixture que fuerza el fallo y confirma vía la API de GitHub Actions que el job de despliegue queda `skipped`; verifica los escenarios "Build y pruebas en verde" y "Fallo de build o pruebas bloquea el deploy" de `specs/deployment-pipeline/spec.md`
- [x] 2.2 Job de migración (`prisma migrate deploy` con `DIRECT_URL`) tras build/pruebas en verde, y prueba con `DIRECT_URL` inválida que confirma que la migración falla y no dispara el deploy de Render; verifica los escenarios "Migración exitosa habilita el despliegue de Render" y "URL directa inválida detiene el pipeline antes de desplegar" de `specs/deployment-pipeline/spec.md`

## 3. Despliegue SHA-pinned y rollout preview-first

- [ ] 3.1 [REABIERTA] Desactivar auto-deploys nativos de Render y Vercel; disparar Render vía API (`commitId: github.sha`) y Vercel vía CLI (`vercel deploy --prebuilt`) con el mismo commit, y hacer polling contra la API de Render hasta confirmar el commit live, fallando si no coincide; verifica el escenario "Commit de github.sha confirmado como live en ambos proveedores" (parte Render) y "Desajuste de commit detectado y bloqueado" de `specs/deployment-pipeline/spec.md`. Corrige el defecto detectado tras el PR #8: el paso que confirmaba el commit de Vercel consultaba la URL de Preview después de promoverla en vez del deployment de producción real.
- [ ] 3.2 [REABIERTA] Deploy a preview protegido de Vercel + prueba negativa sin bypass + smoke test y axe-core con `x-vercel-protection-bypass` + promoción (`vercel promote`) + **identificación y verificación del deployment de producción real** (`targets.production` de `GET /v9/projects/{id}`: polling hasta `READY`, dominio real, `meta.commitSha` == `github.sha` vía `scripts/assert-commit-match.sh`) + smoke HTTP contra el dominio real de producción, con fixtures que fallan ante un payload de Preview, un SHA vacío o un SHA distinto (`scripts/vercel-parse-production-target.sh` con fixtures locales, sin tocar Vercel), y el fixture existente de página inaccesible en preview que confirma que axe bloquea la promoción; verifica los escenarios "Preview verificado se promueve a producción", "Preview protegido solo permite el gate con bypass", "Violación de accesibilidad en preview bloquea la promoción", "Deployment de producción real confirmado tras la promoción", "Payload de Preview rechazado en la verificación de producción" y "SHA de producción vacío o distinto detectado y bloqueado" de `specs/deployment-pipeline/spec.md`

## 4. Smoke tests de runtime (directo y a través del proxy)

- [ ] 4.1 Smoke test contra `<backend-url>/health` con reintentos tolerantes al cold start, y un entorno efímero con `DATABASE_URL` pooled inválida que confirma que el smoke test detecta el 503 sin tocar producción; verifica los escenarios "/health responde db:ok tras el despliegue" y "URL pooled inválida detectada en un entorno efímero de prueba" de `specs/deployment-pipeline/spec.md`
- [ ] 4.2 Smoke test del recorrido completo `<frontend-url>/api/health` con intentos upstream de hasta 10s y una ventana global de reintentos de hasta 120s, distinguiendo explícitamente `504` del Route Handler de `503` del backend; verifica los escenarios "Recorrido completo a través del proxy responde dentro de la ventana global" y "Timeout de proxy distinguido de un fallo real de base de datos" de `specs/deployment-pipeline/spec.md`

## 5. Verificación final del sprint

- [ ] 5.1 Confirmar en producción real: `/live` responde 200 sin tocar la base de datos, `/health` responde `db: "ok"`, el recorrido completo a través del Route Handler responde dentro de la ventana global de 120s, axe-core reportó cero violaciones en preview antes de la promoción, y el pipeline completo (build → pruebas → migración → deploy SHA-pinned → preview + axe → promoción → smoke post-promoción) está en verde en GitHub Actions
