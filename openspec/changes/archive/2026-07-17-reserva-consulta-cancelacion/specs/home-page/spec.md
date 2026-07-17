## MODIFIED Requirements

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
