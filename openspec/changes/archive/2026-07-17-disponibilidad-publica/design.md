## Context

El backend ya contiene el catálogo canónico, la programación semanal, slots materializados y servicios internos para asegurar y consultar disponibilidad. La consulta actual opera por una sola `fechaLima`, incluye campos internos que no pertenecen al contrato público y `asegurarHorizonte()` intenta un `INSERT ... ON CONFLICT DO NOTHING` por cada intervalo esperado aun cuando el horizonte ya está completo.

El frontend es una home placeholder de Next.js 16 con un Route Handler same-origin que limita cada llamada upstream a 10 segundos. Render Free puede tardar alrededor de un minuto en despertar, por lo que el primer request puede terminar en `504` aun cuando el backend acabará disponible. La experiencia debe convertir esa secuencia en una espera continua y comprensible para adultos mayores, no en una cadena de errores. La corrida de producción `29583239523` también dejó como riesgo de línea base un `500` persistente en `/api/health` a través del proxy, mientras `/live` y `/health` directos pasaron; ese fallo no se considerará un cold start aceptable ni un verde.

La autoridad visual es `design/stitch/paciente/01-inicio` a `04-fecha-y-hora`: composición de una tarea por pantalla, cabecera simple, progreso de cinco segmentos, tarjetas amplias, selección explícita y acción inferior. Los HTML solo orientan; no se copiarán. Las referencias a Lima/San Borja, fotografías, ratings, reseñas, médicos y horas de las maquetas no son datos válidos. `web-clean-skills` aporta contención, superficies claras y movimiento sutil, pero quedan descartados su header de cristal, auroras y patrón de landing porque contradicen Stitch.

## Goals / Non-Goals

**Goals:**

- Publicar tres endpoints de solo lectura con DTO por allow-list, errores estables y ninguna información de pacientes.
- Devolver siempre la ventana civil completa `[hoy Lima, hoy Lima + 28 días)` y únicamente slots `LIBRE` en los items.
- Hacer barata la llamada repetida a `asegurarHorizonte()` sin debilitar el advisory lock ni la clave natural de idempotencia.
- Implementar `/`, `/reservar/especialidad`, `/reservar/medico` y `/reservar/fecha-hora` con URL como fuente de verdad, recarga/atrás seguros y estados accesibles completos.
- Mantener una única espera coordinada, cancelable y acotada ante `502`/`503`/`504`, con reintento manual al finalizar.
- Alcanzar fidelidad visual alta en móvil y escritorio, WCAG 2.1 AA, texto significativo de 18 px, targets de 48×48 y regresión visual estable.
- Terminar sin ambigüedad al elegir el slot: no se reserva, bloquea ni promete conservarlo.

**Non-Goals:**

- Crear, confirmar, mantener o cancelar reservas; bloquear el slot al seleccionarlo.
- Solicitar DNI, teléfono u otros datos del paciente; generar códigos de reserva.
- Implementar autenticación o paneles de administrador, recepción o médico.
- Implementar “Ver mi cita”, notificaciones o perfil; solo se muestran deshabilitados como “Próximamente”.
- Añadir ratings, reseñas, fotografías de médicos o datos clínicos.
- Cambiar los 10 segundos del Route Handler, desactivar Deployment Protection de previews o introducir un bypass de producción.
- Alterar el esquema de base de datos o el pipeline salvo integrar las pruebas normales del cambio.

## Decisions

### 1. Contratos públicos mínimos y serialización por allow-list

Los endpoints responderán JSON UTF-8 mediante una capa de rutas/controladores que depende de servicios inyectables. La validación de UUID y query ocurre antes de consultar Prisma. La respuesta de error común será:

```json
{
  "error": {
    "code": "QUERY_INVALIDA",
    "message": "Revisa los datos enviados."
  }
}
```

