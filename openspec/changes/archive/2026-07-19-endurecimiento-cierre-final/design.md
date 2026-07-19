## Context

La aplicación ya está funcional y desplegada. El cierre parte de 108 pruebas backend, 17 frontend y 49 Playwright en serie, un pipeline de cinco jobs y sesiones opacas por rol. Quedan endurecimiento acotado, evidencia operativa y dos correcciones finales: permitir que el ADMIN elimine cuentas únicamente cuando no exista historia y convertir las agendas visualmente diarias en una ventana consultable de siete días. Cloudinary ya recibió un rol con escritura y `juanamedina@gamil.com` está inactiva; ambos hechos deben verificarse sin modificar esa cuenta ni revelar credenciales.

## Goals / Non-Goals

**Goals:**

- Cerrar seguridad, pipeline, regresión, despliegue, documentación y trazabilidad con cinco requisitos y diez escenarios.
- Actualizar el runtime interno de las acciones oficiales sin cambiar Node.js 22 de la aplicación.
- Permitir borrado físico seguro de RECEPCIONISTA y MEDICO sin historia, con autorización y concurrencia explícitas.
- Consultar agendas MÉDICO/RECEPCIÓN para `[hoy Lima, hoy Lima + 7 días)` con límites y aislamiento verificables.
- Verificar una subida real de Cloudinary desde el panel y su consumo por la home.

**Non-Goals:**

- Rediseñar o añadir escritura clínica, del paciente, recepción o médico fuera de la consulta semanal confirmada.
- Borrar cuentas de producción automáticamente, incluida `juanamedina@gamil.com`.
- Borrar o alterar citas, slots, programación, revisiones o evidencia para hacer eliminable una cuenta.
- Cambiar permisos externos, hacer upgrades masivos o añadir E2E/baselines visuales.

## Decisions

### D1 — Borrado conservador, transaccional y sin cascadas clínicas

`DELETE /personal/admin/usuarios/:id` reutilizará `requireSesion([ADMIN])` y pasará el id del ADMIN actual al servicio. La transacción bloqueará primero el `Usuario` objetivo con `FOR UPDATE`; rechazará el propio usuario y todo rol ADMIN. Para MEDICO bloqueará también su fila `Medico`, comprobará cualquier `RevisionProgramacion`, `ProgramacionSemanal`, `Slot` o `Cita`, y solo si todas están ausentes eliminará sesiones, Usuario y Medico en ese orden. RECEPCIONISTA eliminará sesiones y Usuario. Las FKs clínicas seguirán restrictivas.

La programación administrativa existente también bloquea `Medico`, de modo que una creación concurrente de programación y el borrado se serializan sobre la misma fila. El motor de slots solo materializa programación existente: si hay una programación, la comprobación rechaza el borrado; si el borrado ganó el lock, ya no existe médico sobre el cual crearla. No se introduce transición de estado para slots ni citas.

| Objetivo | Condición | Resultado |
| --- | --- | --- |
| ADMIN actual o cualquier ADMIN | Siempre | `409 MUTACION_NO_PERMITIDA`, sin escritura |
| RECEPCIONISTA | Sin referencias operativas | sesiones y Usuario eliminados en una transacción |
| MEDICO | Sin revisión, programación, slots ni citas | sesiones, Usuario y Medico eliminados en una transacción |
| MEDICO | Cualquier historia o carrera concurrente que la cree | `409 CUENTA_CON_HISTORIAL`, rollback total; desactivación sigue disponible |

Alternativa descartada: soft delete universal. La desactivación ya existe y preserva cuentas con historia; imponerla también a cuentas vacías no cumpliría la eliminación solicitada. También se descartan cascadas porque destruirían evidencia clínica.

### D2 — Confirmación UI sin ampliar E2E

Usuarios mostrará “Eliminar cuenta” solo para MEDICO/RECEPCIONISTA. Un diálogo accesible identificará la cuenta, advertirá que es irreversible y exigirá confirmación explícita. `204` retirará la fila; `409 CUENTA_CON_HISTORIAL` conservará la fila y recomendará “Desactivar”. La autorización ya cubierta no se duplica. Una única prueba de integración parametrizada cubrirá borrado permitido de ambos roles y rechazo/rollback por historia; no se añade Playwright ni baseline.

### D3 — Actions vigentes, permisos mínimos y logs por lista blanca

Se actualizarán `actions/checkout` y `actions/setup-node` de v4 a v7, conservando `node-version: 22`. El workflow declarará `permissions: contents: read` y `setup-node` deshabilitará explícitamente el caché automático. Las respuestas de Render/Vercel no se imprimirán completas: solo status, ids, estados y SHA necesarios extraídos con `jq`; el detalle remoto se mostrará únicamente como mensaje sanitizado ante fallo. Se fijará una versión estable de Vercel CLI en lugar de `@latest` si la versión compatible queda confirmada durante apply.

