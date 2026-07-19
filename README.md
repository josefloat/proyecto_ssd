# Señal de Vida — guía operativa

Sistema de reserva de citas de la clínica Señal de Vida, Ayacucho. El entorno soportado usa Docker Compose; no requiere Node.js ni PostgreSQL instalados en el host.

## Arranque local

```bash
docker compose up --build
```

- Web: `http://localhost:3000`
- API directa: `http://localhost:4001`
- PostgreSQL: `localhost:5432`
- Liveness: `http://localhost:4001/live`
- Readiness: `http://localhost:4001/health`
- Readiness por proxy: `http://localhost:3000/api/health`

El contenedor web recibe `BACKEND_URL=http://api:4000`. Es una variable exclusiva del servidor: nunca debe llamarse `NEXT_PUBLIC_BACKEND_URL` ni quedar incluida en el bundle del navegador.

Para detener el entorno:

```bash
docker compose down
```

Los datos locales permanecen en el volumen `db_data`. `docker compose down -v` los elimina y solo debe usarse deliberadamente en un entorno de prueba.

## Rutas de acceso

- Paciente: `/`, `/reservar/especialidad` y `/mi-cita` (sin contraseña).
- Personal: `/personal/login`.
- ADMIN: `/personal/admin`, `/personal/admin/usuarios`, `/personal/admin/programacion`, `/personal/admin/imagenes`.
- RECEPCIÓN: `/personal/recepcion/agenda`.
- MÉDICO: `/personal/medico/agenda`.

Las agendas de MÉDICO y RECEPCIÓN muestran hoy Lima y los seis días siguientes. MÉDICO solo ve sus citas y no tiene acciones de escritura; RECEPCIÓN ve la agenda global y puede combinar filtros por especialidad, médico y estado.

## Variables requeridas

Solo se documentan nombres. Los valores viven en GitHub Actions, Render o Vercel y nunca en git, capturas o tickets.

- Base de datos/migración: `DATABASE_URL`, `DIRECT_URL`.
- Administrador inicial: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
- Render: `RENDER_API_KEY`, `RENDER_SERVICE_ID`.
- Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `VERCEL_PRODUCTION_DOMAIN`, `BACKEND_URL`.
- Cloudinary en Vercel: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

No copies un archivo `.env` de producción. [`backend/.env.example`](backend/.env.example) contiene únicamente credenciales locales del contenedor.

## Despliegue y recuperación

- Una rama o PR ejecuta únicamente `build-and-test`.
- Solo un merge a `main` habilita, en orden, `migrate`, `deploy-render`, `deploy-vercel` y `runtime-smoke`.
- El change OpenSpec no se archiva hasta que los cinco jobs correspondan al mismo SHA y estén verdes.

La contraseña temporal debe guardarse una sola vez y cambiarse en el primer acceso. Un ADMIN puede reiniciarla desde Usuarios; el reinicio revoca sesiones y obliga a cambiarla. Cambiar `SEED_ADMIN_PASSWORD` no modifica una cuenta ya sembrada porque el seed es idempotente.

Desactivar una cuenta revoca su acceso y conserva su historia. “Eliminar cuenta” solo funciona para RECEPCIONISTA sin referencias o MÉDICO sin revisiones, programación, slots ni citas; ante `CUENTA_CON_HISTORIAL`, debe desactivarse. Nunca se borran citas o programación para hacer eliminable una cuenta.

## Verificación

```bash
openspec validate --all --strict
cd backend && npm run build && npx vitest run
cd ../frontend && npm run lint && npm run build && npx playwright test --workers=1
```

La matriz de entrega se mantiene en [docs/FINAL_EVIDENCE.md](docs/FINAL_EVIDENCE.md). Las capturas auténticas se guardan fuera del repositorio para evitar incorporar reportes, credenciales o datos de prueba al historial.

## Limitaciones conocidas

- No hay pagos en línea, historia clínica, teleconsulta ni aplicación móvil.
- WhatsApp se abre mediante `wa.me`; no existe integración con su API.
- Cloudinary requiere permiso real de creación; un `403` bloquea el cierre.
- Render/Neon pueden tener cold start; los smokes aplican ventanas acotadas de reintento.