No incluirá stack, SQL, URLs internas ni detalles de conexión. Los errores de dominio se mapearán a `400`, `404` o `422`; un fallo de almacenamiento o dependencia se mapeará a `503 SERVICIO_NO_DISPONIBLE`. El proxy conservará sus `502`/`504` controlados. No se usarán objetos Prisma directamente como DTO.

`GET /especialidades`:

```json
{
  "items": [
    { "id": "uuid", "nombre": "Medicina General" }
  ]
}
```

El servicio ordena por la posición del nombre en `ESPECIALIDADES_CANONICAS`, no por UUID ni por el orden incidental de PostgreSQL. Si no hay filas responde `200 {"items":[]}`. Duración y relaciones quedan excluidas.

`GET /especialidades/:especialidadId/medicos`:

```json
{
  "especialidad": { "id": "uuid", "nombre": "Cardiología" },
  "items": [
    { "id": "uuid", "nombre": "Dr. Carlos Rojas" }
  ]
}
```

Los médicos se ordenan por nombre con desempate por `id`. Una especialidad existente sin médicos devuelve `200` con `items: []`; UUID inválido devuelve `400`; especialidad inexistente devuelve `404`. Horas semanales, fotografía, rating y próxima cita quedan excluidos.

`GET /disponibilidad?especialidadId=<uuid>&medicoId=<uuid-opcional>`:

```json
{
  "especialidad": { "id": "uuid", "nombre": "Cardiología" },
  "zonaHoraria": "America/Lima",
  "horizonte": {
    "desde": "2026-07-17",
    "hastaExclusiva": "2026-08-14",
    "fechas": ["2026-07-17", "... exactamente 28 fechas ..."]
  },
  "items": [
    {
      "id": "uuid-del-slot",
      "fechaLima": "2026-07-17",
      "inicioUtc": "2026-07-17T14:00:00.000Z",
      "finUtc": "2026-07-17T14:30:00.000Z",
      "medico": { "id": "uuid", "nombre": "Dr. Carlos Rojas" },
      "consultorio": {
        "id": "uuid",
        "codigo": "C-102",
        "nombre": "Consultorio 102"
      }
    }
  ]
}
```

`horizonte.fechas` siempre contiene las 28 fechas civiles, incluso cuando `items` está vacío; así se satisfacen simultáneamente el horizonte completo y el contrato `200 items: []`. Los items se ordenan por `fechaLima`, `inicioUtc`, nombre de médico e `id`. Solo se seleccionan slots `LIBRE`. No aparecen duración, horas semanales, estado de slot, ratings, fotografías ni pacientes. La respuesta fija `Cache-Control: no-store`; el fetch del frontend también usa `cache: "no-store"`.

Una especialidad o médico inexistentes devuelven `404`. Un médico existente asociado a otra especialidad devuelve `422 MEDICO_NO_PERTENECE_ESPECIALIDAD`. Query ausente, UUID inválido o parámetros con multiplicidad inválida devuelven `400`. Se eligió una lista plana de slots más una lista explícita de 28 fechas, en lugar de 28 objetos anidados, porque conserva `items: []`, evita duplicar contenedores y permite al frontend agrupar sin perder días vacíos.

### 2. La consulta pública asegura primero el horizonte y después hace una lectura por rango

El servicio de aplicación de disponibilidad calcula `hoyEnLima(reloj)`, llama a `asegurarHorizonte(hoyLima)` y, al terminar, ejecuta una consulta única por el rango de `fechaLima` semiabierto y los filtros validados. El reloj se inyecta: producción usa el reloj real y los tests usan una fecha fija. No se harán 28 consultas diarias.

Aunque un `GET` provoca la reconciliación materializada, la operación es segura e idempotente: no cambia slots existentes y solo crea unidades derivadas que faltan. Esta opción mantiene el horizonte móvil sin cron de Render y evita que el seed sea la garantía permanente. El seed sigue reutilizando el mismo servicio.

### 3. Reconciliación eficiente bajo el mismo advisory lock

Dentro de la transacción y después de adquirir `pg_advisory_xact_lock`:

