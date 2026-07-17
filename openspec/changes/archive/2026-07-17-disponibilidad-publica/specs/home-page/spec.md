## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Home placeholder carga y cumple una línea base de accesibilidad
**Reason**: La infraestructura ya está establecida y este cambio sustituye explícitamente el placeholder por la home real aprobada para pacientes.

**Migration**: La ruta `/` se conserva; sus garantías de carga y accesibilidad pasan a `HOME-1` y a `FLOW-5`, mientras el flujo comienza en `/reservar/especialidad`.
