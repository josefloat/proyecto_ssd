## MODIFIED Requirements

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
