## ADDED Requirements

### Requirement: Home placeholder carga y cumple una línea base de accesibilidad
El frontend SHALL servir una página de inicio placeholder en la ruta raíz (`/`) que renderiza sin errores en tiempo de ejecución y cumple una línea base de accesibilidad automatizada. Esta página es un placeholder de infraestructura, no la UI final del flujo de reserva representado por `design/base-ui-ux-reservas.png`, que se implementará en un cambio posterior. Este requisito es el dueño único del escaneo de accesibilidad de la home: la verificación en un entorno desplegado (en `pipeline-de-despliegue`) reutiliza este mismo criterio de cero violaciones, no define uno adicional.

#### Scenario: Carga de la home
- **GIVEN** el frontend corre localmente (Docker Compose o `next dev`)
- **WHEN** un visitante solicita la ruta raíz (`/`)
- **THEN** la página responde `200`, incluye un encabezado principal (`h1`) y al menos un landmark semántico, y un escaneo automatizado con axe-core no reporta violaciones

#### Scenario: Regresión de accesibilidad detectada antes de integrar
- **GIVEN** la home tiene una violación de accesibilidad (por ejemplo, contraste insuficiente o ausencia de landmark)
- **WHEN** el escaneo axe-core corre como parte de la suite de pruebas
- **THEN** la prueba automatizada falla, evitando que la regresión llegue a integrarse

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