Alternativa descartada: migrar la aplicación a Node.js 24 o actualizar dependencias en bloque. La advertencia corresponde al runtime de las acciones y no justifica ampliar el riesgo.

### D4 — Una ventana civil Lima compartida, calculada en backend

Ambos endpoints calcularán con el reloj del backend `hoyLima` y `finExclusivo = hoyLima + 7 días civiles`, y consultarán `Slot.fechaLima >= hoyLima AND Slot.fechaLima < finExclusivo`. No aceptarán una fecha elegida por el frontend ni derivarán el día desde timestamps UTC. MÉDICO añadirá siempre `programacion.medicoId = usuario.medicoId`; RECEPCIÓN aplicará especialidad, médico y estado sobre el mismo rango completo. Los DTO conservarán `fechaLima` e `inicioUtc`, y el frontend construirá exactamente siete grupos ordenados a partir de las fechas civiles recibidas/esperadas, mostrando “Sin citas” cuando un grupo esté vacío.

Alternativa descartada: siete llamadas diarias o sumar milisegundos en el navegador. Multiplica requests y puede mezclar UTC con fecha civil Lima. Una consulta por rango conserva filtros, orden y límites en una sola regla de backend.

### D5 — Evidencia primero, pruebas nuevas solo para el borrado

La matriz final reutilizará pruebas de sesiones, roles, errores públicos, seed, migración, agenda, reserva y pipeline. Playwright conservará `fullyParallel: false` y `workers: 1`. La verificación productiva será posterior al merge y al verde de `build-and-test`, `migrate`, `deploy-render`, `deploy-vercel` y `runtime-smoke`; registrará SHA, códigos de estado y resultados, nunca cookies, passwords, claves, cuerpos con datos personales ni URLs firmadas.

La subida Cloudinary se hará desde ADMIN → Imágenes con un asset final o identificable, se persistirá como `hero-home` y se comprobará en la home. Un `403` detiene el cierre y se diagnostica sin archivar. La cuenta inactiva de Juana solo se observa; no se borra.

Las pruebas de agenda existentes se amplían con mañana, día +6, día +7 excluido, cita de otro médico y filtros globales. Los Playwright existentes solo se reutilizan para capturas funcionales; no se crean nuevos E2E ni baselines.

### D6 — Runbook único y recuperación honesta

Un README operativo en la raíz sustituirá instrucciones genéricas: Docker Compose, puertos y `BACKEND_URL`, rutas por rol, nombres de variables sin valores, gate de despliegue, cambio/reinicio de contraseña, desactivación frente a borrado y limitaciones. La evidencia final enlazará requisito, escenario, prueba existente o smoke y resultado.

## Risks / Trade-offs

- [Risk] Una FK o carrera no contemplada intenta aparecer durante el borrado → Mitigation: locks compartidos con programación, comprobación dentro de la transacción, FKs restrictivas y traducción del conflicto a `409` con rollback.
- [Risk] El rol externo de Cloudinary sigue sin autorizar `create` pese a la configuración → Mitigation: subida real obligatoria; detener y diagnosticar ante `403`, sin archivar.
- [Risk] Los smokes productivos escriben datos → Mitigation: operaciones mínimas e identificables; conservar solo el asset final intencional y limpiar/desactivar cualquier fixture creado.
- [Risk] Sanitizar demasiado dificulta diagnóstico → Mitigation: conservar HTTP status, id de operación, estado y SHA; excluir payloads completos y secretos.
- [Trade-off] No hay E2E nuevo para el botón → La integración parametrizada prueba la regla crítica y la revisión/smoke del panel confirma el cableado sin aumentar la suite estable.

## Migration Plan

1. Implementar en rama y ejecutar OpenSpec strict, backend/frontend y Playwright en serie; la rama solo corre `build-and-test`.
2. Fusionar con squash únicamente con CI verde.
3. Esperar los cinco jobs de `main` para el mismo SHA; detenerse ante cualquier fallo.
4. Ejecutar smokes productivos no destructivos y la subida Cloudinary real; si hay `403`, no archivar.
5. Completar runbook/evidencia, sincronizar y archivar solo tras producción verde; fusionar el PR documental y volver a validar strict/list vacío.

Rollback: revertir el commit funcional mediante un nuevo PR. Las FKs restrictivas impiden pérdida clínica; una cuenta ya eliminada sin historia se recrea desde ADMIN con nueva credencial temporal, nunca restaurando contraseñas antiguas.

## Open Questions

Ninguna. Los bloqueos externos y defaults técnicos fueron confirmados.
