# flujo-disponibilidad-paciente Specification

## Purpose
TBD - created by archiving change disponibilidad-publica. Update Purpose after archive.
## Requirements
### Requirement: FLOW-1 La URL conserva y revalida la selección
El frontend SHALL usar `especialidadId`, `medicoId`, `fechaLima` y `slotId` de la URL como única fuente durable, SHALL usar replace al seleccionar dentro de un paso y push al avanzar, SHALL conservar selecciones válidas al recargar o volver y SHALL limpiar toda selección dependiente cuando cambia una superior.

#### Scenario: FLOW-1.1 Flujo válido sobrevive recarga y navegación atrás
- **GIVEN** especialidad, médico, fecha y slot válidos servidos por el backend real
- **WHEN** el paciente los elige, avanza, recarga `/reservar/fecha-hora` y navega atrás
- **THEN** cada URL contiene los parámetros esperados, la selección se reconstruye y revalida, y atrás vuelve a la pantalla previa sin perder sus parámetros válidos
- **PRUEBA AUTOMATIZADA** `booking-flow.real-backend.spec.ts` usa Playwright con Express/PostgreSQL/seed reales y verifica historial, URL, recarga y estado seleccionado

#### Scenario: FLOW-1.2 Cambiar una selección superior limpia dependencias
- **GIVEN** una URL con especialidad, médico, fecha y slot válidos
- **WHEN** el paciente cambia especialidad y después, en otro recorrido, cambia médico o fecha
- **THEN** cambiar especialidad elimina médico/fecha/slot, cambiar médico elimina fecha/slot y cambiar fecha elimina slot mediante replace sin crear entradas redundantes de historial
- **PRUEBA AUTOMATIZADA** `booking-url-state.spec.ts` verifica por Vitest AAA la limpieza jerárquica y `doctor-screen.spec.ts` usa Playwright para comparar query, historial observable y UI

#### Scenario: FLOW-1.3 URL directa incompleta o inválida se recupera
- **GIVEN** una URL de médico sin especialidad, una URL de fecha-hora sin médico y parámetros que ya no existen en el API
- **WHEN** se carga directamente cada URL
- **THEN** el frontend vuelve con replace al primer paso incompleto o limpia la selección inválida, mantiene contexto válido y anuncia qué debe elegirse otra vez
- **PRUEBA AUTOMATIZADA** `booking-url-state.spec.ts` verifica por Vitest AAA el primer paso incompleto y `doctor-screen.spec.ts` abre URLs incompletas/retiradas para comprobar redirección, parámetros y anuncio accesible

### Requirement: FLOW-2 Las pantallas consumen datos reales y respetan Stitch
Las rutas `/`, `/reservar/especialidad`, `/reservar/medico` y `/reservar/fecha-hora` SHALL respetar composición, jerarquía, navegación y estados de las capturas aprobadas, SHALL obtener especialidades, médicos, consultorios y slots del API, y SHALL usar únicamente iconos/pasteles por nombre canónico con fallback y avatares de iniciales como presentación local.

#### Scenario: FLOW-2.1 Datos del backend aparecen sin atributos inventados
- **GIVEN** el backend real devuelve nombres canónicos, médicos ficticios, consultorios y slots del seed
- **WHEN** el paciente recorre las cuatro pantallas
- **THEN** ve esos datos, iconos/pasteles coherentes y avatares de iniciales, sin Lima, San Borja, ratings, reseñas, fotografías, horas o profesionales hardcodeados desde Stitch
- **PRUEBA AUTOMATIZADA** `booking-flow.real-backend.spec.ts` cambia datos del fixture PostgreSQL y confirma que la UI cambia con el API; `ui-copy.contract.test.ts` busca copias prohibidas y DTO incrustados

#### Scenario: FLOW-2.2 Respuesta vacía no activa datos de maqueta
- **GIVEN** un fixture de red devuelve `200` con `items: []` para especialidades, médicos o disponibilidad
- **WHEN** se carga el paso correspondiente
- **THEN** aparece el estado vacío específico con opción de volver/cambiar y no se muestran tarjetas, médicos ni horarios de respaldo
- **PRUEBA AUTOMATIZADA** `booking-network-states.spec.ts` intercepta únicamente cada respuesta vacía y verifica mensaje, controles y ausencia de datos de Stitch

#### Scenario: FLOW-2.3 Nombre canónico desconocido usa fallback seguro
- **GIVEN** un fixture de presentación recibe un item válido cuyo nombre no tiene mapeo de icono o pastel
- **WHEN** se renderiza la tarjeta
- **THEN** usa icono y color neutral accesibles, conserva el nombre recibido y no falla ni inventa una etiqueta amigable
- **PRUEBA AUTOMATIZADA** `specialty-presentation.domain.test.ts` usa Vitest AAA sobre la función pura de presentación y `booking-network-states.spec.ts` verifica el fallback visible

### Requirement: FLOW-3 La espera coordinada representa loading, cold start y recuperación
El frontend SHALL representar `loading`, `preparing`, `ready`, `empty`, `offline`, `error` e `invalid`, SHALL agrupar `502`/`503`/`504` intermedios en un único estado accesible de preparación, SHALL limitarse a siete requests de 10 segundos con backoff `1,2,3,4,4,4` y presupuesto nominal máximo aproximado de 88 segundos, y SHALL permitir un nuevo presupuesto manual al agotarse.

#### Scenario: FLOW-3.1 Cold start transitorio se recupera sin cadena de errores
- **GIVEN** una secuencia determinista de `504`, `503` y finalmente `200` antes del séptimo intento
- **WHEN** el paciente abre un paso que necesita datos
- **THEN** primero ve loading, luego un único mensaje `preparing` con estado accesible y finalmente contenido ready, sin ver cada error intermedio
- **PRUEBA AUTOMATIZADA** `booking-network-states.spec.ts` usa reloj falso y fixture secuencial para verificar número/orden de intentos, mensaje único, `aria-live` y resultado final

