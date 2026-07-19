# Evidencia final de entrega

Esta matriz no contiene contraseñas, cookies, tokens, cadenas de conexión, cabeceras sensibles ni PII real. Los resultados de producción y SHA se completan únicamente después del merge autorizado a `main`.

| Requisito / escenario | Prueba o evidencia esencial | Resultado antes del merge | Resultado productivo / SHA |
| --- | --- | --- | --- |
| ADM-2.1 | `administracion-personal.integration.test.ts`; smoke UI ADMIN | Integración backend verde dentro de 109/109; frontend lint/build verde | Pendiente |
| ADM-2.2 | Misma integración parametrizada; AUTH-2.1 | Eliminación permitida y rechazo por historial verificados; rollback transaccional | Pendiente |
| MEDICO-1.1 | `agenda-medico.integration.test.ts`; captura funcional | Mañana y +6 incluidos; +7 excluido; captura de siete días guardada fuera de git | Pendiente |
| MEDICO-1.2 | Integración y `personal-medico.spec.ts` existentes | Otra identidad excluida y agenda sin rutas de escritura; Playwright verde | Pendiente |
| RECEP-1.1 | `agenda-recepcion.integration.test.ts`; captura funcional | Ventana global de siete días y captura funcional guardada fuera de git | Pendiente |
| RECEP-1.2 | Misma integración y componente existente | Filtros combinados aplicados sobre toda la ventana | Pendiente |
| PIPE-1.1 | `pipeline-seed-gate.test.ts`; API de GitHub Actions | Contratos verdes dentro de 109/109; `build-and-test` verde en PR #32 | Pendiente |
| PIPE-1.2 | Contrato del workflow y fixtures negativos existentes | `permissions: contents: read`, acciones v7, Node 22, caché desactivada y logs sanitizados | Pendiente |
| CIERRE-1.1 | Auditoría, suite completa, cinco jobs, smokes y Cloudinary | Backend 109/109 (87.33% líneas); frontend 17/17; Playwright 49 pasadas + 1 smoke preview omitido; PR #32 verde | Pendiente |
| CIERRE-1.2 | Fixtures negativos, checklist y OpenSpec strict/list | OpenSpec strict 15/15; auditoría sin secretos de alta confianza en árbol/historial | Pendiente |

## Checklist posterior al merge

1. Confirmar `build-and-test`, `migrate`, `deploy-render`, `deploy-vercel` y `runtime-smoke` verdes para el mismo SHA.
2. Verificar home, reserva/consulta/cancelación, login y redirección por rol, ADMIN, RECEPCIÓN, MÉDICO, `/live`, `/health` y `/api/health`.
3. Desde ADMIN → Imágenes, subir un asset identificable, persistirlo como `hero-home` y confirmar que la home usa esa URL. Detener ante `403`.
4. Completar esta matriz, sincronizar y archivar OpenSpec; fusionar el PR documental y confirmar strict verde y lista vacía.
