## Context

4A dejó `Usuario`, `Sesion`, cookies opacas y autorización por rol operativas. El modelo vigente relaciona `Usuario.medicoId` de forma opcional/única con `Medico`, mientras `ProgramacionSemanal` es una fila mutable sin versión ni vigencia y `Slot` conserva una FK restrictiva hacia esa fila. `MotorDisponibilidad.asegurarHorizonte()` usa un advisory lock global, materializa 28 fechas e inserta solo claves faltantes; no elimina ni reescribe estados existentes.

Las pantallas vinculantes son Stitch `personal/06-admin-dashboard`, `07-admin-usuarios` y `08-admin-programacion-semanal`, corregidas por OpenSpec: turnos 09–13, 15–19 y 19–23; sin fotografías, DNI, citas manuales, reportes, búsquedas globales ni métricas ficticias. La programación administrativa debe coexistir con los médicos/programaciones baseline del seed sin que despliegues posteriores sobrescriban cambios del ADMIN.

## Goals / Non-Goals

**Goals:**

- Crear y administrar cuentas MEDICO/RECEPCIONISTA desde una superficie exclusiva de ADMIN, manteniendo atómico el vínculo `Usuario–Medico`.
- Permitir rotación segura de la credencial inicial y reinicios posteriores sin almacenar ni registrar contraseñas en claro.
- Versionar por médico planes semanales completos con vigencia civil de Lima y control de concurrencia.
- Reconciliar disponibilidad futura sin cancelar citas ni perder bloqueos.
- Entregar una UI responsive, WCAG 2.1 AA y basada únicamente en datos reales.
- Cumplir el presupuesto de 7 requisitos, 14 escenarios, hasta 10 tareas, 2 flujos Playwright, 1 barrido axe y 3 baselines.

**Non-Goals:**

- Modificar paciente, recepción, historia clínica, pagos, reportes, notificaciones, catálogos canónicos o la semántica de citas.
- Enviar credenciales por email/WhatsApp, recuperar contraseñas sin ADMIN o conservar contraseñas temporales recuperables.
- Borrar personal, cambiar roles, editar especialidades con actividad histórica o hacer que desactivar una cuenta altere la agenda.
- Implementar las métricas, alertas, fotografías, DNI y acciones ilustrativas de Stitch.
- Realizar el refinamiento visual final.

## Decisions

### D1. Separar cuenta, perfil médico y credencial sin duplicar reglas

`Usuario` seguirá siendo la autoridad de autenticación y añadirá `nombre` opcional para identidad administrativa y `debeCambiarPassword`. `Medico` seguirá siendo la autoridad clínica para nombre profesional, especialidad y horas. Crear un MEDICO ejecutará una sola transacción que valida el payload una vez, crea ambos registros y fija `Usuario.medicoId`; RECEPCIONISTA crea solo `Usuario`. La restricción PostgreSQL existente seguirá exigiendo `medicoId` únicamente para rol MEDICO.

Los médicos baseline que ya existen sin cuenta seguirán siendo válidos porque la relación inversa es opcional; el flujo de este change crea un perfil nuevo junto con su cuenta y no fabrica credenciales para registros históricos. El seed cambiará a create-if-absent para sus fixtures estables: nunca actualizará perfiles ni revisiones que un ADMIN ya administró.

Alternativas descartadas: crear cuentas en el seed (no satisface la operación ADMIN), una entidad genérica `Personal` nueva (amplía innecesariamente el modelo) y duplicar especialidad/horas en `Usuario` (dos autoridades para la misma regla).

### D2. Contraseña temporal generada en servidor y sesión limitada

Creación y reinicio usarán `randomBytes`/base64url con entropía criptográfica, `hashPassword()` de 4A y una respuesta `Cache-Control: no-store` que contiene el valor solo una vez. Ningún logger, error, fixture visual o DTO persistido incluirá la contraseña. La UI la mostrará en un diálogo no persistente con acción explícita de copiar; cerrar o recargar la perderá.

`POST /personal/sesion` conservará su contrato de error genérico y añadirá `debeCambiarPassword` al éxito. Si la marca está activa, `requireSesion` permitirá únicamente `POST /personal/password`; todas las demás rutas privadas responderán `403 CAMBIO_PASSWORD_REQUERIDO`. Un cambio exitoso reemplaza el hash, limpia la marca, revoca todas las sesiones y elimina la cookie para exigir login nuevo. Reinicio, activación e inactivación también revocan todas las sesiones dentro de la transacción.

La migración marcará a los ADMIN ya existentes para cambio obligatorio sin alterar `passwordHash`; rotar `SEED_ADMIN_PASSWORD` continuará sin sobrescribir una cuenta sembrada.

Alternativas descartadas: contraseña elegida por ADMIN (la expone más tiempo), enviar por correo (infraestructura fuera de alcance) y mantener la sesión después del cambio (deja tokens previos válidos).

