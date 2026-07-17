## MODIFIED Requirements

### Requirement: FLOW-4 Elegir un slot no crea una reserva
Elegir un slot SHALL limitarse a conservar `fechaLima` y `slotId` y mostrar el resumen; activar “Continuar” SHALL navegar a `/reservar/datos` sin escribir; únicamente “Confirmar cita” con DNI, nombre y teléfono válidos SHALL intentar la reserva con una clave de idempotencia estable; un éxito SHALL mostrar la pantalla 06 con el código y vencimiento reales, mientras un conflicto SHALL conservar los datos, retirar el slot inválido cuando corresponda y ofrecer volver a elegir sin inventar una confirmación.

#### Scenario: FLOW-4.1 El paciente completa la reserva y recibe su código
- **GIVEN** una selección válida reconstruida desde la URL y un slot libre servido por el backend real
- **WHEN** el paciente continúa, completa la pantalla 05 y confirma una vez
- **THEN** ninguna escritura ocurre al seleccionar o navegar, el POST de confirmación ocurre con una sola clave estable, y la pantalla 06 muestra el mismo código, estado `RESERVADA`, resumen y vencimiento devueltos por la API sin correo, pago en línea ni datos de Stitch
- **PRUEBA AUTOMATIZADA** `booking-completion.spec.ts` es el primer flujo Playwright integral y recorre slot → datos → confirmación con Express/PostgreSQL reales

#### Scenario: FLOW-4.2 Validación o conflicto conserva el control del paciente
- **GIVEN** casos parametrizados de campos inválidos, datos de paciente incompatibles, replay divergente y slot que dejó de estar libre
- **WHEN** el formulario intenta confirmar cada caso
- **THEN** anuncia el error junto al control o resumen correspondiente, conserva entradas no sensibles útiles, no muestra código falso, no dispara reintentos automáticos y para un slot ocupado limpia `slotId` y permite volver a fecha/hora
- **PRUEBA AUTOMATIZADA** `booking-submit-state.test.ts` usa Vitest AAA sobre el adaptador/estado del submit con respuestas API parametrizadas, sin duplicar la concurrencia ya cubierta en integración

## ADDED Requirements

### Requirement: FLOW-7 Autoservicio de cita respeta Stitch y accesibilidad
Las rutas de datos, confirmación, búsqueda y detalle/cancelación SHALL respetar la composición y jerarquía de Stitch 05–08, SHALL usar solo datos reales permitidos, SHALL mantener una acción principal clara y SHALL cumplir WCAG 2.1 AA automatizable con texto significativo de al menos 18 px, targets de al menos 48×48, foco visible, teclado, anuncios accesibles y selección no dependiente del color; SHALL omitir correo, descarga, pase, mapa y datos geográficos ficticios fuera de alcance.

#### Scenario: FLOW-7.1 Consulta y cancelación recorren las pantallas aprobadas
- **GIVEN** una cita reservada real y el paciente ubicado en “Ver mi cita”
- **WHEN** ingresa DNI+código, revisa el detalle y confirma la cancelación en el diálogo de la misma pantalla
- **THEN** las pantallas 07–08 muestran sus datos reales y jerarquía aprobada, la cancelación aparece confirmada, la acción destructiva desaparece y volver al inicio no expone credenciales en la URL
- **PRUEBA AUTOMATIZADA** `appointment-selfservice.spec.ts` es el segundo y último flujo Playwright integral y recorre home → búsqueda → detalle → cancelación con backend real

#### Scenario: FLOW-7.2 Estados de error siguen siendo comprensibles y accesibles
- **GIVEN** pantallas 05–08 en estados ready, validación inválida, cita no encontrada, slot en conflicto y cita ya cancelada en móvil y escritorio
- **WHEN** un único barrido Playwright recorre teclado, foco, anuncios, tamaños y axe-core
- **THEN** los errores no revelan datos, el foco llega al mensaje útil, todos los controles mantienen nombre y target suficiente, no hay contenido oculto por movimiento reducido y axe-core reporta cero violaciones WCAG 2.1 AA automatizables
- **PRUEBA AUTOMATIZADA** `patient-selfservice-accessibility.spec.ts` es el único barrido axe del change y cubre la matriz de rutas/estados sin crear un E2E de dominio adicional
