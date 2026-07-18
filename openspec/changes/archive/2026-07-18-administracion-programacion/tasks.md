## 1. Migración y baseline versionado

- [x] 1.1 Crear la migración Prisma/PostgreSQL para `Usuario.nombre`/`debeCambiarPassword`, `RevisionProgramacion`, vínculos e índices; backfill de revisión 1 sin cambiar ids de `ProgramacionSemanal`/`Slot`, marcar ADMIN existentes para rotación y adaptar el seed a create-if-absent. Ejecutar migración desde cero y sobre fixture pre-4B. **Escenarios:** ADM-1.1, AUTH-3.1, PROG-4.1, SLOT-7.2. **Prueba primaria:** suites de migración/seed existentes ampliadas contra PostgreSQL real, sin crear otra variante E2E.

## 2. Credenciales seguras

- [x] 2.1 Implementar generación temporal no registrable, sesión limitada, `POST /personal/password` y reinicio administrativo con revocación total; ampliar únicamente `personal-sesion.integration.test.ts` con el ciclo parametrizado por rol y errores nuevos. **Escenarios:** AUTH-3.1, AUTH-3.2. **Prueba primaria:** `personal-sesion.integration.test.ts`, conservando intactas las coberturas AUTH-1/AUTH-2 de 4A.

## 3. Administración de personal

- [x] 3.1 Implementar validadores, servicio transaccional y rutas ADMIN de listado/creación/patch/reinicio para MEDICO y RECEPCIONISTA, incluyendo vínculo uno-a-uno, estados, invariantes de rol/especialidad/horas y rollback. **Escenarios:** ADM-1.1, ADM-1.2, ADM-2.1, ADM-2.2. **Prueba primaria:** un único `administracion-personal.integration.test.ts` con tablas parametrizadas y PostgreSQL real.

## 4. Programación y reconciliación

- [x] 4.1 Implementar consulta/guardado del agregado semanal por médico, selección temporal de revisión, validación por puntos de vigencia, `versionBase` y orden global→médico→consultorios de locks; reutilizar PROG-1/PROG-2 sin repetir sus pruebas de variantes. **Escenarios:** PROG-4.1, PROG-4.2, PROG-5.1, PROG-5.2. **Prueba primaria:** `administracion-programacion.integration.test.ts` con reloj inyectado, conjuntos exactos y carreras reales.
- [x] 4.2 Extender el motor para seleccionar revisión por fecha y reconciliar al guardar: eliminar solo `LIBRE` obsoletos, preservar `RESERVADO`/`BLOQUEADO`, omitir solapamientos y mantener horizonte caliente con cero escrituras. **Escenarios:** SLOT-7.1, SLOT-7.2. **Prueba primaria:** `programacion-reconciliacion.integration.test.ts` instrumentando INSERT/DELETE y preservando todas las suites SLOT-1–SLOT-6 existentes.

## 5. Superficies administrativas

- [x] 5.1 Extender cliente/tipos/shell de personal para destino ADMIN y cambio obligatorio dentro del shell de login; construir `/personal/admin` con conteos reales y únicamente los accesos autorizados de Stitch 06. **Escenarios:** AUTH-3.1, ADM-3.1, ADM-3.2. **Prueba primaria:** el flujo `personal-admin-usuarios.spec.ts` inicia con rotación obligatoria; la regla de seguridad permanece cubierta en integración.
- [x] 5.2 Construir `/personal/admin/usuarios` según Stitch 07 corregido, con tabla real, panel de alta, entrega única de temporal y acciones permitidas de ciclo de vida; omitir fotografía, DNI y roles fuera de alcance. **Escenarios:** ADM-1.1, ADM-1.2, ADM-2.1, ADM-2.2, ADM-3.1. **Prueba primaria:** primer y único flujo de personal `personal-admin-usuarios.spec.ts` contra frontend, Express y PostgreSQL reales.
- [x] 5.3 Construir `/personal/admin/programacion` según Stitch 08 corregido, con médico, matriz ISO/turnos canónicos, consultorio, `vigenteDesde`, guardado completo, conflicto `409` y advertencia de slots preservados. **Escenarios:** PROG-4.1, PROG-4.2, PROG-5.2, SLOT-7.1, SLOT-7.2, ADM-3.1. **Prueba primaria:** segundo y último flujo `personal-admin-programacion.spec.ts` contra stack real.

## 6. Accesibilidad, visual y gate final

- [x] 6.1 Ejecutar un único `personal-admin-accessibility.spec.ts` sobre cambio de clave, dashboard, usuarios y programación en estados esencialmente distintos; generar exactamente tres baselines desktop en `personal-admin-visual.spec.ts` (dashboard, usuarios, programación), sin baseline de credenciales ni variantes equivalentes. **Escenarios:** ADM-3.1, ADM-3.2, AUTH-3.2, PROG-5.2. **Prueba primaria:** un barrido axe y tres snapshots.
- [x] 6.2 Ejecutar migración desde cero, suites existentes completas, las cuatro integraciones primarias nuevas/ampliadas, dos flujos Playwright, un axe, tres baselines, builds y cobertura ≥80% de dominio; comprobar la matriz de 7 requisitos/14 escenarios/10 tareas y `openspec validate --all --strict`. **Escenarios:** ADM-1.1–ADM-3.2, AUTH-3.1–AUTH-3.2, PROG-4.1–PROG-5.2, SLOT-7.1–SLOT-7.2. **Pruebas primarias:** solo las nombradas arriba; ninguna suite de 4A se elimina o duplica.
