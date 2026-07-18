## Context

Hasta Sprint 3 el backend (`backend/src/`) no tiene ningún modelo de usuario, credencial o sesión, ni dependencias de hashing/JWT (`backend/package.json` solo trae `express` y `@prisma/client`). El único "acceso" existente es el del paciente, sin contraseña. El frontend habla con el backend exclusivamente a través de un Route Handler catch-all same-origin (`frontend/app/api/[...path]/route.ts`), que hoy:

- solo reenvía las cabeceras de request `content-type` e `idempotency-key`, y de response `content-type`/`cache-control`;
- **no reenvía `Cookie` (request) ni `Set-Cookie` (response)**;
- solo expone `GET` y `POST` (no `DELETE`, no `PATCH`).

Esto es relevante porque las decisiones ya confirmadas (sesión opaca en cookie `HttpOnly`) dependen de que esa cookie viaje intacta a través del proxy. Sin tocar el proxy, el login funcionaría contra el backend directo pero nunca contra el frontend desplegado.

Los cinco diseños Stitch vinculantes para este change están en `design/stitch/personal/01-login` a `05-medico-agenda` (ver `design/stitch/personal/README.md`); `06`–`08` (admin) pertenecen al change `administracion-programacion` (4B) y no se implementan aquí.

## Goals / Non-Goals

**Goals:**
- Login con contraseña para tres roles (RECEPCIONISTA, MEDICO, ADMIN) sobre un modelo `Usuario` único.
- Sesiones opacas persistidas (no JWT), revocables de inmediato por logout.
- Autorización estricta por rol en cada ruta privada, incluida la propia sesión revocada.
- Agenda diaria operativa para recepción (pago) y médico (solo lectura), fiel a Stitch `02`–`05`.
- Bootstrap idempotente y auditable del primer ADMIN, sin secretos en el repositorio.

**Non-Goals:**
- Recuperación de contraseña, "mantener sesión iniciada", refresh tokens (aparecen en la captura de login pero están explícitamente marcados como corrección obligatoria en `design/README.md`).
- Cualquier escritura desde el rol MEDICO, incluida `ATENDIDA`/`NO_ASISTIO`.
- Gestión de médicos/recepcionistas y programación semanal — eso es `administracion-programacion` (4B), que se construye sobre la autenticación de este change.
- PDF real para la constancia; es HTML imprimible con `window.print()`.

## Decisions

### D1 — Sesión opaca en PostgreSQL, no JWT
Un token aleatorio de 32 bytes (`crypto.randomBytes(32)`) se entrega en cookie `HttpOnly; Secure; SameSite=Strict`. El backend persiste solo `sha256(token)` en una tabla `Sesion` (nunca el token en claro), con `expiraEn = creadaEn + 8h` y `revocadaEn` nulo hasta logout. Cada request a una ruta privada recalcula el hash del token de la cookie, busca la sesión, y exige `revocadaEn IS NULL AND expiraEn > ahora AND usuario.activo`.

*Alternativa descartada:* JWT firmado sin estado. Se descarta porque revocar una sesión (logout, usuario desactivado) exigiría una lista de revocación de todos modos — con sesión opaca esa lista *es* la tabla, sin infraestructura adicional (no hay Redis en el proyecto).

### D2 — Modelo `Usuario` único con `rol` enum
Una sola tabla en vez de `Recepcionista`/`AdminUsuario`/`credencial-en-Medico` separados: un único punto de login, un único middleware de autorización, y `medicoId` opcional+único cubre la relación 1:1 con `Medico` solo cuando `rol = MEDICO`.

```prisma
enum RolUsuario { ADMIN RECEPCIONISTA MEDICO }

model Usuario {
  id            String      @id @default(uuid()) @db.Uuid
  email         String      @unique
  passwordHash  String
  rol           RolUsuario
  activo        Boolean     @default(true)
  medicoId      String?     @unique @db.Uuid
  medico        Medico?     @relation(fields: [medicoId], references: [id])
  sesiones      Sesion[]
}

model Sesion {
  id          String    @id @default(uuid()) @db.Uuid
  usuarioId   String    @db.Uuid
  tokenHash   String    @unique
  creadaEn    DateTime  @default(now()) @db.Timestamptz(3)
  expiraEn    DateTime  @db.Timestamptz(3)
  revocadaEn  DateTime? @db.Timestamptz(3)
  usuario     Usuario   @relation(fields: [usuarioId], references: [id])

  @@index([usuarioId])
}
```
El email se normaliza (trim + lowercase) antes de comparar o insertar, igual que ya se hace con el DNI del paciente en `domain/citas.ts`.