1. Se cargan las programaciones con especialidad.
2. Se calculan los intervalos esperados de las 28 fechas y su clave natural canónica `programacionSemanalId + inicioUtc`.
3. Se consultan, en una sola lectura acotada al rango, las claves naturales de slots ya existentes para esas programaciones.
4. Un `Set` filtra en memoria solo las claves faltantes.
5. Si el conjunto está vacío se retorna sin ejecutar ninguna sentencia `INSERT`.
6. Solo las faltantes se insertan; cada inserción conserva `ON CONFLICT (programacionSemanalId, inicioUtc) DO NOTHING` como última protección. No se usa `skipDuplicates`.

El conteo `considerados` sigue representando intervalos esperados e `insertados` escrituras efectivas. Las pruebas usarán un `PrismaClient` real configurado con eventos de query y contarán sentencias `INSERT INTO "Slot"`; el tiempo de ejecución no será la aserción principal.

El advisory lock serializa generadores concurrentes: el segundo recalcula las claves existentes después de adquirir el lock. El bloqueo de un slot conserva su actualización atómica `LIBRE → BLOQUEADO` y no necesita tomar el lock global; como la reconciliación trata cualquier estado como existencia, nunca repone ni sobrescribe un slot bloqueado o reservado. La consulta pública es una fotografía de lectura: si un slot deja de estar libre justo después, la UI lo retirará en la siguiente revalidación; seleccionarlo no lo retiene.

| Estado/ausencia previa | Operación en este cambio | Resultado | Escritura de estado |
| --- | --- | --- | --- |
| Sin slot para la clave natural | Generación | `LIBRE` | Inserta el slot faltante |
| `LIBRE` | Generación repetida/concurrente | `LIBRE` | Ninguna |
| `RESERVADO` | Generación repetida/concurrente | `RESERVADO` | Ninguna |
| `BLOQUEADO` | Generación repetida/concurrente | `BLOQUEADO` | Ninguna |
| `LIBRE` | Consulta pública o selección en UI | `LIBRE` | Ninguna |
| `RESERVADO` o `BLOQUEADO` | Consulta pública | No visible | Ninguna |
| Cualquier estado | Selección del slot | Sin transición | Ninguna; reservar pertenece al siguiente cambio |

### 4. La URL es la única fuente durable de selección

Las rutas y parámetros serán:

- `/reservar/especialidad?especialidadId=...`
- `/reservar/medico?especialidadId=...&medicoId=...`
- `/reservar/fecha-hora?especialidadId=...&medicoId=...&fechaLima=...&slotId=...`

La selección dentro de un paso usa `router.replace`; avanzar usa `router.push`. Cambiar `especialidadId` elimina `medicoId`, `fechaLima` y `slotId`; cambiar `medicoId` elimina fecha y slot; cambiar fecha elimina slot. Atrás y recarga reconstruyen el estado desde la URL y lo revalidan contra el API. No habrá un store paralelo en `localStorage` o memoria que pueda contradecirla.

Una URL sin la selección requerida redirige al primer paso incompleto mediante `replace`. Si una especialidad/médico ya no existe, se limpia ese parámetro y los dependientes, se mantiene la pantalla correspondiente y se anuncia el problema. Si el `slotId` ya no aparece entre los libres del filtro y fecha vigentes, se elimina solo `slotId` y se muestra “Ese horario ya no está disponible. Elige otro.”

### 5. Máquina de estados única para carga y cold start

Cada recurso usa un coordinador por clave semántica de request. Un `AbortController` cancela fetch y temporizadores al cambiar filtros o navegar, y un identificador de generación impide que una respuesta tardía reemplace el estado nuevo.

