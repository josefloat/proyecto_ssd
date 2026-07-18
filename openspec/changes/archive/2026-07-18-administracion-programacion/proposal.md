## Why

El administrador ya puede autenticarse, pero todavía no puede crear las cuentas operativas ni mantener la programación que alimenta la disponibilidad pública. Este cambio completa esa operación con credenciales rotables, vínculo obligatorio `Usuario–Medico` y programación con vigencia explícita, sin poner en riesgo citas o bloqueos materializados.

## What Changes

- Habilitar un panel ADMIN con datos reales y acceso a la gestión de personal y programación, basado en Stitch `personal/06`–`08`.
- Permitir que solo un ADMIN cree y administre cuentas MEDICO y RECEPCIONISTA; la creación MEDICO persiste atómicamente `Usuario`, `Medico`, especialidad y horas semanales.
- Incorporar contraseña temporal generada por el servidor, entrega visible una sola vez, cambio obligatorio y reinicio administrativo con revocación de sesiones.
- Administrar activación/inactivación sin borrado físico ni cambios implícitos en citas, slots o programación; rol y especialidad clínica quedan inmutables cuando existe actividad materializada.
- Guardar por médico una revisión semanal completa, inmutable y con `vigenteDesde` explícito —por defecto el próximo lunes de Lima—, respetando día ISO, turno canónico, consultorio y horas semanales.
- Proteger el guardado mediante control optimista de versión y locks transaccionales, rechazando ediciones obsoletas o colisiones con `409` sin escrituras parciales.
- Reconciliar el horizonte desde la nueva vigencia: reemplazar solo slots futuros `LIBRE`, preservar `RESERVADO`/`BLOQUEADO` y omitir intervalos que colisionen con ellos.
- Mantener trazabilidad requisito → escenario → prueba esencial con dos flujos Playwright como máximo, un único barrido axe y hasta cuatro baselines.

Fuera de alcance: funciones de paciente o recepción, creación manual de citas, pagos en línea, historia clínica, reportes, búsquedas globales, métricas o alertas ficticias, fotografías/DNI del personal, correos de invitación, recuperación autónoma de contraseña, API de WhatsApp, edición del catálogo de especialidades/turnos/consultorios y refinamiento visual final.

## Capabilities

### New Capabilities

- `administracion-personal`: panel administrativo real, creación atómica de médicos/recepcionistas, vínculo `Usuario–Medico`, gestión de estado y superficies accesibles de administración.

### Modified Capabilities

- `autenticacion-personal`: añade contraseña temporal de un solo uso, cambio obligatorio/reinicio administrativo y revocación de sesiones asociada a cambios de seguridad.
- `programacion-semanal`: sustituye la asignación aislada por revisiones semanales completas con vigencia, validación atómica y concurrencia optimista.
- `slots-materializados`: define la reconciliación por cambio de programación y la preservación de slots `RESERVADO`/`BLOQUEADO`.

## Impact

- Migración Prisma/PostgreSQL para identidad visible del usuario, rotación de credenciales y versionado/vigencia de programación, preservando las restricciones actuales.
- Nuevos servicios y rutas `/personal/admin/**`, reutilizando sesiones, cookies y `requireSesion([ADMIN])` de 4A.
- Ajustes al login para cambio obligatorio y destino ADMIN, más las rutas Next.js de dashboard, usuarios y programación.
- Extensión del motor de disponibilidad para reconciliación transaccional; no cambia el contrato público de reserva ni los roles de recepción/médico.
- Sin dependencias externas nuevas ni secretos adicionales.
