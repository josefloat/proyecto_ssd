## MODIFIED Requirements

### Requirement: Migración con URL directa, aislada del runtime
El pipeline SHALL ejecutar `prisma migrate deploy` en un job de GitHub Actions usando `DIRECT_URL`, después de que el build y las pruebas estén en verde. En el mismo gate, inmediatamente después de una migración exitosa, SHALL ejecutar el seed idempotente mediante `prisma db seed`; solo si migración y seed terminan correctamente SHALL habilitar cualquier despliegue de Render o Vercel, ya que Render Free no admite pre-deploy command ni jobs one-off.

#### Scenario: DP-1.1 Migración y seed exitosos habilitan los despliegues
- **GIVEN** build y pruebas están en verde, `DIRECT_URL` es válida y el seed puede conectarse a PostgreSQL
- **WHEN** el job previo al despliegue ejecuta `prisma migrate deploy` seguido de `prisma db seed`
- **THEN** las migraciones se aplican, el seed idempotente termina correctamente y solo después quedan habilitados los jobs de Render y Vercel
- **PRUEBA AUTOMATIZADA** `pipeline-seed-gate.test.ts` valida el orden y dependencias del workflow con fixture local, mientras `seed.integration.test.ts` ejecuta el seed dos veces contra PostgreSQL real

#### Scenario: DP-1.2 URL directa inválida detiene migración, seed y despliegues
- **GIVEN** `DIRECT_URL` es inválida o Neon no es alcanzable para la conexión directa
- **WHEN** el job ejecuta `prisma migrate deploy`
- **THEN** la migración falla, `prisma db seed` no se ejecuta y los jobs de Render y Vercel quedan `skipped`
- **PRUEBA AUTOMATIZADA** el mecanismo existente `workflow_dispatch.force_invalid_direct_url` inyecta una conexión local inalcanzable sin alterar el secreto real y la verificación de jobs confirma el fallo de `migrate` y la omisión de seed y despliegues

#### Scenario: DP-1.3 Seed fallido después de migrar bloquea ambos despliegues
- **GIVEN** `prisma migrate deploy` terminó correctamente y un fixture local fuerza un código de salida no cero en `prisma db seed`
- **WHEN** el gate ejecuta el seed posterior a la migración
- **THEN** el gate falla y los jobs de Render y Vercel quedan `skipped` sin llamar a Neon, Render ni Vercel
- **PRUEBA AUTOMATIZADA** `pipeline-seed-gate.test.ts` ejecuta el fixture local de seed fallido, usa spies de despliegue y valida el DAG para confirmar que ninguno puede ejecutarse