| Estado UI | Entrada | Presentación accesible | Salida |
| --- | --- | --- | --- |
| `loading` | Primer request | Skeleton estable y texto “Cargando opciones…” | `ready`, `empty`, `preparing`, `offline`, `invalid`, `error` |
| `preparing` | Primer `502`/`503`/`504` o timeout/red transitorio | Spinner continuo, `role="status"`, “Estamos preparando el sistema. La primera consulta puede tardar hasta un minuto.” | Nuevo intento, `ready`, `empty`, `offline`, `error` |
| `ready` | DTO válido con items | Contenido interactivo | Cambio de URL o revalidación |
| `empty` | DTO válido con `items: []` | Mensaje específico y acción Volver/Cambiar | Nueva selección o reintento |
| `offline` | Navegador sin conexión | “Parece que no tienes conexión” y reintento manual al recuperar red | `loading` |
| `invalid` | `400`/`404`/`422` o selección ya no libre | Limpia dependencias y explica qué debe elegirse otra vez | Paso corregido |
| `error` | Error no reintentable o presupuesto agotado | Mensaje final comprensible y botón “Intentar nuevamente” | Nuevo presupuesto desde `loading` |

El máximo será de siete requests. Cada uno conserva el límite upstream de 10 segundos del Route Handler; entre intentos se esperan `1, 2, 3, 4, 4 y 4` segundos. Si todos alcanzan el timeout, el peor caso nominal es `70 + 18 = 88` segundos. Un deadline monotónico limita el presupuesto global y el último intento usa solo el tiempo restante. No se muestra cada `502`/`503`/`504`: todos alimentan el mismo estado `preparing`. `400`/`404`/`422` no se reintentan. Un `500` persistente es error final, no cold start normal.

Se eligió mantener 10 segundos y coordinar en cliente, en lugar de elevar el Route Handler a unos 70 segundos, porque conserva el límite operativo ya probado, permite cancelar al navegar y ofrece progreso continuo. El mensaje de preparación permanece estable durante todo el presupuesto, evitando una sucesión de alertas.

### 6. Corte del flujo y semántica honesta

Al seleccionar un slot se actualizan `fechaLima` y `slotId` en la URL y se muestra su resumen. La acción inferior se llama “Continuar”, permanece deshabilitada (`disabled` real, no solo estilo) y tiene ayuda visible: “Este horario todavía no está reservado. Podrás continuar cuando habilitemos el siguiente paso.” No se invoca ningún endpoint de escritura.

En la home, “Sacar una cita” navega al primer paso. “Ver mi cita” y las funciones futuras del shell se muestran deshabilitadas, con texto visible “Próximamente”, sin enlaces ficticios ni rutas vacías. Todas las pantallas muestran: “Demostración académica: los profesionales y horarios mostrados son datos ficticios.”

### 7. Sistema visual subordinado a Stitch

- Atkinson Hyperlegible se versiona como WOFF2 local y se carga con `next/font/local`; no depende de Google Fonts durante build o runtime.
- Los tokens de `design/stitch/DESIGN.md` gobiernan color, superficies, radio y espaciado. Todo texto significativo, incluidas etiquetas, estado y navegación, usa al menos 18 px.
- Los controles tienen 48×48 como mínimo y las acciones principales 64 px. Foco visible de al menos 2 px y contraste AA; selección no depende solo del color e incluye icono/texto.
- Las especialidades usan icono Lucide y pastel por nombre canónico con fallback neutral. Nombre, médico, consultorio y slots siempre proceden del API. Los médicos usan avatar de iniciales, nunca fotografía sintética.
- La home usa una ilustración original local creada con `imagegen` durante apply, con descripción explícita de Ayacucho y texto alternativo útil. No se reutilizan imágenes remotas de Stitch.
- En escritorio se conserva la columna de tarea centrada y se aprovecha ancho para respiración o grid de tarjetas; no se convierte en landing. En móvil se preservan márgenes de 20 px, footer seguro y ausencia de solapamiento con contenido o teclado.
- Framer Motion se limita a desplazamientos de 6–10 px y feedback de selección; se evitó animar opacidad para conservar contraste AA durante toda la transición. `MotionConfig reducedMotion="user"` envuelve el flujo y `useReducedMotion()` omite el estado inicial desplazado. No hay movimiento esencial ni transiciones largas.

