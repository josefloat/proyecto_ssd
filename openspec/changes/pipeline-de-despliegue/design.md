## Context

Depende de `cimientos-y-despliegue`: el backend ya expone `/live` y `/health`, el frontend ya tiene home placeholder y proxy `rewrites()`, y Prisma ya tiene su migración baseline generada localmente. Este cambio conecta todo eso con infraestructura real: Vercel (frontend, Hobby), Render (backend, Web Service Free), Neon (Postgres, Free, scale-to-zero).

Una auditoría (Codex) sobre la propuesta original combinada encontró varios mecanismos de despliegue que no estaban cubiertos y que son específicos de estos proveedores gratuitos: Render no tiene pre-deploy command ni jobs one-off, Vercel corta los rewrites externos a los 120s, y los auto-deploys nativos de ambos proveedores pueden desincronizarse con lo que el pipeline verificó. Este documento encierra las decisiones que resuelven esos hallazgos.

## Goals / Non-Goals

**Goals:**
- El build y las pruebas de integración bloquean cualquier despliegue si fallan.
- La migración contra Neon corre en un lugar que realmente existe en el plan gratuito de Render (GitHub Actions, no Render mismo).
- Lo que se despliega es exactamente el commit que pasó el pipeline, en ambos proveedores, sin que un auto-deploy nativo lo adelante o lo pise.
- Una regresión de accesibilidad se detecta en preview, antes de ser pública, no después.
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

**3. Vercel: mismo artefacto prebuilt para preview y promoción (`vercel deploy --prebuilt` + `vercel promote`).**
Alternativa descartada: reconstruir el frontend para producción después de verificar el preview. Reconstruir introduce la posibilidad de que el artefacto promovido sea distinto (dependencias resueltas de otra forma, variables de entorno de build diferentes) del que realmente se verificó. Usar el mismo build prebuilt para preview y promoción garantiza que lo que se probó es exactamente lo que se publica.

**4. Rollout preview-first solo para el frontend; el backend se verifica post-deploy directo.**
Alternativa descartada: preview-first también para Render. No es viable sin costo adicional en el plan Free (ver Non-Goals). El riesgo que preview-first mitiga en el frontend — una regresión de accesibilidad visible para el público antes de detectarse — no tiene un equivalente tan directo en el backend (su superficie pública es la API, verificada por el smoke test de `/health` inmediatamente después del deploy, no por un escaneo de UI).

**5. Render usa `/live` como Health Check Path; `/health` nunca se configura como tal.**
`/live` y `/health` ya existen como endpoints separados (definidos en `cimientos-y-despliegue`); esta es la decisión de CUÁL usa Render para decidir si la instancia sigue viva. Alternativa descartada: usar `/health` como Health Check Path. Si Neon está dormido (scale-to-zero) y `/health` responde 503 mientras espera que despierte, Render dejaría de enviar tráfico a los 15s y reiniciaría la instancia a los 60s — reiniciando un proceso que en realidad estaba sano, solo esperando a la base de datos. `/live` no depende de la base de datos, así que nunca dispara ese reinicio.

**6. Ownership del escaneo axe-core: vive en el gate de preview de este cambio, no se duplica en `home-page`.**
`home-page` (en `cimientos-y-despliegue`) define el requisito de cero violaciones de accesibilidad y lo verifica localmente. Este cambio no redefine ese requisito; lo reutiliza como criterio de paso/no-paso del gate de preview antes de promover a producción. Solo hay un lugar donde "cero violaciones de axe-core" se decide qué significa, y un lugar donde se aplica contra un entorno desplegado.

**7. Smoke test del recorrido completo a través del proxy, además del backend directo.**
Render (~1 min de cold start) + Neon (scale-to-zero) pueden acumular latencia justo cuando Vercel corta los rewrites externos a los 120s. Probar solo `<backend-url>/health` directo no cubre ese recorrido: el proxy del frontend es una tercera pieza con su propio límite de tiempo. Se añade un smoke test específico de `<frontend-url>/<ruta-proxy>/health`, con reintentos, que además distingue explícitamente un timeout de proxy (Vercel corta a los 120s) de un fallo real de conexión a la base de datos — son dos causas distintas y el diagnóstico no debe confundirlas.

**8. Prisma fijado en 6.x (decisión de `cimientos-y-despliegue`): impacto en este pipeline.**
El job de migración de este cambio depende de que el datasource siga aceptando `url`/`directUrl` tal como están hoy. Si en el futuro se actualiza a Prisma 7.x sin adaptar `prisma.config.ts` y un driver adapter, el job de migración de este pipeline fallaría con `P1012`. Este cambio no hace nada adicional al respecto — el pin ya vive en `cimientos-y-despliegue` — pero lo documenta aquí porque es este job el que lo consume en producción.

**9. Vercel Hobby es apto para este proyecto; no requiere mitigación.**
Es un proyecto académico, no comercial, dentro de los términos de uso del plan Hobby. Se documenta como decisión cerrada, no como riesgo abierto.

## Risks / Trade-offs

- [Render Free: cold start de ~1 min tras 15 min de inactividad] → Mitigación: smoke tests con reintentos tolerantes (hasta ~90s) en vez de fallar en el primer request frío.
- [Vercel corta los rewrites externos a los 120s; el cold start acumulado de Render + Neon puede acercarse a ese límite] → Mitigación: smoke test dedicado al recorrido completo a través del proxy (Decisión 7), que distingue timeout de proxy de fallo de base de datos.
- [Render Free no tiene un entorno de preview equivalente al de Vercel] → Mitigación: aceptado como limitación conocida; el backend se verifica solo post-deploy directo (Decisión 4), no preview-first.
- [Auto-deploys nativos de Render/Vercel podrían competir con este pipeline si no se desactivan] → Mitigación: Decisión 2 — desactivarlos explícitamente es una tarea de este cambio, no una suposición.
- [Secretos de Neon, Render y Vercel repartidos en tres dashboards, más GitHub Secrets] → Mitigación: tareas [HUMANO OBLIGATORIO] explícitas, separadas de los jobs automatizados y declaradas como bloqueantes del resto del pipeline.

Descartado explícitamente: una advertencia sobre el Postgres gratuito de Render (que expira a los 30 días) no aplica — este proyecto nunca provisiona un Postgres de Render; la única base de datos es Neon.

## Migration Plan

Primera vez que el pipeline toca Neon en producción. Orden: provisión humana de Neon/Render/Vercel y sus secretos → build + pruebas de integración en verde → job de migración (`prisma migrate deploy` con `DIRECT_URL`) → despliegue anclado a `github.sha` en Render y Vercel (auto-deploys nativos desactivados) → preview de Vercel + smoke + axe-core en preview → promoción a producción → smoke post-promoción (backend directo y recorrido vía proxy).

Rollback: Vercel permite volver instantáneamente al deployment anterior; Render permite redesplegar un commit previo vía la misma API usada para desplegar. La migración de este sprint es aditiva (baseline), por lo que no requiere rollback de datos.

## Open Questions

Ninguna pendiente para el alcance de este cambio. Si el presupuesto cambia y Render pasa a un plan pago, valdría la pena revisar si conviene un entorno de preview también para el backend (Decisión 4) — no es necesario para este sprint.
