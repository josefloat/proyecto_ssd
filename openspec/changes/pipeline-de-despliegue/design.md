## Context

Depende de `cimientos-y-despliegue`: el backend ya expone `/live` y `/health`, el frontend ya tiene home placeholder y un Route Handler catch-all en `app/api/[...path]/route.ts`, y Prisma ya tiene su migración baseline generada localmente. Este cambio conecta todo eso con infraestructura real: Vercel (frontend, Hobby), Render (backend, Web Service Free), Neon (Postgres, Free, scale-to-zero).

Una auditoría (Codex) sobre la propuesta original combinada encontró varios mecanismos de despliegue que no estaban cubiertos y que son específicos de estos proveedores gratuitos: Render no tiene pre-deploy command ni jobs one-off, el Route Handler impone deliberadamente un timeout upstream de 10s para responder con un `504` controlado, y los auto-deploys nativos de Render y Vercel pueden desincronizarse con lo que el pipeline verificó. Este documento encierra las decisiones que resuelven esos hallazgos.

## Goals / Non-Goals

**Goals:**
- El build y las pruebas de integración bloquean cualquier despliegue si fallan.
- La migración contra Neon corre en un lugar que realmente existe en el plan gratuito de Render (GitHub Actions, no Render mismo).
- Lo que se despliega es exactamente el commit que pasó el pipeline, en ambos proveedores, sin que un auto-deploy nativo lo adelante o lo pise.
- Una regresión de accesibilidad se detecta en preview, antes de ser pública, no después.
- El preview permanece protegido por Vercel Authentication; solo GitHub Actions obtiene acceso mediante un bypass de automatización almacenado como secreto.
- El smoke test cubre tanto el backend directo como el recorrido completo a través del proxy del frontend, porque los cold starts de los tres servicios gratuitos pueden acumularse.
- Las tareas que requieren credenciales humanas están separadas y declaradas como bloqueantes.

**Non-Goals:**
- Modelo de agendamiento, autenticación, roles, o cualquier lógica de negocio.
- Dominio propio / DNS personalizado.
- Monitoreo o alertas de producción más allá de este smoke test.
- El Postgres gratuito de Render — este proyecto usa exclusivamente Neon; no se provisiona ni se advierte sobre un servicio de Render Postgres que no existe en este proyecto.
- Un entorno de preview para el backend en Render — no existe sin costo adicional en el plan Free; se documenta como limitación aceptada, no se simula.

## Decisions

**1. Migración vía job de GitHub Actions con `DIRECT_URL`, no un mecanismo de Render.**
Alternativa descartada: usar el "pre-deploy command" o un job one-off de Render. Ninguno de los dos existe en el plan Free — Render Free solo corre el proceso web declarado, sin hooks de ciclo de vida adicionales. El job de migración corre después del gate de build/pruebas y antes de disparar el despliegue de Render; si falla, no se despliega nada.

**2. Despliegue anclado a `github.sha`, con los auto-deploys nativos desactivados.**
Alternativa descartada: dejar activos los webhooks de deploy automático de Render y Vercel disparados por push. Son asíncronos respecto al pipeline: un push concurrente podría hacer que Render o Vercel desplieguen un commit distinto al que el pipeline acaba de verificar, produciendo un "falso verde" (el pipeline pasa, pero lo que queda live no es lo que se probó). Se desactivan ambos auto-deploys; el pipeline dispara el deploy explícitamente vía API (Render) y CLI (Vercel), y hace polling contra cada API hasta confirmar que el commit desplegado coincide con `github.sha` antes de continuar.

Verificación del escenario "Desajuste de commit detectado y bloqueado": la comparación de commit de ambos jobs (`deploy-render` y `deploy-vercel`) se extrajo a `scripts/assert-commit-match.sh`, un script puro sin llamadas de red. `scripts/test-assert-commit-match.sh` lo ejercita con fixtures (match, mismatch, respuesta vacía de la API) como paso de `build-and-test` en cada push, sin tocar Render/Vercel reales. Extraer la lógica reveló que la comparación original de Render dejaba pasar en silencio un `commit_id` vacío devuelto por la API (a diferencia de la de Vercel, que sí fallaba); el script compartido corrige eso y unifica el comportamiento en ambos proveedores.

