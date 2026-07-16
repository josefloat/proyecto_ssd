## Context

Repositorio vacío salvo el andamiaje de OpenSpec. No existe `frontend/`, `backend/`, ni `docker-compose.yml`. Desarrollador único, contexto académico: lo evaluado es la trazabilidad y calidad de las pruebas, no la cantidad de features.

Este cambio es la mitad "local" de un par: cubre todo lo que se puede construir y verificar en la máquina del desarrollador. La otra mitad, `pipeline-de-despliegue`, cubre CI, migración contra Neon, despliegue a Render/Vercel y verificación post-deploy. La división existe porque una auditoría (Codex) encontró que la propuesta original, combinada, necesitaba más tareas de las que el config del proyecto permite por cambio, y porque mezclar "el código funciona en mi máquina" con "el código está desplegado y verificado en vivo" complicaba la trazabilidad de las pruebas.

## Goals / Non-Goals

**Goals:**
- Monorepo con `frontend/` y `backend/` corriendo en Docker Compose en local, sin depender de instalaciones locales de Node/Postgres.
- Prisma fijado a una versión que soporte `url`/`directUrl` en el datasource, con la migración baseline ya generada y lista para aplicarse en producción (por el otro cambio).
- `/live` y `/health` como endpoints separados, cada uno con un propósito distinto y comprobado localmente.
- Home placeholder accesible, con proxy same-origin hacia el backend configurado desde el día uno.

**Non-Goals:**
- Modelo de agendamiento (Turno, ProgramacionSemanal, Slot, Bloqueo, Cita) — no existe todavía.
- Estrategia de concurrencia sobre slots — no aplica: este cambio no crea la tabla `Slot`.
- Autenticación y roles — sin login en este sprint.
- Pantallas reales de `/design` — el home aquí es un placeholder de infraestructura.
- CI, migración a producción, despliegue real, smoke tests, escaneo de accesibilidad contra una URL viva, y provisión de cuentas en Neon/Render/Vercel — todo eso es `pipeline-de-despliegue`.
- Umbral de cobertura de dominio (80%) — no aplica: no hay lógica de dominio en este cambio.

## Decisions

**1. Proxy same-origin vía un Route Handler catch-all, no CORS con whitelist.**
Alternativa considerada: habilitar CORS en Express con el origen de producción en la whitelist. Se descarta porque los preview deployments de Vercel generan subdominios aleatorios (whitelist estática inmantenible), y porque los roles con contraseña que llegan en sprints futuros necesitarán cookies de sesión — cross-site cookies (`SameSite=None`) son frágiles en Safari/incógnito. El proxy mantiene todo same-origin desde ahora. La URL del backend a la que apunta el proxy es una variable de entorno server-side, configurable sin rebuild del bundle del cliente; en este cambio apunta al backend local de Docker Compose, y en `pipeline-de-despliegue` se reconfigura para producción.

Alternativa probada y descartada durante la implementación: `rewrites()` de Next.js con un destino externo. Funciona para el camino feliz, pero ante un backend inalcanzable Next.js responde con un `500` interno opaco que no se puede personalizar — no hay forma de garantizar el `502`/`504` sin URL filtrada que pide la spec. Un Route Handler catch-all (`app/api/[...path]/route.ts`) que hace el `fetch` al backend explícitamente, con `try/catch` y `AbortSignal.timeout`, da control total sobre el código de estado y el cuerpo de la respuesta de error, logrando el mismo objetivo same-origin.

**2. Prisma fijado en 6.x, con `url` (pooled) + `directUrl` (directa).**
Alternativa considerada: usar solo una URL para todo, incluidas migraciones. Se descarta porque `prisma migrate deploy` usa locks de advisory y DDL que no son confiables a través de un pooler en modo transacción — falla documentada tanto por Neon como por Prisma.
Alternativa descartada explícitamente: migrar a Prisma 7.x. En Prisma 7, el datasource `url` en `schema.prisma` ya no se soporta directamente (falla con el error `P1012`) y `directUrl` fue eliminado del datasource; el equivalente requiere `prisma.config.ts`, un driver adapter explícito, y declarar un `output` path para el cliente generado. Ese trabajo no aporta nada al objetivo del curso (trazabilidad de pruebas, no arquitectura de acceso a datos) y se pospone indefinidamente. Una prueba automatizada rechaza manifiestos con versiones fuera de 6.x antes de que lleguen a `prisma generate` o al build.

**3. `/live` (liveness) separado de `/health` (readiness).**
Alternativa considerada: un único endpoint que verifica la base de datos y se usa para todo (liveness, readiness, y smoke test). Se descarta porque, en producción (`pipeline-de-despliegue`), Render usa un "Health Check Path" que, si falla, deja de enviar tráfico a los 15s y reinicia la instancia a los 60s — y Neon (scale-to-zero) puede tardar más que eso en despertar. Si ese Health Check Path fuera `/health` (con chequeo de DB), un Neon dormido causaría reinicios en bucle del backend. `/live` existe específicamente para no depender de la base de datos, y es el que se configurará como Health Check Path de Render en el otro cambio. `/health` sigue siendo el que verifica la base de datos, y se usa para smoke tests, nunca como Health Check Path.

**4. Docker Compose es solo para desarrollo local en este cambio.**
El servicio de Postgres en CI (en `pipeline-de-despliegue`) usa la misma imagen pero se configura de forma independiente como servicio de GitHub Actions, no reutiliza literalmente este `docker-compose.yml`. Producción nunca corre Compose.

**5. Home como placeholder de infraestructura, exento temporalmente del diseño de reserva.**
`design/base-ui-ux-reservas.png` es la referencia visual base para el flujo de reserva del paciente que se implementará en un cambio posterior. El home de este cambio no intenta inventar ni adelantar esas pantallas: solo necesita renderizar sin errores, tener un heading/landmark semántico, y pasar axe-core con cero violaciones.

## Risks / Trade-offs

- [El pin de Prisma a 6.x puede quedar obsoleto si en el futuro se necesita una función exclusiva de 7.x] → Mitigación: ninguna acción ahora; se documenta la alternativa descartada (arriba) para que la decisión se revise conscientemente si el costo se vuelve necesario, no por accidente.
- [Sin la migración drift-check en CI (eso vive en `pipeline-de-despliegue`), un desarrollador podría olvidar generar una migración al modificar el schema] → Mitigación: una prueba local ejecuta `prisma migrate diff --exit-code` contra un schema fixture con un cambio no migrado; el chequeo en CI del otro cambio es una segunda capa, no la única.

## Migration Plan

No hay datos previos que migrar. Este cambio solo genera la migración baseline de Prisma localmente (aditiva, no destructiva) contra el Postgres de Docker Compose. Aplicarla contra Neon en producción es tarea de `pipeline-de-despliegue`.

## Open Questions

Ninguna pendiente para el alcance local. Las preguntas abiertas sobre producción (dominio propio, mecanismo exacto del smoke test) se resuelven en `pipeline-de-despliegue`.
