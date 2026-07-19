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
El ADMIN SHALL poder actualizar nombre, email, horas semanales compatibles y estado `activo`, pero SHALL no poder cambiar el rol ni cambiar la especialidad de un médico que ya tenga programación, slots o citas. Reducir horas SHALL rechazarse si queda por debajo de la carga de la programación aplicable. Desactivar o reactivar SHALL revocar todas las sesiones y afectar únicamente el acceso. El ADMIN SHALL poder eliminar una cuenta MEDICO o RECEPCIONISTA distinta de sí mismo, nunca una cuenta ADMIN: dentro de una transacción bloqueará el objetivo, eliminará sus sesiones y borrará físicamente un RECEPCIONISTA sin referencias o un MEDICO junto con `Medico` solo si no existen revisiones, programación, slots, citas ni otra historia. Cualquier historia o carrera concurrente SHALL responder `409 CUENTA_CON_HISTORIAL`, revertir todo y conservar la desactivación; ninguna cascada SHALL borrar evidencia clínica. La UI SHALL exigir confirmación irreversible y recomendar desactivar ante `409`.

#### Scenario: ADM-2.1 Actualización, estado y eliminación vacía siguen el ciclo seguro
- **GIVEN** cuentas actualizables y, por separado, un RECEPCIONISTA y un MEDICO sin historia, ambos con sesiones
- **WHEN** el ADMIN actualiza/desactiva una cuenta y confirma la eliminación irreversible de las dos cuentas vacías
- **THEN** actualizar o desactivar conserva la agenda y revoca acceso; cada eliminación responde `204`, borra sesiones/Usuario y también Medico cuando aplica, sin tocar otra información
- **PRUEBA AUTOMATIZADA** `administracion-personal.integration.test.ts` conserva el ciclo existente y añade una única tabla parametrizada para ambos roles eliminables contra PostgreSQL real

#### Scenario: ADM-2.2 Mutaciones, cuentas protegidas o con historia no pierden evidencia
- **GIVEN** variantes con el ADMIN actual, otra cuenta ADMIN y médicos con revisión, programación, slot o cita, incluida una creación concurrente de historia
- **WHEN** el ADMIN intenta una mutación estructural incompatible o eliminarlas
- **THEN** recibe rechazo controlado, `409 MUTACION_NO_PERMITIDA` o `409 CUENTA_CON_HISTORIAL`; no cambia ni borra sesiones, cuenta, médico o evidencia y la UI conserva la opción de desactivar
- **PRUEBA AUTOMATIZADA** la prueba existente de mutaciones y la misma tabla parametrizada de eliminación comparan snapshots antes/después; la autorización ajena reutiliza AUTH-2.1

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