**3. Vercel: mismo source commit para preview y producción (`vercel deploy --prebuilt` + `vercel promote`), con rebuild explícito documentado.**
Corrección (post-PR #8): la afirmación anterior de esta decisión — "mismo artefacto prebuilt, sin rebuild" — es incorrecta. La documentación vigente de Vercel ([Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment)) es explícita: promover un deployment de Preview a producción ocurre "a través de un rebuild completo", y advierte que "no puedes usar tus variables de entorno de preview en un deployment de producción" — a diferencia de Instant Rollback o de promover un build ya construido para producción (staging), que sí reasignan dominios sin rebuild. Como este pipeline promueve un deployment construido con `vercel pull --environment=preview` (variables de Preview), Vercel reconstruye ese mismo *source commit* con variables de Production antes de servirlo. Lo que garantiza este diseño no es bit-a-bit el mismo artefacto, sino que es el mismo commit de origen el que se reconstruye — el rebuild en sí es el mecanismo documentado de Vercel para pasar de variables de Preview a variables de Production, no un efecto secundario evitable.
Alternativa descartada: reconstruir manualmente con `vercel build --prod` después de verificar el preview. No aporta nada sobre dejar que `vercel promote` dispare su propio rebuild documentado, y complicaría innecesariamente el pipeline con un build adicional explícito.
Implicación de trazabilidad: como el artefacto de producción es un build distinto (no el mismo binario que pasó axe-core en preview), este cambio ya no puede afirmar "lo que se promovió es literalmente lo que se escaneó". Lo que sí puede y debe verificar — y lo que las tareas 3.1–3.2 corrigen — es que el *deployment de producción real* resultante (1) exista, (2) esté `READY`, (3) el dominio real de producción apunte a él, y (4) su commit de origen coincida con `github.sha`, consultando la API de Vercel contra el deployment de producción real en vez de re-consultar la URL de Preview.

**4. Rollout preview-first solo para el frontend; el backend se verifica post-deploy directo.**
Alternativa descartada: preview-first también para Render. No es viable sin costo adicional en el plan Free (ver Non-Goals). El riesgo que preview-first mitiga en el frontend — una regresión de accesibilidad visible para el público antes de detectarse — no tiene un equivalente tan directo en el backend (su superficie pública es la API, verificada por el smoke test de `/health` inmediatamente después del deploy, no por un escaneo de UI).

**5. Render usa `/live` como Health Check Path; `/health` nunca se configura como tal.**
`/live` y `/health` ya existen como endpoints separados (definidos en `cimientos-y-despliegue`); esta es la decisión de CUÁL usa Render para decidir si la instancia sigue viva. Alternativa descartada: usar `/health` como Health Check Path. Si Neon está dormido (scale-to-zero) y `/health` responde 503 mientras espera que despierte, Render dejaría de enviar tráfico a los 15s y reiniciaría la instancia a los 60s — reiniciando un proceso que en realidad estaba sano, solo esperando a la base de datos. `/live` no depende de la base de datos, así que nunca dispara ese reinicio.

**6. Ownership del escaneo axe-core: vive en el gate de preview de este cambio, no se duplica en `home-page`.**
`home-page` (en `cimientos-y-despliegue`) define el requisito de cero violaciones de accesibilidad y lo verifica localmente. Este cambio no redefine ese requisito; lo reutiliza como criterio de paso/no-paso del gate de preview antes de promover a producción. Solo hay un lugar donde "cero violaciones de axe-core" se decide qué significa, y un lugar donde se aplica contra un entorno desplegado.

**7. Smoke test del recorrido completo a través del proxy, además del backend directo.**
Render (~1 min de cold start) + Neon (scale-to-zero) pueden superar el timeout upstream deliberado de 10s del Route Handler. Probar solo `<backend-url>/health` directo no cubre ese recorrido: `/api/[...path]` es una tercera pieza que aborta el `fetch` y responde `504` con un mensaje controlado. Se añade un smoke test específico de `<frontend-url>/api/health`, con una ventana global de reintentos de hasta 120s: puede tolerar `504` mientras Render despierta, pero debe terminar en `200` con `db: "ok"`. Un `503` reenviado desde el backend se reporta como fallo real de base de datos, no como timeout del proxy. El techo vigente de Vercel Functions Hobby con Fluid compute es 300s, por lo que no es el límite operativo de este flujo; la fuente oficial consultada es [Vercel Functions con Fluid compute](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute).

**8. Prisma fijado en 6.x (decisión de `cimientos-y-despliegue`): impacto en este pipeline.**
El job de migración de este cambio depende de que el datasource siga aceptando `url`/`directUrl` tal como están hoy. Si en el futuro se actualiza a Prisma 7.x sin adaptar `prisma.config.ts` y un driver adapter, el job de migración de este pipeline fallaría con `P1012`. Este cambio no hace nada adicional al respecto — el pin ya vive en `cimientos-y-despliegue` — pero lo documenta aquí porque es este job el que lo consume en producción.

**9. Vercel Hobby es apto para este proyecto; no requiere mitigación.**
Es un proyecto académico, no comercial, dentro de los términos de uso del plan Hobby. Se documenta como decisión cerrada, no como riesgo abierto.

**10. El preview conserva Vercel Authentication y CI usa Protection Bypass for Automation.**
Alternativa descartada: desactivar `Require Log In` para que `curl` y Playwright reciban 200 sin credenciales. Eso haría públicamente accesible el artefacto que todavía está bajo evaluación y contradice el objetivo de detectar una regresión antes de exponerla al público. Se crea un secreto de Protection Bypass for Automation en Vercel, se almacena como `VERCEL_AUTOMATION_BYPASS_SECRET` en GitHub Actions y el gate de preview envía `x-vercel-protection-bypass` tanto en el smoke HTTP como en el contexto de Playwright. Como prueba negativa del control de acceso, la misma URL sin el header debe redirigir al SSO de Vercel; con el header debe entregar la aplicación y permitir el smoke/axe. El secreto no se usa en producción después de la promoción.

Verificación del escenario "Violación de accesibilidad en preview bloquea la promoción": se probó en una rama descartable (`fixture/axe-blocks-promotion`, borrada tras la prueba, nunca mergeada) con un `<img>` sin `alt` añadido a propósito a la home y los guards de rama de `migrate`/`deploy-vercel` relajados temporalmente para esa rama (el guard de `deploy-render` se dejó intacto para no tocar Render). La corrida real confirmó, vía la API de GitHub Actions, que el paso de axe-core terminó en `failure` y que los pasos posteriores a la promoción (identificación del deployment de producción real, smoke HTTP) quedaron en `skipped` — la promoción nunca se ejecutó.

**11. Verificación del deployment de producción real tras `vercel promote`, en vez de re-consultar la URL de Preview.**
Defecto encontrado tras el PR #8: el paso "Confirmar el mismo commit live en producción" consultaba `steps.preview.outputs.url` — la URL de *Preview* — después de promoverla. Como promover dispara un rebuild (Decisión 3) que produce un deployment de producción distinto (con su propio id), ese paso en realidad volvía a comprobar el Preview, nunca el deployment que sirve el dominio real de producción; un rebuild roto en producción podía pasar el pipeline en verde. Corrección: tras `vercel promote`, el pipeline consulta `GET /v9/projects/{id}` de la API de Vercel y lee `targets.production` — el deployment que Vercel considera actualmente el de producción para ese proyecto. Hace polling de `targets.production.readyState` hasta `READY`, valida explícitamente que `target` sea `"production"` (rechaza un payload de Preview), confirma que `targets.production.alias` tiene al menos un dominio (el dominio real que sirve producción), compara `targets.production.meta.commitSha` contra `github.sha` reutilizando `scripts/assert-commit-match.sh`, y solo entonces hace un smoke HTTP contra ese dominio real. La lógica de parseo/validación (`scripts/vercel-parse-production-target.sh`) está separada de la del polling de red (`scripts/vercel-wait-production-ready.sh`), siguiendo el mismo patrón que la Decisión 2: la primera se prueba con fixtures JSON locales (payload de Preview, SHA vacío, SHA distinto) sin tocar la API real de Vercel; la segunda es la que sí golpea producción en la corrida real.
Fuente: [Find a Project by id or name](https://vercel.com/docs/rest-api/projects/find-a-project-by-id-or-name) — el proyecto expone `targets` como mapa de nombre de entorno a deployment, cada uno con `id`, `readyState`, `alias` y `meta`.

## Risks / Trade-offs

- [Render Free: cold start de ~1 min tras 15 min de inactividad] → Mitigación: smoke tests con reintentos tolerantes (hasta ~90s) en vez de fallar en el primer request frío.
- [El Route Handler corta cada intento upstream a los 10s; el cold start acumulado de Render + Neon puede necesitar varios intentos] → Mitigación: smoke test dedicado a `/api/health` con ventana global de hasta 120s (Decisión 7), que distingue `504` del Route Handler de `503` del backend.
- [Render Free no tiene un entorno de preview equivalente al de Vercel] → Mitigación: aceptado como limitación conocida; el backend se verifica solo post-deploy directo (Decisión 4), no preview-first.
- [Auto-deploys nativos de Render/Vercel podrían competir con este pipeline si no se desactivan] → Mitigación: Decisión 2 — desactivarlos explícitamente es una tarea de este cambio, no una suposición.
- [Secretos de Neon, Render y Vercel repartidos en tres dashboards, más GitHub Secrets] → Mitigación: tareas [HUMANO OBLIGATORIO] explícitas, separadas de los jobs automatizados y declaradas como bloqueantes del resto del pipeline.
- [Vercel Authentication devuelve 302 al SSO en previews y bloquearía el smoke/axe] → Mitigación: Decisión 10 — bypass exclusivo para automatización enviado por header; no se hace público el preview.

Descartado explícitamente: una advertencia sobre el Postgres gratuito de Render (que expira a los 30 días) no aplica — este proyecto nunca provisiona un Postgres de Render; la única base de datos es Neon.

## Migration Plan

Primera vez que el pipeline toca Neon en producción. Orden: provisión humana de Neon/Render/Vercel, bypass de automatización y sus secretos → build + pruebas de integración en verde → job de migración (`prisma migrate deploy` con `DIRECT_URL`) → despliegue anclado a `github.sha` en Render y Vercel (auto-deploys nativos desactivados) → preview protegido de Vercel + smoke + axe-core autenticados por bypass → promoción a producción → smoke post-promoción (backend directo y recorrido vía proxy).

Rollback: Vercel permite volver instantáneamente al deployment anterior; Render permite redesplegar un commit previo vía la misma API usada para desplegar. La migración de este sprint es aditiva (baseline), por lo que no requiere rollback de datos.

## Open Questions

Ninguna pendiente para el alcance de este cambio. Si el presupuesto cambia y Render pasa a un plan pago, valdría la pena revisar si conviene un entorno de preview también para el backend (Decisión 4) — no es necesario para este sprint.