### 8. Pruebas funcionales, visuales y de accesibilidad

- Vitest AAA cubre validación/serialización y la lógica nueva del dominio. `vitest --coverage` debe reportar al menos 80% de líneas en `src/domain/**`.
- Supertest levanta la app real con un reloj inyectado y PostgreSQL real para los tres endpoints, orden, rangos, filtros, privacidad, `no-store`, `400`/`404`/`422`, vacío y `503` controlado.
- La optimización se prueba contra PostgreSQL real con eventos de query: horizonte caliente produce cero `INSERT`; horizonte parcial produce exactamente las escrituras faltantes; `RESERVADO`/`BLOQUEADO` se cuentan como existentes; `Promise.all` conserva convergencia.
- El flujo feliz, atrás, recarga, limpieza de dependencias y selección de slot usa backend Express y PostgreSQL reales con seed y reloj fijos. Los fixtures de red se reservan para vacío, offline, `502`/`503`/`504`, agotamiento y recuperación.
- axe-core recorre las cuatro rutas y los estados loading, preparing, empty, offline, invalid y error; Playwright verifica teclado, orden de foco y foco visible.
- Las capturas cubren móvil y escritorio para las cuatro pantallas, preparación y selección. Se fija Chromium del lockfile, locale `es-PE`, `timezoneId: America/Lima`, viewport, reloj, color scheme y fuente local. La prueba visual usa `reducedMotion: "reduce"`, que ejercita una ruta real de producción, espera `document.fonts.ready` y contenido estable, oculta caret y desactiva animaciones residuales. Otra prueba con `reducedMotion: "no-preference"` verifica que las transiciones terminan en el mismo layout; así la estabilización no sustituye lo que ve producción. El umbral de píxeles será pequeño y documentado, no una máscara amplia.

## Implementation Evidence — 2026-07-17

- Backend: `npx vitest run --coverage` con PostgreSQL 16 real pasó 25 archivos y 68 pruebas, incluidas Supertest, reconciliación concurrente, horizonte caliente/parcial, estados existentes y seed repetido. Cobertura de líneas en `src/domain/**`: **97.79%** (umbral: 80%).
- Frontend unitario: `npm test` pasó 5 archivos y 11 pruebas Vitest AAA. `vitest.config.ts` separa explícitamente `frontend/tests/**` de los E2E Playwright.
- Flujo real: `booking-flow.real-backend.spec.ts` pasó con Express, PostgreSQL, seed y reloj fijos; verificó avanzar, recargar, volver, URL durable y ausencia de `POST`/`PUT`/`PATCH`/`DELETE`.
- Playwright integral: 36/36 pruebas pasaron en 40.7 s, incluidos URL/historial, revalidación de slot, fixtures de red, proxy, smoke del artefacto local, accesibilidad y screenshots.
- Accesibilidad: el gate focalizado pasó 6/6 con axe-core en cuatro pantallas y ambos viewports, estados `loading`, `preparing`, `empty`, `offline`, `invalid` y `error`, teclado, foco visible, texto ≥18 px, targets ≥48×48 y fixture negativo.
- Visual: quedaron versionados 18 baselines portables (sin sufijo de plataforma) para las cuatro pantallas, móvil/escritorio, preparación y selección. `booking-motion.spec.ts` pasó cinco repeticiones consecutivas y espera el estado final observable, no un retardo arbitrario. Las ocho capturas de pantallas fueron inspeccionadas con `view_image` después de generarse.
- Assets: Atkinson Hyperlegible se carga desde WOFF2 local y la ilustración editorial de profesionales/paciente en Ayacucho fue generada con `imagegen`, almacenada localmente e inspeccionada; el contrato rechaza URLs remotas.
- Builds: `npm run build` pasó en backend y frontend; las imágenes Docker reales de API y web se construyeron desde cero.
- Docker Compose limpio: se recrearon contenedores, red y volumen; se aplicaron las dos migraciones, y el seed canónico desde el checkout produjo `256/256` slots la primera vez y `0/256` la segunda para `[2026-07-17, 2026-08-14)`. `/`, `/live`, `/health` y `/api/health` respondieron 200; el API público devolvió 6 especialidades y 28 fechas para Cardiología.
- Gates de repositorio: `actionlint` pasó sin hallazgos, `git diff --check` pasó y `openspec validate --all --strict` validó 8/8 ítems.
- Stack dejado disponible para revisión: frontend `http://localhost:3000`, API `http://localhost:4001`, health `http://localhost:4001/health` y proxy `http://localhost:3000/api/health`.

