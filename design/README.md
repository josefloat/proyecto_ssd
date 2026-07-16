# Diseño UI/UX — Señal de Vida

> `base-ui-ux-reservas.png` es dirección visual (paleta, tono y estilo de ilustración), **NO** una especificación de UI. Las pantallas vinculantes son las exportadas desde Stitch.

## Jerarquía de autoridad

Cuando dos artefactos entren en conflicto, se aplica este orden:

1. Requisitos y escenarios de OpenSpec.
2. Pantallas aprobadas de Stitch en `stitch/paciente/` para flujo, jerarquía, navegación y componentes.
3. Tokens y reglas de `stitch/DESIGN.md`.
4. `base-ui-ux-reservas.png` únicamente como referencia de tono visual.

Los datos de ejemplo de una maqueta nunca reemplazan las reglas del dominio. El HTML exportado es referencia de estructura visual; no es código de producción y no debe copiarse literalmente al frontend.

## Alcance de las pantallas disponibles

Este paquete cubre solamente la experiencia del **paciente**. No incluye pantallas para administrador, recepcionista o médico. Esas vistas no se deben inventar: necesitan un diseño aprobado y un cambio OpenSpec propio antes de implementarse.

| Orden | Pantalla | Carpeta | Cambio OpenSpec previsto |
| ---: | --- | --- | --- |
| 1 | Inicio | `stitch/paciente/01-inicio/` | `disponibilidad-publica` |
| 2 | Elegir especialidad | `stitch/paciente/02-especialidad/` | `disponibilidad-publica` |
| 3 | Elegir médico | `stitch/paciente/03-medico/` | `disponibilidad-publica` |
| 4 | Elegir fecha y hora | `stitch/paciente/04-fecha-y-hora/` | `disponibilidad-publica` |
| 5 | Datos del paciente | `stitch/paciente/05-datos-paciente/` | `reserva-de-cita-paciente` |
| 6 | Cita reservada y código | `stitch/paciente/06-cita-reservada/` | `reserva-de-cita-paciente` |
| 7 | Buscar mi cita | `stitch/paciente/07-buscar-mi-cita/` | `consulta-cancelacion-y-expiracion` |
| 8 | Detalle y cancelación de mi cita | `stitch/paciente/08-detalle-mi-cita/` | `consulta-cancelacion-y-expiracion` |

Cada carpeta contiene:

- `screen.png`: referencia visual vinculante dentro de los límites indicados aquí.
- `code.html`: prototipo generado por Stitch, solo como apoyo para comprender estructura y estilos.

## Aspectos vinculantes

- Flujo móvil, orden de pasos y una acción principal evidente por pantalla.
- Jerarquía visual, composición general, navegación y estados seleccionados/deshabilitados.
- Tipografía mínima de 18 px y lenguaje sencillo en español de Perú.
- Objetivos táctiles mínimos de 48 × 48 px y separación suficiente entre controles.
- Contraste WCAG 2.1 AA, foco visible y ausencia de información comunicada únicamente por color.
- Diseño responsive: las dimensiones de los PNG son capturas, no anchos fijos de implementación.
- Validación automatizada mediante Playwright y axe-core en los cambios que implementen estas vistas.

## Datos ilustrativos que deben corregirse al implementar

Las capturas se conservan sin modificaciones para mantener la exportación original, pero contienen datos ficticios e inconsistentes que **no** son vinculantes:

- Aparecen referencias a Lima y a la sede San Borja; el proyecto corresponde a la clínica Señal de Vida de Ayacucho.
- Los nombres de médicos, fechas, horas, códigos y direcciones son datos de demostración.
- El plazo de pago no debe copiar una fecha fija: se calcula como 72 horas desde la reserva.
- El paciente se identifica sin contraseña, mediante DNI + teléfono para reservar y DNI + código para consultar o cancelar.
- Especialidades, médicos, consultorios, disponibilidad y códigos deben venir del backend, nunca quedar hardcodeados desde el prototipo.
- Aunque `stitch/DESIGN.md` define `label-md` en 16 px, el requisito del proyecto de 18 px como mínimo prevalece para todo texto significativo, incluidas etiquetas, ayudas, estados y navegación.

## Procedencia

- Exportación: `stitch_se_al_de_vida_booking_system.zip`.
- Importada: 2026-07-16.
- Los PNG y HTML de `stitch/paciente/` se guardaron sin alterar su contenido.
- El sistema de diseño original se conserva en `stitch/DESIGN.md`.
