# administracion-personal Specification

## Purpose
Definir la administración segura y trazable de cuentas de médicos y recepcionistas, sus vínculos clínicos y sus superficies exclusivas para ADMIN.

## Requirements

### Requirement: ADM-1 Creación atómica de médicos y recepcionistas
Solo un `Usuario` ADMIN autenticado SHALL poder crear cuentas MEDICO y RECEPCIONISTA. La creación SHALL normalizar email y nombre, SHALL delegar la credencial temporal al contrato AUTH-3 y SHALL persistir todo en una transacción: RECEPCIONISTA crea un `Usuario` sin `medicoId`; MEDICO crea `Usuario` y `Medico` enlazados uno a uno, con especialidad existente y horas semanales enteras positivas. Ningún fallo SHALL dejar una cuenta o perfil parcial.

#### Scenario: ADM-1.1 Admin crea ambos roles con su relación correcta
- **GIVEN** un ADMIN autenticado y una especialidad existente
- **WHEN** crea una cuenta RECEPCIONISTA y después una MEDICO con nombre, email, especialidad y horas semanales válidas
- **THEN** ambas cuentas quedan activas, la primera conserva `medicoId = null`, la segunda apunta al único `Medico` creado con la especialidad y horas indicadas, y cada respuesta entrega una credencial temporal una sola vez
- **PRUEBA AUTOMATIZADA** `administracion-personal.integration.test.ts` parametriza ambos roles contra la API y PostgreSQL reales y relee `Usuario`, `Medico` y su vínculo

#### Scenario: ADM-1.2 Datos inválidos, email duplicado o actor no ADMIN no dejan parciales
- **GIVEN** variantes parametrizadas con especialidad inexistente, horas no positivas, email ya usado y sesión RECEPCIONISTA/MEDICO
- **WHEN** cada variante intenta crear una cuenta desde la ruta administrativa
- **THEN** recibe `400`, `409` o `403` según corresponda, no obtiene una credencial y los conteos de `Usuario` y `Medico` permanecen sin filas parciales
- **PRUEBA AUTOMATIZADA** `administracion-personal.integration.test.ts` cubre la tabla de variantes con una única aserción estructural de rollback y autorización

### Requirement: ADM-2 Ciclo de vida explícito sin borrado ni efectos clínicos implícitos
El ADMIN SHALL poder actualizar nombre, email, horas semanales compatibles y estado `activo`, pero SHALL no poder borrar cuentas, cambiar su rol ni cambiar la especialidad de un médico que ya tenga programación, slots o citas. Reducir horas SHALL rechazarse si queda por debajo de la carga de la programación aplicable. Desactivar o reactivar SHALL revocar todas las sesiones del usuario y SHALL afectar únicamente su acceso: no cancelará citas ni modificará programación o slots.

#### Scenario: ADM-2.1 Actualización compatible y cambio de estado conservan la agenda
- **GIVEN** un médico con cuenta activa, programación, slots y una sesión vigente
- **WHEN** el ADMIN actualiza un dato permitido, lo desactiva y posteriormente lo reactiva
- **THEN** los datos permitidos se conservan, la sesión deja de autenticar desde la desactivación, la reactivación exige un login nuevo y las citas, programaciones y slots mantienen ids y estados
- **PRUEBA AUTOMATIZADA** `administracion-personal.integration.test.ts` recorre el ciclo contra PostgreSQL real y compara sesiones y snapshots de agenda antes/después

#### Scenario: ADM-2.2 Mutaciones estructurales o reducción incompatible son rechazadas
- **GIVEN** un médico con especialidad, ocho horas programadas y actividad materializada
- **WHEN** el ADMIN intenta cambiar su rol, cambiar su especialidad, reducir sus horas por debajo de ocho o borrar su cuenta
- **THEN** todas las variantes reciben rechazo controlado sin cambiar `Usuario`, `Medico`, programación, slots ni citas
- **PRUEBA AUTOMATIZADA** `administracion-personal.integration.test.ts` parametriza las mutaciones prohibidas y compara el mismo snapshot persistido

### Requirement: ADM-3 Superficies administrativas reales, accesibles y exclusivas de ADMIN
Después del login, un ADMIN sin cambio de contraseña pendiente SHALL entrar a `/personal/admin`; el dashboard SHALL mostrar solo conteos reales de médicos activos y recepcionistas y enlaces a `/personal/admin/usuarios` y `/personal/admin/programacion`. Las tres superficies SHALL seguir la composición responsive de Stitch `personal/06`–`08`, usar texto significativo de al menos 18 px, objetivos de 48×48 px, foco visible y nombres accesibles. SHALL omitir o deshabilitar como “Próximamente” búsquedas globales, citas manuales, reportes, métricas/alertas ficticias, fotografías, DNI y cualquier acción fuera de alcance.

#### Scenario: ADM-3.1 Admin completa los dos recorridos esenciales con datos reales
- **GIVEN** un ADMIN que ya cambió su contraseña y catálogos reales disponibles
- **WHEN** recorre dashboard → usuarios para crear un médico y dashboard → programación para guardar su semana
- **THEN** navega sin datos hardcodeados, ve estados de carga/vacío/error accesibles y completa ambos flujos con los datos persistidos por la API
- **PRUEBA AUTOMATIZADA** `personal-admin-usuarios.spec.ts` y `personal-admin-programacion.spec.ts` son los únicos dos flujos Playwright nuevos y reutilizan frontend, Express y PostgreSQL reales

#### Scenario: ADM-3.2 Otros roles y contenido ilustrativo permanecen fuera
- **GIVEN** sesiones RECEPCIONISTA y MEDICO y el conjunto de copias/acciones prohibidas de las maquetas
- **WHEN** intentan abrir rutas ADMIN y se inspeccionan las tres superficies en desktop y móvil
- **THEN** las APIs responden `403`, la UI redirige a la superficie propia del rol, no expone datos administrativos y ninguna copia/acción prohibida aparece habilitada
- **PRUEBA AUTOMATIZADA** el único `personal-admin-accessibility.spec.ts` ejecuta axe y contratos parametrizados de autorización/contenido; `personal-admin-visual.spec.ts` limita los baselines a dashboard, usuarios y programación
