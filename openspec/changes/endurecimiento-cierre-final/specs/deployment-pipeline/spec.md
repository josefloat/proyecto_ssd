## ADDED Requirements

### Requirement: Pipeline con runtime vigente, privilegio mínimo y logs sanitizados
El workflow SHALL usar versiones estables de las acciones oficiales cuyo runtime no dependa de Node.js 20, SHALL mantener Node.js 22 como runtime de la aplicación, SHALL declarar únicamente `contents: read` salvo necesidad explícita y SHALL desactivar cachés automáticos innecesarios. Los pasos de proveedor SHALL registrar solo status, identificadores, estados y SHA requeridos; SHALL no imprimir respuestas completas, tokens, conexiones, passwords, cookies ni secretos. El gate existente SHALL permanecer: ramas ejecutan solo `build-and-test` y únicamente `main` habilita migración, despliegues y runtime smoke.

#### Scenario: PIPE-1.1 Main usa acciones vigentes y despliega con trazabilidad mínima
- **GIVEN** un commit válido fusionado a `main`
- **WHEN** GitHub Actions ejecuta el workflow endurecido
- **THEN** `checkout@v7` y `setup-node@v7` preparan Node.js 22 con permisos `contents: read`, los cinco jobs terminan en verde para el mismo SHA y los logs conservan solo campos operativos permitidos
- **PRUEBA AUTOMATIZADA** el contrato estático del workflow y la API de GitHub Actions verifican versiones, permisos, DAG, nombres de jobs y SHA; las suites de pipeline existentes demuestran los gates

#### Scenario: PIPE-1.2 Rama o respuesta remota fallida no despliega ni filtra payloads
- **GIVEN** una rama de PR o un fixture de proveedor con error que contiene campos no autorizados
- **WHEN** corre el workflow o procesa la respuesta fallida
- **THEN** los jobs productivos quedan omitidos en la rama y el diagnóstico del proveedor falla con status/mensaje sanitizados sin imprimir el payload ni ningún secreto
- **PRUEBA AUTOMATIZADA** el contrato parametrizado del workflow inspecciona gates y comandos de log; reutiliza los fixtures de fallo y desajuste ya existentes sin llamar a producción
