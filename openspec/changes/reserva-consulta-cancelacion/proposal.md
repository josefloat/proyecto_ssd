## Why

El flujo público actual termina después de elegir un slot y no permite convertirlo en una cita real. Este cambio completa el autoservicio esencial del paciente —reservar, conservar un código, consultar y cancelar— con privacidad, concurrencia segura y expiración verificable, sin introducir autenticación por contraseña ni funciones del personal.

## What Changes

- Incorporar pacientes identificados para reservar mediante DNI y teléfono, manteniendo el nombre como dato de la cita y sin permitir que una coincidencia parcial sobrescriba datos existentes.
- Reservar un slot mediante una operación atómica e idempotente que crea la cita, cambia el slot a `RESERVADO`, genera un código legible y regenera ante una colisión excepcional del código.
- Mostrar la confirmación y el código de reserva después de completar los datos de la pantalla Stitch aprobada.
- Permitir consultar exclusivamente con DNI y código, sin revelar si un DNI, código o cita existen por separado.
- Permitir que el paciente cancele una cita `RESERVADA` antes del inicio; la cita queda `CANCELADA` y el slot vuelve a `LIBRE` en la misma transacción.
- Expirar una cita `RESERVADA` exactamente 72 horas después de crearla, registrándola como `CANCELADA` por `EXPIRACION` y liberando el slot atómicamente antes de operaciones que dependan de disponibilidad o estado.
- Activar “Ver mi cita” en la home y construir las pantallas 5–8 aprobadas de Stitch con comportamiento mobile-first, accesible y sin datos ficticios incrustados.

### Fuera de alcance

- Autenticación o pantallas para recepcionista, médico o administrador.
- Registro de pagos, pagos en línea, reembolsos o cambios sobre citas `PAGADA`, `ATENDIDA` o `NO_ASISTIO`.
- Recepción, pase de ingreso, impresión o envío de comprobantes, correo, WhatsApp e historia clínica.
- Recuperación o cambio de teléfono para un DNI existente, reprogramación de citas y reservas creadas por personal.
- Nuevas pantallas distintas de las exportadas en `design/stitch/paciente/05-*` a `08-*`.

## Capabilities

### New Capabilities

- `citas-paciente-api`: Identidad mínima del paciente, reserva atómica e idempotente, código de reserva, consulta privada, cancelación y expiración con liberación segura del slot.

### Modified Capabilities

- `flujo-disponibilidad-paciente`: El flujo deja de terminar tras elegir el slot y continúa por datos, confirmación, consulta y cancelación según las pantallas 5–8 de Stitch.
- `home-page`: “Ver mi cita” deja de ser una función futura deshabilitada y abre el acceso público por DNI y código; las demás funciones futuras permanecen deshabilitadas.

## Impact

- **Base de datos:** nuevos modelos y constraints para paciente, cita, idempotencia, código único, estado y motivo de cancelación; migración PostgreSQL compatible con el modelo de slots existente.
- **Backend:** nuevos servicios transaccionales y rutas públicas de reserva, consulta y cancelación; la disponibilidad aplicará expiraciones vencidas antes de leer slots libres.
- **Frontend:** continuación de `/reservar/fecha-hora`, pantallas de datos y confirmación, y rutas públicas para buscar y ver/cancelar una cita.
- **Pruebas:** integración con Supertest y PostgreSQL para las reglas de dominio; como máximo dos recorridos Playwright integrales, un único barrido axe y hasta cuatro baselines visuales totales.
- **Dependencias:** no se requieren servicios externos ni una nueva infraestructura programada.
