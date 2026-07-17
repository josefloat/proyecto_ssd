## Context

El backend ya materializa slots en PostgreSQL, publica únicamente los `LIBRE` y usa actualizaciones condicionales para impedir transiciones inválidas. El frontend conserva especialidad, médico, fecha y slot en la URL, pero `FLOW-4` termina honestamente sin escritura. Este cambio añade el ciclo público de la cita sobre ese límite sin contraseñas ni datos de terceros.

Las pantallas vinculantes son Stitch 05–08. Sus datos de Lima/San Borja, fotografías, correo, mapa, pase de ingreso y descarga son demostrativos o están fuera de alcance; se conserva su jerarquía, progreso, formularios, código, detalle y acción de cancelación usando datos reales de Ayacucho. La operación debe funcionar para adultos mayores, con texto significativo de 18 px, targets de 48 × 48 px, foco visible, teclado y anuncios accesibles.

## Goals / Non-Goals

**Goals:**

- Crear o reutilizar un paciente mediante DNI y teléfono sin sobrescrituras silenciosas.
- Confirmar exactamente una cita por slot mediante una transacción atómica, idempotencia estricta y códigos legibles resistentes a enumeración casual.
- Consultar y cancelar solo mediante el par DNI + código, sin revelar coincidencias parciales.
- Liberar el slot una sola vez ante cancelación, expiración o carreras entre ambas.
- Completar las pantallas 05–08 y activar “Ver mi cita” con el presupuesto de pruebas acordado.

**Non-Goals:**

- Autenticación o UI del personal, pagos, reembolsos, recepción, pase de ingreso, correo, WhatsApp, mapas e historia clínica.
- Reprogramación, recuperación/cambio de teléfono o modificación de estados posteriores a `RESERVADA`.
- Un cron, cola, cache o servicio externo nuevo.
- Copiar el HTML de Stitch o sus datos ficticios al código de producción.

## Decisions

### 1. Modelo persistente conserva historia y refuerza invariantes

Se añadirán `Paciente`, `Cita`, `EstadoCita` y `MotivoCancelacion`:

