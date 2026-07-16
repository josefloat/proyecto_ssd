## ADDED Requirements

### Requirement: `/live` — liveness sin dependencia de la base de datos
El backend SHALL exponer `GET /live`, que responde de inmediato sin verificar la base de datos. Este endpoint existe para usarse como Health Check Path de un proveedor de hosting (configurado en `pipeline-de-despliegue`), de modo que un Postgres dormido (scale-to-zero) nunca se confunda con un proceso caído.

#### Scenario: Proceso vivo responde sin tocar la base de datos
- **GIVEN** el proceso del backend está corriendo
- **WHEN** un cliente hace `GET /live`
- **THEN** responde `200` de inmediato, sin intentar ninguna conexión a la base de datos

#### Scenario: Base de datos inalcanzable no afecta la respuesta de /live
- **GIVEN** la base de datos configurada en `DATABASE_URL` es inalcanzable o está despertando de scale-to-zero
- **WHEN** un cliente hace `GET /live`
- **THEN** sigue respondiendo `200` igual, porque `/live` no depende de la base de datos bajo ninguna circunstancia

### Requirement: `/health` — readiness con verificación real de la base de datos
El backend SHALL exponer `GET /health`, que verifica conectividad real a PostgreSQL (`SELECT 1` vía Prisma, usando la URL pooled de runtime) y reporta el estado combinado del servicio y la base de datos. Este endpoint nunca se usa como Health Check Path de un proveedor de hosting; se usa para smoke tests y verificación de disponibilidad (en `pipeline-de-despliegue`).

#### Scenario: Backend y base de datos alcanzables
- **GIVEN** el backend está corriendo y la base de datos (URL pooled) es alcanzable
- **WHEN** un cliente hace `GET /health`
- **THEN** el backend responde `200` con un cuerpo que indica `status: "ok"` y `db: "ok"`

#### Scenario: Base de datos inalcanzable
- **GIVEN** el backend está corriendo pero la base de datos (URL pooled) no es alcanzable (credenciales inválidas o red caída)
- **WHEN** un cliente hace `GET /health`
- **THEN** el backend responde con un código de error (`503`) indicando que el chequeo de base de datos falló, sin exponer credenciales, cadenas de conexión ni stack traces en el cuerpo de la respuesta