## Production Evidence — 2026-07-17

- PR funcional fusionado: `#19`, squash SHA `17468409aa517c00c2f44ec06c39ae0d742610e8`.
- Corrida de `main`: `https://github.com/josefloat/proyecto_ssd/actions/runs/29594994868`, conclusión `success` para ese mismo SHA.
- `build-and-test`: `success` (`job/87933112080`).
- `migrate`: `success` (`job/87933572598`), incluyendo `prisma migrate deploy` y `prisma db seed` antes de los despliegues.
- `deploy-render`: `success` (`job/87933631904`).
- `deploy-vercel`: `success` (`job/87933631898`).
- `runtime-smoke`: `success` (`job/87934004756`).

## Risks / Trade-offs

- [El primer GET puede materializar una base vacía y superar un intento de 10 s] → El seed prepara el horizonte, la reconciliación caliente evita INSERT y el coordinador mantiene una espera continua hasta 88 s.
- [El proxy de producción ya mostró `500` persistente en la corrida `29583239523`] → Antes de considerar desplegado el change se debe reproducir y corregir la causa exacta; no se reclasifica como `502`/`503`/`504`, no se reintenta producción a ciegas y el pipeline debe volver a quedar verde.
- [Un slot libre puede cambiar después de la lectura] → La selección no se presenta como reserva, no cambia estado y se revalida; un slot ausente se limpia con mensaje explícito.
- [La lista plana exige agrupación de fechas en frontend] → `horizonte.fechas` es autoritativa y una función pura construye los grupos, incluidos los días vacíos.
- [Los snapshots pueden variar por fuente, navegador o animación] → Fuente local, entorno congelado, contenedor de CI, reduced-motion real y espera explícita; se evita basar la aserción en tiempos arbitrarios.
- [Los nombres del seed podrían interpretarse como profesionales reales] → Aviso académico persistente, ausencia de fotografías/ratings y lenguaje de demostración; no se presenta información clínica ni promesas de atención real.
- [La validación local no sustituye el despliegue de producción] → La corrida `29594994868` validó el SHA fusionado mediante build, migración/seed, ambos despliegues y runtime smoke antes de archivar el change.

## Migration Plan

1. Implementar y verificar primero la reconciliación del horizonte y sus pruebas de escritura/concurrencia.
2. Añadir servicios, rutas y DTO públicos con Supertest/PostgreSQL real.
3. Incorporar dependencias, fuente e ilustración locales; construir las cuatro pantallas sobre los contratos reales.
4. Añadir estados de red, navegación URL, accesibilidad, E2E y baselines visuales.
5. Ejecutar suite focalizada por tarea, suite completa, cobertura, build, Docker Compose y validación OpenSpec antes del despliegue normal.
6. El despliegue usa el pipeline existente. Si falla cualquier gate, no se promueve ni se corrige producción a ciegas.

No hay migración de datos ni de esquema. El rollback consiste en revertir frontend y rutas/servicios aditivos; los slots materializados conservan el mismo esquema y clave natural. Un rollback nunca elimina ni modifica slots existentes.

## Open Questions

Ninguna. Los contratos, la política de reintento, la persistencia en URL, el corte tras seleccionar slot y la presentación de funciones futuras quedaron decididos antes de esta propuesta.