- `Paciente`: UUID, `dni` único, `telefono` no único y `nombre`; los tres valores se normalizan antes de comparar o guardar.
- `Cita`: UUID, FK a paciente, FK a slot, `codigoReserva` único, `estado`, `motivoCancelacion` nullable, `reservadaEn`, `venceEn`, `canceladaEn` nullable, `idempotencyKey` único e `idempotencyFingerprint`.
- El código usa `SV-` y ocho caracteres del alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ`; la entrada se normaliza a mayúsculas.
- `venceEn` se fija al crear como `min(reservadaEn + 72 horas, slot.inicioUtc)`; el slot debe iniciar estrictamente después de `reservadaEn` y todos los instantes se guardan en UTC.
- `slotId` no será único en toda la tabla porque un slot cancelado o expirado puede reservarse de nuevo y la cita histórica debe conservarse. Una migración SQL añadirá un índice único parcial para impedir más de una cita activa (`RESERVADA` o `PAGADA`) por slot.
- Checks de base de datos exigirán DNI de ocho dígitos, teléfono de nueve dígitos, coherencia entre estado/motivo/fecha de cancelación y `venceEn > reservadaEn AND venceEn <= reservadaEn + interval '72 hours'`.

Se prefiere conservar citas canceladas frente a borrarlas porque permite distinguir cancelación del paciente y expiración, probar carreras y mantener trazabilidad. No se introduce `EXPIRADA`: el estado canónico sigue siendo `CANCELADA` con motivo `EXPIRACION`.

### 2. Identidad del paciente no permite apropiación por coincidencia parcial

El primer uso de un DNI válido crea el paciente con nombre y teléfono. Un uso posterior del mismo DNI solo continúa si el teléfono normalizado coincide; ni el nombre ni el teléfono se actualizan en este flujo. Teléfonos compartidos entre distintos DNI están permitidos.

La reserva resolverá el DNI dentro de su transacción con inserción tolerante únicamente al conflicto de `Paciente.dni`, seguida de una lectura y comparación. Se descarta un `upsert` que actualice datos porque permitiría reemplazar el teléfono sin un mecanismo de recuperación autorizado.

### 3. Contratos HTTP mantienen credenciales fuera de URL y logs comunes

- `POST /citas` recibe `slotId`, DNI, teléfono y nombre; exige `Idempotency-Key` UUID en header y devuelve `201` con la cita, el código y el vencimiento. Un replay válido reproduce el mismo status y cuerpo funcional.
- `POST /citas/consulta` recibe DNI y código en el cuerpo y devuelve el detalle permitido.
- `POST /citas/cancelacion` recibe DNI y código en el cuerpo y devuelve el detalle cancelado.

Los identificadores del paciente no van en query ni path. Entradas malformadas reciben `400 QUERY_INVALIDA`; DNI/teléfono incompatibles al reservar reciben `409 DATOS_PACIENTE_NO_COINCIDEN`; un par DNI+código bien formado que no identifica una cita recibe el único `404 CITA_NO_ENCONTRADA`. La respuesta nunca incluye teléfono, IDs internos de paciente, SQL ni stack.

### 4. Reserva idempotente y atómica

El `idempotencyFingerprint` es un hash de la representación canónica de `slotId`, DNI, teléfono y nombre. Cada intento:

1. abre una transacción y toma un advisory lock transaccional derivado de `Idempotency-Key`;
2. busca una cita con esa clave antes de escribir paciente o slot;
3. si existe y el fingerprint coincide, devuelve exactamente la misma cita y código; si difiere, responde `409 IDEMPOTENCIA_EN_CONFLICTO` sin writes;
4. lee el slot y exige `estado = 'LIBRE' AND inicioUtc > ahora`; si no cumple, responde `409 SLOT_NO_DISPONIBLE` antes de crear paciente;
5. calcula dentro de la transacción `venceEn = min(ahora + 72 horas, slot.inicioUtc)`;
6. resuelve o valida el paciente;
7. ejecuta `UPDATE Slot ... WHERE id = ? AND estado = 'LIBRE' AND inicioUtc > ahora`;
8. solo si actualiza una fila, inserta la cita `RESERVADA` y confirma la transacción.

Solicitudes con claves distintas sobre el mismo slot futuro compiten en el update condicional: una confirma y las demás reciben `409 SLOT_NO_DISPONIBLE`. Un slot pasado o que inicia exactamente en `ahora` recibe el mismo `409` sin paciente, cita ni cambio de slot. El advisory lock evita que dos replays de la misma clave atraviesen simultáneamente el chequeo inicial.

El código se genera criptográficamente antes de insertar. Si PostgreSQL reporta exclusivamente la unicidad de `Cita.codigoReserva`, se revierte el intento completo y el servicio reintenta toda la transacción con otro código hasta un límite pequeño; paciente, cita y slot no quedan parciales. Cualquier otra constraint se propaga como fallo controlado y nunca se trata como colisión inocua. Se descarta consultar el código antes de insertar porque una carrera seguiría siendo posible.

### 5. Cancelación y expiración usan el mismo orden de locks

Cancelación y expiración bloquean primero la fila `Cita` y luego actualizan su `Slot`, siempre en ese orden. La cancelación requiere credenciales correctas, estado `RESERVADA` y reloj anterior a `slot.inicioUtc`. Un reintento sobre `CANCELADA/PACIENTE` es idempotente; cualquier otro estado o una cita ya iniciada recibe conflicto y no toca el slot.

`aplicarExpiraciones(ahora)` selecciona citas `RESERVADA` con `venceEn <= ahora`, bloquea sus filas y cambia cada una a `CANCELADA/EXPIRACION` mientras libera su slot `RESERVADO` en la misma transacción. Se invoca antes de disponibilidad pública, reserva, consulta y cancelación. Así el plazo llega hasta 72 horas pero nunca supera `slot.inicioUtc`; una base ociosa se materializa al siguiente acceso antes de exponer estado o disponibilidad.

Si cancelación y expiración compiten, el lock de cita serializa la decisión: solo la primera transición desde `RESERVADA` gana, la segunda observa el resultado y no vuelve a liberar. La actualización del slot exige `RESERVADO`; un estado inesperado revierte la transacción completa.

### 6. Estrategia de concurrencia de todas las operaciones sobre slots

| Operación | Transacción y bloqueo | Predicado/constraint | Resultado ante carrera |
| --- | --- | --- | --- |
| Generar horizonte | Transacción con advisory lock global existente | Clave natural de slot + `ON CONFLICT` exacto | Converge sin alterar slots existentes |
| Consultar disponibilidad | Aplica expiraciones y luego lee snapshot con un único `ahora` | `estado = LIBRE` e `inicioUtc > ahora` | Nunca publica pacientes ni slots iniciados |
| Bloquear | Update condicional existente | `LIBRE → BLOQUEADO` | Solo una transición gana |
| Reservar | Advisory lock por idempotencia + lectura y update condicional | `LIBRE → RESERVADO`, `inicioUtc > ahora`; índice parcial de cita activa | Una clave gana; replay idéntico converge; frontera no futura no escribe |
| Cancelar | Row lock de cita, luego update condicional del slot | `RESERVADO → LIBRE` | Una liberación; reintento propio idempotente |
| Expirar | Row lock de cita, luego update condicional del slot | `venceEn <= ahora` y `RESERVADO → LIBRE` | Se serializa con cancelar/reservar |

### 7. Transiciones de estado

| Entidad | Estado origen | Operación | Estado destino | Resultado |
| --- | --- | --- | --- | --- |
| Slot | `LIBRE` | reservar | `RESERVADO` | Cita `RESERVADA` creada en la misma transacción |
| Slot | `RESERVADO` | cancelar cita | `LIBRE` | Cita pasa a `CANCELADA/PACIENTE` |
| Slot | `RESERVADO` | expirar cita | `LIBRE` | Cita pasa a `CANCELADA/EXPIRACION` |
| Cita | inexistente | confirmar slot futuro | `RESERVADA` | `venceEn = min(reservadaEn + 72h, slot.inicioUtc)` |
| Cita | `RESERVADA` | cancelar antes del inicio | `CANCELADA` | Motivo `PACIENTE`, acción idempotente |
| Cita | `RESERVADA` | alcanzar vencimiento sin pago | `CANCELADA` | Motivo `EXPIRACION` |
| Cita | `PAGADA`, `ATENDIDA`, `NO_ASISTIO` | cancelar/expirar | sin cambio | Conflicto o exclusión; slot intacto |
| Cita | `CANCELADA` | repetir cancelación | sin cambio | Idempotente solo si el motivo ya es `PACIENTE` |

### 8. Flujo frontend y privacidad local

La selección continúa a `/reservar/datos` conservando los parámetros ya revalidados. Confirmar envía el POST una sola vez por clave de idempotencia persistida durante el intento y muestra `/reservar/confirmacion` con el resultado en estado de sesión de la pestaña, sin DNI, teléfono ni código en la URL. Una recarga sin ese estado vuelve a datos con un aviso accesible, no intenta crear otra cita automáticamente.

“Ver mi cita” abre `/mi-cita`; el formulario reproduce Stitch 07 y el detalle Stitch 08. El resultado se conserva solo durante la sesión de la pestaña. Cancelar exige un diálogo accesible dentro de la pantalla de detalle, no una pantalla nueva. Tras cancelar, el detalle muestra el estado y retira la acción destructiva. La UI omite correo, descarga, pase, mapa y datos de San Borja por estar fuera de alcance.

### 9. Pruebas mínimas sin duplicación entre capas

- Cuatro suites Supertest contra PostgreSQL real cubren los ocho escenarios de `citas-paciente-api`; las variantes de formato, estado o credenciales equivalentes se ejecutan parametrizadas.
- `booking-completion.spec.ts` es el primer flujo Playwright integral: slot → datos → confirmación → código. El error de submit se prueba en una función/estado frontend con Vitest, no con otro E2E.
- `appointment-selfservice.spec.ts` es el segundo y último flujo Playwright integral: home → DNI+código → detalle → confirmación de cancelación.
- `patient-selfservice-accessibility.spec.ts` es el único barrido axe y recorre pantallas 05–08 en estados ready y error, junto con teclado, foco, targets y anuncios.
- `patient-selfservice-visual.spec.ts` conserva exactamente cuatro baselines para todo el change: datos y detalle, cada uno en móvil y escritorio. No duplica reglas de dominio.
- Cada escenario nombra una sola prueba primaria y cada tarea enumera los escenarios que cierra.

## Risks / Trade-offs

- **[Expiración materializada al acceder]** La fila puede permanecer físicamente `RESERVADA` durante inactividad total → toda operación pública relevante aplica expiraciones antes de decidir y las pruebas congelan el reloj para verificar el corte lógico.
- **[Reloj avanza durante la operación]** Disponibilidad y reserva podrían discrepar si toman instantes distintos → cada decisión captura un único `ahora`; la reserva repite `inicioUtc > ahora` en el update condicional dentro de la transacción.
- **[Código transcribible sigue siendo un secreto corto]** DNI + código aporta dos datos, pero no sustituye autenticación fuerte → alfabeto de casi 40 bits, comparación conjunta, mensajes genéricos y credenciales fuera de URL; rate limiting queda como endurecimiento futuro.
- **[Índice parcial no expresable completamente en Prisma]** Un `db push` no recrearía la constraint → la migración SQL versionada y una prueba de integración validan el índice real.
- **[Reintento tras colisión]** Un retry demasiado amplio podría ocultar otros errores → se reconoce por nombre exacto de constraint y se limita el número de intentos.
- **[Estado de confirmación en la pestaña]** Recargar puede perder la pantalla de éxito → se ofrece recuperación mediante “Ver mi cita”; no se exponen credenciales en URL ni se repite la reserva.

## Migration Plan

1. Añadir enums, tablas, checks, índices y FKs mediante una migración Prisma con SQL explícito para el índice parcial.
2. Desplegar backend con rutas y servicios; los modelos nuevos no cambian filas de slots existentes.
3. Desplegar frontend y activar las nuevas acciones solo cuando el backend correspondiente esté disponible en el mismo release.
4. Ejecutar integración, los dos flujos Playwright, el barrido axe y los cuatro baselines antes del deploy.

Rollback: revertir primero el frontend para desactivar las acciones y luego el backend. Las tablas nuevas pueden conservarse sin afectar disponibilidad; no se eliminan datos de citas en un rollback operativo.

## Open Questions

Ninguna. Los cinco defaults y la precisión de idempotencia fueron aprobados para este change.
