## 1. Eliminación segura de cuentas

- [x] 1.1 Implementar eliminación transaccional, error `CUENTA_CON_HISTORIAL` y una única prueba de integración parametrizada para ambos roles, cuentas protegidas, historia/concurrencia y rollback; verificar ADM-2.1 y ADM-2.2 con PostgreSQL real y cobertura de dominio ≥80%.
- [x] 1.2 Incorporar “Eliminar cuenta”, confirmación irreversible accesible, retiro tras `204` y recomendación de desactivar ante `409`, sin E2E ni baseline nuevos; verificar ADM-2.1 y ADM-2.2 mediante build, contratos frontend existentes y smoke posterior.
- [x] 1.3 Ampliar servicios/rutas y pruebas existentes de agenda a `[hoy Lima, hoy + 7)` con mañana, +6, +7 excluido, aislamiento MEDICO y filtros RECEPCIÓN; verificar MEDICO-1.1/1.2 y RECEP-1.1/1.2 contra PostgreSQL real.
- [x] 1.4 Adaptar componentes existentes a siete grupos civiles Lima ordenados con fecha/hora y “Sin citas”, conservando solo lectura/filtros y sin E2E/baselines nuevos; verificar MEDICO-1.1/1.2 y RECEP-1.1/1.2 con tests frontend existentes y capturas funcionales.

## 2. Pipeline y seguridad esencial

- [x] 2.1 Actualizar checkout/setup-node a v7, conservar Node.js 22, declarar `permissions: contents: read`, desactivar caché automático y fijar la CLI estable compatible sin alterar el gate rama/main; verificar PIPE-1.1 y PIPE-1.2 extendiendo los contratos existentes del workflow.
- [x] 2.2 Sanitizar logs de proveedores, reutilizar fixtures negativos y auditar árbol/historial, variables, snapshots, reportes, cookies, proxy, roles y errores; verificar PIPE-1.1, PIPE-1.2, CIERRE-1.1 y CIERRE-1.2 sin otra suite nueva.

## 3. Operación, evidencia y entrega

- [x] 3.1 Crear el runbook raíz y la matriz requisito → escenario → prueba/smoke → resultado/SHA con Docker Compose, `BACKEND_URL`, rutas por rol, variables, despliegue, recuperación y limitaciones; verificar CIERRE-1.1 y CIERRE-1.2 mediante contratos documentales y OpenSpec strict.
- [ ] 3.2 Ejecutar backend/frontend y Playwright en serie, guardar evidencias externas, abrir el PR y esperar CI; después de una autorización posterior de merge, exigir los cinco jobs de `main`, realizar smokes productivos y Cloudinary, completar evidencia y solo entonces sincronizar/archivar; verificar CIERRE-1.1 y CIERRE-1.2. Esta tarea permanece abierta al detenerse antes del merge.
