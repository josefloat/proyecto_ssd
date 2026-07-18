# home-page Specification

## Purpose
TBD - created by syncing change `cimientos-y-despliegue`. Update Purpose after archive.
## Requirements
### Requirement: Proxy same-origin del frontend hacia el backend
El frontend SHALL exponer las rutas del backend bajo su propio origen mediante un Route Handler catch-all (`app/api/[...path]/route.ts`), de modo que el navegador nunca necesite conocer ni contactar directamente el origen del backend. La URL de destino del proxy se configura mediante una variable de entorno server-side (nunca `NEXT_PUBLIC_*`), para no hornearla en el bundle del cliente. Se usa un Route Handler en vez de `rewrites()` porque `rewrites()` con un destino externo delega el reenvío al mecanismo interno de Next.js, que ante un fallo de conexión responde con un `500` opaco sin permitir personalizar el código de estado ni el cuerpo del error — el Route Handler controla explícitamente ambos. El proxy SHALL reenviar hacia el backend, cuando esté presente, únicamente la cookie `sdv_personal_session` (nunca el header `Cookie` completo tal cual llegó, ni ninguna otra cookie), SHALL propagar hacia el navegador únicamente el `Set-Cookie` correspondiente a esa misma cookie cuando el backend lo emita (incluida su eliminación en logout), y SHALL soportar `DELETE` además de `GET`/`POST` para que el logout atraviese el proxy igual que el resto de rutas privadas; SHALL no reenviar `Authorization`, cookies ajenas a `sdv_personal_session` ni cabeceras internas del backend.

#### Scenario: Proxy exitoso hacia el backend
- **GIVEN** el Route Handler del frontend está configurado con la URL del backend local
- **WHEN** un cliente hace `POST /api/personal/sesion` con credenciales válidas, después un `GET` a una ruta privada, y finalmente `DELETE /api/personal/sesion`
- **THEN** la respuesta del login propaga el `Set-Cookie` de `sdv_personal_session` emitido por el backend, la siguiente solicitud reenvía al backend únicamente esa cookie, y la respuesta del logout propaga la eliminación de esa misma cookie con su mismo `Path`, sin que el navegador realice ninguna petición cross-origin
- **PRUEBA AUTOMATIZADA** `frontend/e2e/proxy.spec.ts` (archivo existente, ampliado) verifica los tres pasos contra un backend real levantado por el propio test

#### Scenario: Backend de destino no configurado o inexistente
- **GIVEN** la variable de entorno con la URL del backend no está configurada o apunta a un backend inexistente
- **WHEN** un cliente pide una ruta proxied
- **THEN** el frontend responde con un error controlado (`502`/`504`) en vez de colgarse indefinidamente o filtrar la URL interna del backend en el mensaje de error
- **PRUEBA AUTOMATIZADA** `frontend/e2e/proxy.spec.ts` (casos ya existentes, sin cambios de comportamiento)

### Requirement: HOME-1 Home real del paciente orienta sin prometer funciones futuras
El frontend SHALL servir en `/` la home real de Señal de Vida — Ayacucho con ilustración original local, una acción “Sacar una cita” hacia `/reservar/especialidad`, una acción “Ver mi cita” hacia `/mi-cita`, las demás funciones futuras realmente deshabilitadas con “Próximamente” y el aviso visible de demostración académica; SHALL evitar Lima, San Borja, ratings, reseñas y assets remotos.

#### Scenario: HOME-1.1 Las dos entradas activas abren servicios reales
- **GIVEN** la home construida con el backend disponible
- **WHEN** el paciente activa “Sacar una cita” y, en otro recorrido, “Ver mi cita”
- **THEN** la primera acción navega a `/reservar/especialidad`, la segunda a `/mi-cita`, ambas tienen nombre y foco accesibles y ninguna promete una función inexistente
- **PRUEBA AUTOMATIZADA** `home-patient.spec.ts` amplía la prueba Playwright existente para verificar ambas navegaciones sin recorrer nuevamente sus flujos integrales

#### Scenario: HOME-1.2 Funciones futuras o contenido prohibido permanecen fuera
- **GIVEN** variantes parametrizadas que intentan activar Mis citas persistentes, Notificaciones o Perfil, o introducir assets remotos, Lima, San Borja, ratings o reseñas
- **WHEN** corren los contratos de home y se inspeccionan sus controles
- **THEN** las funciones futuras permanecen `disabled`/`aria-disabled` con “Próximamente”, no navegan ni escriben, y todo asset o copy prohibido hace fallar el contrato
- **PRUEBA AUTOMATIZADA** `ui-home.contract.test.ts` usa Vitest parametrizado para verificar controles, destinos, imports locales y copias prohibidas sin duplicar el E2E
