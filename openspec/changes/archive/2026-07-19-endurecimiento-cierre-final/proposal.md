## Why

El proyecto necesita un cierre verificable que reduzca los riesgos operativos restantes, elimine la advertencia de retirada de Node.js 20 en GitHub Actions y deje evidencia reproducible de seguridad, despliegue y operación. Además, el ADMIN necesita eliminar de forma segura cuentas sin historia y las agendas de MÉDICO/RECEPCIÓN deben permitir consultar realmente hoy y los seis días siguientes, sin destruir trazabilidad clínica ni ampliar funciones de escritura.

## What Changes

- Auditar secretos, archivos rastreados, logs, sesiones, autorización por rol y respuestas de error, reutilizando las pruebas existentes y sin exponer valores sensibles.
- Actualizar las acciones oficiales de GitHub al runtime vigente, declarar permisos mínimos y sanitizar logs de proveedores, manteniendo Node.js 22 para la aplicación y el gate productivo exclusivo de `main`.
- Verificar migración y seed idempotentes, regresión esencial en serie, despliegue del SHA exacto, los cinco jobs productivos y smokes finales de todos los roles y endpoints críticos.
- Verificar una subida real desde ADMIN → Imágenes y que la home usa la URL de Cloudinary persistida; un nuevo `403` detiene el cierre.
- Añadir “Eliminar cuenta” al panel ADMIN con confirmación irreversible, borrado físico solo sin historia, revocación transaccional de sesiones y rechazo `409 CUENTA_CON_HISTORIAL` en cualquier cuenta vinculada a operación.
- Ampliar las agendas de MÉDICO y RECEPCIÓN a la ventana civil Lima `[hoy, hoy + 7 días)`, agrupada cronológicamente por fecha y con días vacíos visibles; MÉDICO conserva aislamiento por `medicoId` y solo lectura, RECEPCIÓN conserva filtros combinables sobre toda la ventana.
- Crear un runbook breve con arranque Docker, `BACKEND_URL`, rutas por rol, variables, despliegue, recuperación segura y limitaciones conocidas, más la matriz final requisito → escenario → prueba/evidencia.
- Fuera de alcance: rediseño, nuevas funciones clínicas o del paciente, pagos, reportes, upgrades masivos, nuevas baselines visuales, borrado automático de cuentas de producción y modificación de permisos externos de Cloudinary.

## Capabilities

### New Capabilities

- `cierre-operativo`: auditoría de seguridad y secretos, regresión/despliegue final, verificación productiva de Cloudinary, documentación operativa y evidencia de entrega.

### Modified Capabilities

- `administracion-personal`: incorpora eliminación segura de cuentas sin historia desde el panel ADMIN.
- `agenda-medico`: amplía la agenda propia de solo lectura a hoy y los seis días siguientes en fecha civil Lima.
- `agenda-recepcion`: amplía la agenda global filtrable a la misma ventana móvil de siete días.
- `deployment-pipeline`: endurece permisos, runtime de acciones y tratamiento de logs sin alterar el gate de despliegue.

## Impact

- Backend Express/Prisma: endpoint administrativo de eliminación, comprobación transaccional de referencias, revocación de sesiones y consultas de agenda por rango `fechaLima` semiabierto.
- Frontend Next.js: acción visible de eliminación, confirmación/conflicto y agendas agrupadas por los siete días civiles Lima.
- GitHub Actions: versiones de acciones, permisos y salida sanitizada; Render/Vercel/Neon continúan con el flujo actual.
- Documentación y OpenSpec: runbook y evidencia final trazable.
- Producción: una subida real autorizada a Cloudinary y smokes mínimos identificables; no se elimina automáticamente `juanamedina@gamil.com`, que ya está inactiva.
