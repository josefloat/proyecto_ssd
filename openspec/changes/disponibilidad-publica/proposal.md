## Why

El motor ya materializa disponibilidad, pero el paciente todavía no puede consultar catálogos ni recorrer las pantallas aprobadas para elegir un horario. Este cambio expone una lectura pública mínima y construye una experiencia accesible, resistente al cold start y fiel a Stitch, sin adelantar la reserva ni recopilar datos personales.

## What Changes

- Exponer `GET /especialidades`, `GET /especialidades/:especialidadId/medicos` y `GET /disponibilidad` con DTO mínimos, errores controlados y disponibilidad siempre `no-store`.
- Optimizar `asegurarHorizonte()` para consultar las claves naturales existentes bajo el advisory lock, omitir completamente el `INSERT` cuando el horizonte está caliente e insertar solo slots faltantes sin alterar estados existentes.
- Sustituir la home placeholder por la home real del paciente y añadir las rutas de selección de especialidad, médico, fecha y hora aprobadas en Stitch.
- Mantener especialidad, médico, fecha y slot en la URL; revalidar la selección al recargar o volver y limpiar dependencias cuando cambia una selección superior.
- Implementar una espera coordinada cancelable ante cold start: requests de 10 segundos, errores intermedios agrupados en un único estado accesible de preparación y presupuesto total aproximado de 88 segundos antes del reintento manual.
- Terminar el flujo al seleccionar un slot: `Continuar` queda deshabilitado y explica que el horario aún no está reservado; acciones futuras aparecen deshabilitadas con “Próximamente”.
- Aplicar Atkinson Hyperlegible local, texto significativo de al menos 18 px, objetivos táctiles de 48×48, foco visible, `prefers-reduced-motion`, responsive móvil/escritorio, aviso de datos ficticios e ilustración original local.
- Añadir pruebas de contrato con Supertest/PostgreSQL real, unidad con Vitest AAA, flujo E2E con Playwright, axe-core y regresión visual determinista en móvil y escritorio.
- Mantener fuera de alcance la creación o confirmación de reservas, datos del paciente, códigos, bloqueo al seleccionar, consulta/cancelación de citas, autenticación y paneles.

## Capabilities

### New Capabilities

- `disponibilidad-publica-api`: contratos públicos de especialidades, médicos y horizonte completo de disponibilidad, incluidos validación, errores, privacidad y caché.
- `flujo-disponibilidad-paciente`: navegación y estado del flujo especialidad → médico → fecha/hora, recuperación ante cold start, corte seguro tras elegir slot, fidelidad visual, responsive y accesibilidad.

### Modified Capabilities

- `home-page`: reemplaza la home placeholder por la entrada real del paciente y representa las funciones futuras como acciones deshabilitadas.
- `slots-materializados`: hace observable que un horizonte caliente no ejecuta escrituras, repone únicamente claves faltantes y conserva slots reservados o bloqueados aun con generaciones repetidas o concurrentes.

## Impact

- Backend Express, servicio `MotorDisponibilidad`, consultas Prisma y pruebas Vitest/Supertest contra PostgreSQL real.
- Frontend Next.js App Router, Route Handler same-origin existente, estado derivado de URL, Tailwind, iconos, Framer Motion, fuente e ilustración locales.
- Playwright y axe-core se amplían con fixtures de red deterministas, snapshots visuales y ejecución congelada por navegador, viewport, reloj, fuente, zona horaria y movimiento reducido.
- No se modifica el modelo de reserva, no se introducen datos clínicos ni de pacientes y no se cambia infraestructura o despliegue salvo integrar las pruebas normales del cambio.