### D3. Ciclo de vida de cuenta desacoplado de disponibilidad

No habrá `DELETE`. Rol siempre será inmutable. Especialidad solo podrá cambiar mientras el médico no tenga programación, slot ni cita; las horas podrán cambiar si todas las revisiones actuales o futuras aplicables caben en el nuevo máximo. Las revisiones históricas ya vencidas no bloquearán una reducción.

`activo` controla acceso, no disponibilidad clínica. Inactivar revoca sesiones, pero no toca `Medico`, programación, slots ni citas. La UI advertirá que retirar disponibilidad requiere guardar una nueva programación o bloquear slots concretos.

| Estado de cuenta | Operación | Estado resultante | Efectos adicionales |
| --- | --- | --- | --- |
| ACTIVA | Inactivar | INACTIVA | Revoca todas las sesiones; agenda intacta |
| INACTIVA | Reactivar | ACTIVA | Revoca sesiones residuales; exige login nuevo |
| ACTIVA/INACTIVA | Reiniciar clave | Mismo estado | Nuevo hash temporal, `debeCambiarPassword=true`, sesiones revocadas |
| Cualquiera | Cambiar rol o borrar | Sin cambio | Rechazo controlado y cero escrituras |

Alternativa descartada: ocultar automáticamente slots al inactivar, porque mezcla seguridad de acceso con agenda y podría afectar reservas sin una decisión explícita de programación.

### D4. Revisión inmutable por médico y selección temporal determinista

Se añadirá `RevisionProgramacion` con `medicoId`, `numero`, `vigenteDesde`, `creadaEn` y relación a sus filas `ProgramacionSemanal`. La pareja `(medicoId, numero)` será única y un índice único técnico `(id, medicoId)` respaldará la FK compuesta. `ProgramacionSemanal.medicoId` se conservará durante este change para que el backend anterior siga leyendo durante la ventana migración→deploy, pero una FK `(revisionId, medicoId) → RevisionProgramacion(id, medicoId)` obligará a que ambos valores coincidan; el servicio nuevo resolverá al médico desde la revisión y ningún write podrá divergir. Cada POST contiene `versionBase`, `vigenteDesde` e `items`; `items: []` es un plan completo vacío, mientras omitir `items` es inválido. Guardar siempre inserta una revisión y filas nuevas; nunca modifica contenido anterior.

Para una fecha, la revisión aplicable será la de mayor `(vigenteDesde, numero)` con `vigenteDesde <= fecha`. Esto permite corregir una revisión futura creando otra versión para la misma fecha, conserva historia y garantiza una selección única sin mutar la anterior. La UI propone el próximo lunes de Lima, pero acepta otra fecha posterior a hoy.

La migración creará una revisión 1 por cada médico con programación existente, `vigenteDesde = 1970-01-01`, y enlazará sus filas antes de exigir `revisionId` y la FK compuesta. Los `Slot` conservarán su FK a cada fila histórica. Las unicidades de médico/consultorio dejan de ser globales entre revisiones históricas; el plan aplicable las valida en servicio, mientras cada revisión mantiene unicidad interna de día/turno. Eliminar el `medicoId` redundante queda fuera de este change y solo podrá hacerse en una migración contract posterior, una vez que ningún binario anterior dependa de él.

Alternativas descartadas: actualizar filas actuales (rompe historia referenciada por slots) y una revisión global de toda la clínica (provoca conflictos optimistas entre médicos independientes y contradice la edición por especialista de Stitch).

### D5. Guardado completo, versión optimista y orden único de locks

`GET /personal/admin/programacion/:medicoId` devolverá plan aplicable/pending y `version`. `POST` guardará el agregado completo. La transacción adquirirá locks siempre en este orden:

1. advisory lock global ya usado por el horizonte;
2. fila `Medico` objetivo `FOR UPDATE`;
3. filas `Consultorio` afectadas ordenadas por UUID;
4. lectura y comparación de `versionBase`;
5. validación de PROG-1/PROG-2 en todos los intervalos temporales afectados;
6. inserción de revisión/filas y reconciliación de slots.

Para validar consultorios entre revisiones con fechas distintas, el servicio recogerá los puntos de vigencia presentes/futuros, resolverá el plan aplicable de cada médico en cada tramo y comprobará la matriz semanal. La última matriz se valida como recurrente indefinida. Una versión obsoleta, colisión u horas excedidas devuelve `409`; cualquier error revierte todo. El lock global serializa la mutación de slots y evita deadlocks con `asegurarHorizonte`; planes independientes pueden confirmar en solicitudes concurrentes aunque su sección crítica sea serializada.

Alternativas descartadas: guardado celda a celda (permite semanas parciales) y solo restricciones optimistas de Prisma (no protegen el límite de horas ni vigencias cruzadas).

### D6. Reconciliar solo libres y tratar no-libres como ocupación

