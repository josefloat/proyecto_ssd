## ADDED Requirements

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
El flujo SHALL terminar tras seleccionar un slot libre, SHALL persistir `fechaLima` y `slotId` en la URL, SHALL mostrar un resumen, y SHALL mantener “Continuar” realmente deshabilitado con una explicación visible de que el horario todavía no está reservado y sin ejecutar escrituras.

#### Scenario: FLOW-4.1 Selección válida termina de forma honesta
- **GIVEN** un día con al menos un slot libre del backend real
- **WHEN** el paciente selecciona fecha y slot
- **THEN** la URL y el resumen muestran la selección, “Continuar” está disabled, aparece la explicación de no-reserva y la red no contiene POST, PUT, PATCH ni DELETE
- **PRUEBA AUTOMATIZADA** `booking-flow.real-backend.spec.ts` registra requests Playwright, verifica parámetros, resumen, atributo disabled, ayuda visible y ausencia de métodos de escritura

#### Scenario: FLOW-4.2 Slot seleccionado deja de estar libre
- **GIVEN** una URL contiene un `slotId` previamente válido que ya no aparece entre los slots libres
- **WHEN** la pantalla revalida disponibilidad
- **THEN** elimina `slotId` mediante replace, conserva especialidad/médico/fecha, anuncia “Ese horario ya no está disponible” y exige elegir otro sin bloquear ni reservar nada
- **PRUEBA AUTOMATIZADA** `availability-screen.spec.ts` retira el slot con fixture de red después de la selección y verifica URL, anuncio, foco, acción disabled y cero escrituras

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