La migración SHALL incluir un `CHECK` que haga irrepresentable un `Usuario` con rol y `medicoId` incoherentes — el invariante no depende de que la capa de aplicación lo recuerde:

```sql
ALTER TABLE "Usuario" ADD CONSTRAINT usuario_medico_id_segun_rol CHECK (
  (rol = 'MEDICO' AND "medicoId" IS NOT NULL) OR
  (rol IN ('ADMIN', 'RECEPCIONISTA') AND "medicoId" IS NULL)
);
```

Este check queda cubierto por la prueba ya prevista para el modelo/bootstrap (`bootstrap-admin.integration.test.ts`, tarea 1.1) intentando insertar un `Usuario` MEDICO sin `medicoId` y un ADMIN con `medicoId`; no introduce un escenario ni un archivo de prueba adicional.

*Alternativa descartada:* tabla separada por rol. Se descarta por triplicar el flujo de login/autorización para un beneficio nulo a esta escala (un solo desarrollador, tres roles).

### D3 — Contraseñas con `crypto.scrypt` + `timingSafeEqual`
Sin dependencia nueva: `node:crypto` ya está disponible (se usa en `domain/citas.ts` para el fingerprint de idempotencia). `passwordHash` almacena `salt:derivedKey` (ambos hex); verificar recalcula con el mismo salt y compara con `timingSafeEqual` para evitar timing attacks. La contraseña en claro nunca se loggea ni se incluye en ningún error.

*Alternativa descartada:* `bcrypt`/`argon2`. Añadir una dependencia (con binarios nativos, en el caso de bcrypt) para tres usuarios totales en un proyecto académico de un solo desarrollador no se justifica frente al primitivo ya integrado en Node.

### D4 — Middleware de autorización y router privado separado
`backend/src/http/personal-routes.ts` se monta bajo su propio Express Router, con un middleware `requireSesion(rolesPermitidos[])` aplicado por ruta — el mismo patrón de capas que ya usa `public-routes.ts` (servicios inyectados, un único `responderErrorPublico` como error handler). El middleware:
1. Lee la cookie de sesión → 401 si falta o no hashea a una sesión existente.
2. Verifica `expiraEn`/`revocadaEn`/`usuario.activo` → 401 si cualquiera falla (mismo código, sin distinguir el motivo al cliente).
3. Verifica `rol ∈ rolesPermitidos` → 403 si no.

### D5 — Proxy same-origin: contrato exacto de la cookie de sesión
Se extiende `frontend/app/api/[...path]/route.ts` (código existente de Sprint 1, requisito `Proxy same-origin del frontend hacia el backend` en `home-page`) para transportar la sesión del personal. Contrato exacto de la cookie:

| Atributo | Valor |
|---|---|
| Nombre | `sdv_personal_session` (fijo) |
| Flags | `HttpOnly; Secure; SameSite=Strict; Path=/` |
| `Domain` | ausente (cookie de host, no de dominio) |
| Expiración | 8 horas desde la creación de la sesión |
| Logout | el backend emite `Set-Cookie` que elimina `sdv_personal_session` usando exactamente el mismo `Path=/`; una eliminación con un `Path` distinto no borra la cookie en el navegador |

Reglas del proxy:
- reenvía hacia el backend **únicamente** la cookie `sdv_personal_session` (nunca el header `Cookie` completo tal cual llega, ni cualquier otra cookie que el navegador pudiera tener para ese origen);
- propaga hacia el navegador **únicamente** el `Set-Cookie` correspondiente a `sdv_personal_session` (creación o eliminación) cuando el backend lo emite;
- **no** reenvía `Authorization`, cookies ajenas a `sdv_personal_session` ni cabeceras internas del backend (evita que un detalle de infraestructura del backend se filtre al navegador);
- exporta `DELETE` además de `GET`/`POST` (necesario para `DELETE /personal/sesion`).

Esto **sí modifica** el contrato observable de la spec `Proxy same-origin del frontend hacia el backend` (antes reenviaba únicamente `content-type`/`idempotency-key` y no tocaba cookies en absoluto) — por eso este change incluye una delta spec `MODIFIED` para `home-page` (ver `specs/home-page/spec.md`), no solo una nota de diseño.