Dentro de la misma transacción de guardado se tomarán las fechas del horizonte actual desde `vigenteDesde`. Para el médico objetivo se calcularán los intervalos esperados con la revisión aplicable por fecha.

| Slot encontrado | ¿Se elimina/actualiza? | Efecto en la nueva revisión |
| --- | --- | --- |
| `LIBRE` obsoleto del médico | Se elimina | Puede reemplazarse por un intervalo esperado |
| `LIBRE` aún esperado con la misma clave | Se conserva | No se reescribe |
| `RESERVADO` | Se conserva íntegro | Todo solapamiento por médico o consultorio se omite |
| `BLOQUEADO` | Se conserva íntegro | Todo solapamiento por médico o consultorio se omite |
| Intervalo esperado sin solapamiento | Se inserta `LIBRE` | Usa la fila de la revisión aplicable |

La comparación de solapamiento será `inicioA < finB && inicioB < finA`, no igualdad de horas, para soportar duraciones distintas. `asegurarHorizonte()` seguirá siendo insertion-only conforme a SLOT-6, pero elegirá la revisión aplicable por cada fecha nueva. Así, el borrado de obsoletos ocurre solo al guardar la revisión y un horizonte caliente conserva cero escrituras.

Alternativas descartadas: cancelar/reasignar reservas, desbloquear slots o rechazar toda reprogramación ante un único no-libre; las tres opciones impiden cambios seguros o alteran decisiones operativas previas.

### D7. Rutas y UI acotadas a las referencias aprobadas

El backend agrupará listados, creación, patch, reinicio y programación bajo `/personal/admin/**` con `requireSesion([ADMIN])`. El frontend añadirá `/personal/admin`, `/personal/admin/usuarios` y `/personal/admin/programacion`; el estado de cambio obligatorio reutilizará el shell de login en lugar de inventar una pantalla visual independiente.

El dashboard conservará shell/navegación de Stitch 06, pero solo mostrará conteos reales y dos accesos. Usuarios seguirá tabla + panel lateral de Stitch 07, sustituyendo foto/DNI/departamento por campos del modelo. Programación conservará selector y matriz de Stitch 08 con días ISO y turnos canónicos; omitirá métricas y acciones rápidas ilustrativas.

Solo habrá dos flujos E2E: creación/gestión de personal y programación/reconciliación. Un archivo axe recorrerá los estados esenciales de las tres rutas y un archivo visual tendrá tres baselines desktop. Autorización, dominio, concurrencia y estados persistidos se prueban en integración, no se duplican en Playwright.

## Risks / Trade-offs

- [La entrega única de contraseña puede perderse] → Mensaje explícito de irreversibilidad y acción ADMIN de reinicio; nunca se intenta recuperarla.
- [El advisory lock global reduce paralelismo de guardado] → La operación administrativa es infrecuente y prioriza integridad; lecturas siguen concurrentes.
- [Las revisiones históricas crecen] → Cada médico tiene como máximo 21 filas por versión; no se crean versiones por celda y se indexa `(medicoId, vigenteDesde, numero)`.
- [Cambiar duración/especialidad invalidaría interpretación histórica] → Especialidad se vuelve inmutable al existir actividad; slots históricos conservan su programación.
- [Un no-libre puede fragmentar temporalmente la nueva disponibilidad] → La API devuelve conteo de intervalos omitidos y la UI muestra advertencia sin datos de pacientes.
- [Múltiples vigencias futuras complican conflictos de consultorio] → Validación por puntos de vigencia dentro del lock global y prueba de carrera con PostgreSQL real.

## Migration Plan

1. Añadir campos de `Usuario` y tablas/relaciones de revisión de forma compatible; backfill de revisiones versión 1 y `debeCambiarPassword` para ADMIN existentes sin cambiar hashes.
2. Enlazar programaciones actuales a su revisión baseline, sustituir las unicidades globales por restricciones por revisión e índices temporales, conservando ids usados por `Slot`.
3. Adaptar el seed para crear baseline solo cuando falte y nunca sobrescribir perfiles/revisiones administradas; ejecutar migración y seed en CI contra PostgreSQL real.
4. Desplegar backend antes de exponer las rutas frontend; los jobs de `main` confirmarán migración, Render, Vercel y runtime smoke para el mismo SHA.
5. Tras producción verde, verificar home pública, rechazo sin cookie/rol, cambio obligatorio del admin y smokes administrativos sin imprimir credenciales.

Antes del primer guardado administrativo, rollback puede restaurar el binario anterior y las restricciones previas. Después de crear revisiones nuevas, el rollback será hacia adelante: deshabilitar temporalmente las rutas ADMIN, conservar datos y desplegar una corrección; no se borrarán revisiones ni slots para forzar el esquema antiguo.

## Open Questions

Ninguna. Los cinco defaults de exploración fueron aceptados por el usuario.
