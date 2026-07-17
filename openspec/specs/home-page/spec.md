# home-page Specification

## Purpose
TBD - created by syncing change `cimientos-y-despliegue`. Update Purpose after archive.
## Requirements
### Requirement: Proxy same-origin del frontend hacia el backend
El frontend SHALL exponer las rutas del backend bajo su propio origen mediante un Route Handler catch-all (`app/api/[...path]/route.ts`), de modo que el navegador nunca necesite conocer ni contactar directamente el origen del backend. La URL de destino del proxy se configura mediante una variable de entorno server-side (nunca `NEXT_PUBLIC_*`), para no hornearla en el bundle del cliente. Se usa un Route Handler en vez de `rewrites()` porque `rewrites()` con un destino externo delega el reenvío al mecanismo interno de Next.js, que ante un fallo de conexión responde con un `500` opaco sin permitir personalizar el código de estado ni el cuerpo del error — el Route Handler controla explícitamente ambos.

#### Scenario: Proxy exitoso hacia el backend
- **GIVEN** el Route Handler del frontend está configurado con la URL del backend local
- **WHEN** un cliente pide una ruta proxied (por ejemplo, `<frontend-url>/api/health`)
- **THEN** el Route Handler reenvía la petición al backend y devuelve su respuesta, sin que el navegador realice ninguna petición cross-origin

#### Scenario: Backend de destino no configurado o inexistente
- **GIVEN** la variable de entorno con la URL del backend no está configurada o apunta a un backend inexistente
- **WHEN** un cliente pide una ruta proxied
- **THEN** el frontend responde con un error controlado (`502`/`504`) en vez de colgarse indefinidamente o filtrar la URL interna del backend en el mensaje de error

### Requirement: HOME-1 Home real del paciente orienta sin prometer funciones futuras
El frontend SHALL servir en `/` la home real de Señal de Vida — Ayacucho con ilustración original local, una acción activa “Sacar una cita” hacia `/reservar/especialidad`, acciones futuras realmente deshabilitadas con “Próximamente” y el aviso visible de demostración académica.

#### Scenario: HOME-1.1 Entrada real inicia el flujo de disponibilidad
- **GIVEN** la aplicación frontend está construida y dispone de la ilustración local original
- **WHEN** un paciente abre `/` y activa “Sacar una cita”
- **THEN** recibe `200`, ve la composición aprobada de Stitch, Señal de Vida — Ayacucho, la ilustración y el aviso de datos ficticios, y navega a `/reservar/especialidad`
- **PRUEBA AUTOMATIZADA** `home-patient.spec.ts` usa Playwright para verificar status, landmarks, textos, asset local y navegación activa; `home-visual.spec.ts` compara móvil y escritorio

#### Scenario: HOME-1.2 Función futura no crea una ruta falsa
- **GIVEN** “Ver mi cita”, Mis citas, Notificaciones y Perfil todavía están fuera de alcance
- **WHEN** el paciente intenta enfocarlos o activarlos con puntero y teclado
- **THEN** aparecen deshabilitados con “Próximamente”, no cambian la URL y no ejecutan requests de dominio
- **PRUEBA AUTOMATIZADA** `home-patient.spec.ts` verifica semántica disabled/aria-disabled, copy, foco permitido solo cuando aporta explicación, URL y red sin navegación

#### Scenario: HOME-1.3 Asset remoto o copy geográfico falso se rechaza
- **GIVEN** un fixture local intenta usar una ilustración remota o introduce “Lima”, “San Borja”, ratings o reseñas en la home
- **WHEN** corren los contratos de assets y contenido
- **THEN** la suite falla y la variante no puede integrarse
- **PRUEBA AUTOMATIZADA** `ui-assets.contract.test.ts` y `ui-copy.contract.test.ts` inspeccionan imports/URLs y copias prohibidas mediante Vitest AAA