### D6 — Transición de pago: solo `RESERVADA → PAGADA`, protegida contra doble pago concurrente
Tabla de transición para este change (el resto de `EstadoCita` ya existe en el schema desde Sprint 3 pero no tiene ninguna ruta que lo mueva todavía):

| Desde | Acción | A | Quién |
|---|---|---|---|
| `RESERVADA` | `POST /personal/recepcion/citas/:id/pago` | `PAGADA` | RECEPCIONISTA |
| `PAGADA`, `CANCELADA`, `ATENDIDA`, `NO_ASISTIO` | `POST /personal/recepcion/citas/:id/pago` | *(rechazado, 409)* | — |

La actualización usa `UPDATE "Cita" SET estado='PAGADA' WHERE id=$1 AND estado='RESERVADA'` (el mismo patrón de escritura condicional por estado que ya usa `citas-paciente-api` para cancelación/expiración) dentro de una transacción; dos requests concurrentes sobre la misma cita hacen que solo una afecte una fila — la segunda ve `rowCount = 0` y responde `409` sin reintentar. No se requiere advisory lock adicional porque no hay slot involucrado (el slot ya quedó `RESERVADO` desde Sprint 3; pagar no lo toca).

### D7 — Bootstrap del ADMIN inicial: idempotente, fuera del arranque del proceso
El bootstrap vive en el mismo paso de seed que ya es parte del gate de CI (`prisma db seed`, ver `deployment-pipeline`), no en el arranque de la app: si `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` faltan, el seed existente (catálogos/programación) igual debe completar — el bootstrap del admin se salta con una advertencia visible en el log, nunca hace fallar todo el seed. Si las variables están presentes, hace `upsert` por email normalizado: si ya existe un `Usuario` con ese email no lo sobrescribe (no resetea contraseña en cada deploy).

*Riesgo aceptado y documentado en Migration Plan:* el primer deploy sin esas dos variables en los secrets de GitHub Actions deja cero administradores utilizables.

## Risks / Trade-offs

- **[Riesgo] Cookie cross-origin en desarrollo local** (frontend `localhost:3000`, backend `localhost:PORT` fuera de Docker Compose) → **Mitigación:** en Docker Compose ambos quedan same-origin vía el proxy igual que en producción; el desarrollo fuera de compose no es un entorno soportado por `local-environment`.
- **[Riesgo] `SameSite=Strict` bloquea la cookie si alguna vez se navega a `/personal/**` desde un link externo (ej. un enlace en un correo)** → **Mitigación:** aceptable para este proyecto: el personal siempre entra escribiendo la URL o desde marcador propio, nunca desde un link de terceros.
- **[Riesgo] `scrypt` sin dependencia externa es más fácil de configurar mal que una librería dedicada** → **Mitigación:** parámetros de costo fijados en una sola función `domain/auth.ts` cubierta por pruebas unitarias parametrizadas (hash≠contraseña, verificación cruzada de salts distintos), sin exponerlos como configuración.
- **[Trade-off] Sesión opaca implica una consulta a `Sesion` en cada request privado** (vs. JWT sin estado) → aceptado: el volumen de este proyecto (tres roles, un solo despliegue) hace irrelevante ese costo frente a la ganancia de revocación inmediata.

## Migration Plan

1. Migración Prisma aditiva (`Usuario`, `Sesion`, `RolUsuario`, incluido el `CHECK` de D2) — no toca tablas existentes, sin downtime.
2. Añadir `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` como secrets de GitHub Actions **antes** de fusionar este change (intervención humana obligatoria; no se commitean; un agente no puede configurarlos ni imprimir sus valores).
3. El job de seed existente en CI (`prisma db seed`, dentro de `migrate` en `deployment-pipeline`) ejecuta el bootstrap del admin como parte del mismo paso ya gateado — sin nuevo job. El workflow YAML SHALL exponer explícitamente `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` como `env` del step que ejecuta `prisma db seed`; sin esa línea en el YAML, los secrets del repositorio existen pero nunca llegan al proceso del seed y el bootstrap se salta silenciosamente (ver BOOT-1.2).
4. Extender el Route Handler proxy (`Cookie`/`Set-Cookie`/`DELETE`) se despliega en el mismo commit que el backend que los necesita; no requiere pasos de rollout separados.
5. Rollback: revertir el commit revierte rutas y proxy; la migración de `Usuario`/`Sesion` es aditiva y no requiere down-migration para un rollback seguro (las tablas nuevas simplemente quedan sin usar).
