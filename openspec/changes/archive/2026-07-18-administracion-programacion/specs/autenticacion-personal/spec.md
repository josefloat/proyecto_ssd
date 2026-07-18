## ADDED Requirements

### Requirement: AUTH-3 Credencial temporal de un solo uso y cambio obligatorio
La creación o reinicio administrativo SHALL generar la contraseña temporal en el servidor con entropía criptográfica, persistir únicamente su hash y devolver el valor en una sola respuesta que SHALL no registrarse. El usuario con `debeCambiarPassword = true` SHALL poder autenticar solo una sesión limitada a cambiar su propia contraseña; toda otra ruta privada SHALL responder `403`. Un cambio válido SHALL almacenar un hash nuevo, limpiar la marca, revocar todas sus sesiones —incluida la limitada— y exigir un login nuevo. El bootstrap SHALL marcar al admin inicial para cambio obligatorio sin sobrescribir su hash en despliegues posteriores.

#### Scenario: AUTH-3.1 Usuario cambia la temporal y vuelve a entrar con la nueva
- **GIVEN** el admin inicial o una cuenta creada/reiniciada con contraseña temporal entregada una sola vez
- **WHEN** inicia sesión, cambia la contraseña por una nueva válida y vuelve a iniciar sesión
- **THEN** antes del cambio solo accede a la operación de cambio, después todas las sesiones previas están revocadas, la temporal ya no autentica y la nueva contraseña da acceso al destino de su rol
- **PRUEBA AUTOMATIZADA** `personal-sesion.integration.test.ts` amplía la suite existente con el ciclo parametrizado por rol, sin duplicar login, expiración ni autorización ya cubiertos en AUTH-1/AUTH-2

#### Scenario: AUTH-3.2 Reutilización, contraseña inválida o reinicio revocan acceso inseguro
- **GIVEN** una sesión normal existente, una credencial temporal ya consumida y variantes de contraseña nueva inválida
- **WHEN** el ADMIN reinicia la credencial o el usuario intenta reutilizar la temporal/cambiar a una variante inválida
- **THEN** el reinicio revoca de inmediato la sesión normal y entrega una nueva temporal una sola vez; los otros intentos son rechazados sin exponer hashes, sin registrar contraseñas y sin dejar sesiones adicionales
- **PRUEBA AUTOMATIZADA** `personal-sesion.integration.test.ts` parametriza los errores nuevos y verifica hashes, conteos/revocación de sesiones y respuestas sanitizadas