#### Scenario: FLOW-3.2 Presupuesto agotado ofrece reintento manual
- **GIVEN** siete intentos que terminan en timeout o `502`/`503`/`504`
- **WHEN** se alcanza el deadline global sin respuesta válida
- **THEN** aparece el error final con “Intentar nuevamente”, no se inicia un octavo request y activar el botón crea un presupuesto nuevo que puede llegar a ready
- **PRUEBA AUTOMATIZADA** `booking-network-states.spec.ts` congela el reloj, cuenta siete requests, avanza hasta 88 segundos nominales y verifica el segundo ciclo exitoso

#### Scenario: FLOW-3.3 Navegador offline no simula cold start
- **GIVEN** el navegador está offline antes o durante la espera
- **WHEN** falla la consulta
- **THEN** aparece el estado offline con mensaje comprensible, se detienen reintentos y al recuperar conectividad la acción manual vuelve a loading
- **PRUEBA AUTOMATIZADA** `booking-network-states.spec.ts` alterna el contexto Playwright offline/online y verifica requests, copy, foco y recuperación

#### Scenario: FLOW-3.4 Navegar cancela request y temporizadores anteriores
- **GIVEN** un request pendiente y un backoff programado para una selección
- **WHEN** el paciente navega o cambia el filtro antes de la respuesta
- **THEN** se abortan fetch y temporizador, la respuesta tardía no modifica la nueva pantalla y no queda actualización sobre un componente desmontado
- **PRUEBA AUTOMATIZADA** `booking-network-states.spec.ts` retiene una respuesta, cambia la URL y libera la respuesta antigua para comprobar abort, conteo y estado final

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

### Requirement: FLOW-5 El flujo cumple accesibilidad y navegación para adultos mayores
Las cuatro pantallas y sus estados principales SHALL cumplir WCAG 2.1 AA automatizable, SHALL usar texto significativo de al menos 18 px, targets de al menos 48×48, foco visible, landmarks y anuncios accesibles, y SHALL poder recorrerse completamente con teclado sin que la selección dependa solo del color.

#### Scenario: FLOW-5.1 Teclado y axe-core pasan en pantallas y estados
- **GIVEN** viewport móvil y escritorio y los estados loading, preparing, ready, empty, offline, invalid y error
- **WHEN** Playwright recorre controles con teclado y axe-core analiza cada pantalla/estado
- **THEN** el orden de foco es lógico, el foco es visible, los controles se activan por teclado, tamaños mínimos se cumplen y axe-core reporta cero violaciones
- **PRUEBA AUTOMATIZADA** `booking-accessibility.spec.ts` ejecuta axe y mediciones DOM sobre las cuatro rutas y fixtures de estado en ambos viewports

#### Scenario: FLOW-5.2 Regresión accesible se detecta antes de integrar
- **GIVEN** un fixture local deliberado elimina el nombre accesible o reduce contraste/target de un control
- **WHEN** corre el gate automatizado de accesibilidad
- **THEN** axe-core o la aserción geométrica falla y la regresión no puede considerarse verde
- **PRUEBA AUTOMATIZADA** `booking-accessibility-fixture.spec.ts` monta la variante local defectuosa sin tocar producción y espera la violación o tamaño insuficiente

### Requirement: FLOW-6 Fidelidad visual responsive y movimiento reducido son verificables
El frontend SHALL mantener alta fidelidad a Stitch en composición, jerarquía, navegación, estados seleccionados/deshabilitados y adaptación móvil/escritorio, SHALL cargar Atkinson Hyperlegible e ilustración original desde archivos locales, y SHALL usar Framer Motion sutil con `MotionConfig reducedMotion="user"` sin ocultar contenido bajo `prefers-reduced-motion`.

#### Scenario: FLOW-6.1 Baselines visuales estables cubren el flujo
- **GIVEN** Chromium, locale `es-PE`, zona `America/Lima`, reloj, fuente local, color scheme, viewports y reduced-motion congelados
- **WHEN** Playwright captura home, especialidad, médico, fecha/hora, preparación y selección en móvil y escritorio
- **THEN** las imágenes coinciden con sus baselines dentro del umbral pequeño documentado y no presentan recortes, solapamientos ni layout genérico ajeno a Stitch
- **PRUEBA AUTOMATIZADA** `booking-visual.spec.ts` usa `toHaveScreenshot`, espera fuente/contenido estable y guarda baselines versionados para ambos proyectos de viewport

#### Scenario: FLOW-6.2 Preferencia de movimiento reducido conserva contenido y layout
- **GIVEN** el sistema operativo anuncia `prefers-reduced-motion: reduce`
- **WHEN** el paciente navega y selecciona tarjetas
- **THEN** el contenido aparece sin desplazamientos o transiciones no esenciales, las selecciones siguen visibles y el layout final coincide con el de movimiento normal terminado
- **PRUEBA AUTOMATIZADA** `booking-motion.spec.ts` compara estados finales con `reducedMotion: reduce` y `no-preference`, y verifica la media query y `MotionConfig`

#### Scenario: FLOW-6.3 Deriva visual o asset remoto falla el gate
- **GIVEN** un fixture local desplaza la acción principal o sustituye fuente/ilustración por una URL remota
- **WHEN** corren la regresión visual y el contrato de assets
- **THEN** el screenshot o el chequeo de recursos falla antes de integrar
- **PRUEBA AUTOMATIZADA** `booking-visual-fixture.spec.ts` usa una variante deliberada y `ui-assets.contract.test.ts` rechaza fuentes e ilustraciones remotas
