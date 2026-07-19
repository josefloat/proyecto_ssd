# cierre-operativo Specification

## Purpose
Definir el gate verificable de seguridad, regresión, despliegue, operación y evidencia necesario para cerrar el proyecto.

## Requirements

### Requirement: CIERRE-1 Auditoría, regresión, operación y entrega final verificables
El cierre SHALL auditar árbol/historial, configuración, logs y artefactos para impedir secretos o datos personales; SHALL comprobar sesiones, proxy, roles y errores; SHALL ejecutar migración y seed idempotentes, builds y suites existentes con Playwright en serie; y SHALL exigir los cinco jobs productivos verdes para el mismo SHA de `main`. Después SHALL verificar rutas/roles/endpoints críticos y una subida real desde ADMIN → Imágenes persistida como `hero-home` y usada por la home. El repositorio SHALL incluir un runbook vigente y una matriz requisito → escenario → prueba/smoke → resultado/SHA. Solo SHALL declararse finalizado con producción verde, change archivado, strict válido y cero changes activos; ninguna evidencia SHALL registrar credenciales, cookies, conexiones, URL firmada o PII real.

#### Scenario: CIERRE-1.1 Mismo SHA queda limpio, verde, operativo y documentado
- **GIVEN** repositorio y secretos configurados, Cloudinary con escritura y un commit fusionado a `main`
- **WHEN** se ejecutan auditoría, suites, pipeline, smokes productivos, subida real y checklist documental
- **THEN** no hay exposición, los contratos de seguridad se conservan, los cinco jobs y superficies quedan verdes para el mismo SHA, la home usa la URL persistida y el runbook/matriz permiten reproducir la entrega
- **PRUEBA AUTOMATIZADA** escaneo, suites existentes, API de GitHub Actions, smokes HTTP/navegador, contratos documentales y OpenSpec strict/list aportan la evidencia sin una suite E2E nueva

#### Scenario: CIERRE-1.2 Hallazgo, fallo técnico o evidencia incompleta bloquea el cierre
- **GIVEN** un secreto/hallazgo, acceso indebido, job o SHA fallido, endpoint inesperado, Cloudinary `403`, evidencia incompleta, credencial documentada o change/strict pendiente
- **WHEN** cualquier gate, suite, smoke o checklist lo detecta
- **THEN** se detiene sin reproducir el valor sensible y no fusiona, archiva ni declara finalizado hasta corregir y repetir todas las verificaciones aplicables
- **PRUEBA AUTOMATIZADA** fixtures y variantes negativas existentes de seguridad/pipeline, smokes con status, contrato documental y comandos OpenSpec demuestran el bloqueo
