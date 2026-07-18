# Diseño UI/UX — Señal de Vida

> `base-ui-ux-reservas.png` es dirección visual (paleta, tono y estilo de ilustración), **NO** una especificación de UI. Las pantallas vinculantes son las exportadas desde Stitch.

## Jerarquía de autoridad

Cuando dos artefactos entren en conflicto, se aplica este orden:

1. Requisitos y escenarios de OpenSpec.
2. Pantallas aprobadas de Stitch en `stitch/paciente/` y `stitch/personal/` para flujo, jerarquía, navegación y componentes.
3. Tokens y reglas de `stitch/DESIGN.md`.
4. `base-ui-ux-reservas.png` únicamente como referencia de tono visual.

Los datos de ejemplo de una maqueta nunca reemplazan las reglas del dominio. El HTML exportado es referencia de estructura visual; no es código de producción y no debe copiarse literalmente al frontend.

## Alcance de las pantallas disponibles

El paquete incluye dos superficies aprobadas y separadas:

- `stitch/paciente/`: reserva y autoservicio público del paciente.
- `stitch/personal/`: acceso y operación interna de recepción, médico y administración.

Cada superficie se implementa únicamente dentro del change OpenSpec indicado. Una captura define composición y jerarquía, pero no amplía por sí sola el dominio ni autoriza funciones que OpenSpec deja fuera de alcance.

### Paciente

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

### Personal

| Orden | Pantalla | Carpeta | Cambio OpenSpec previsto |
| ---: | --- | --- | --- |
| 1 | Acceso del personal | `stitch/personal/01-login/` | `autenticacion-operacion-personal` |
| 2 | Agenda diaria de recepción | `stitch/personal/02-recepcion-agenda/` | `autenticacion-operacion-personal` |
| 3 | Detalle de cita y acciones de recepción | `stitch/personal/03-recepcion-detalle-cita/` | `autenticacion-operacion-personal` |
| 4 | Constancia imprimible | `stitch/personal/04-constancia/` | `autenticacion-operacion-personal` |
| 5 | Agenda diaria del médico | `stitch/personal/05-medico-agenda/` | `autenticacion-operacion-personal` |
| 6 | Inicio del administrador | `stitch/personal/06-admin-dashboard/` | `administracion-programacion` |
| 7 | Gestión de médicos y recepcionistas | `stitch/personal/07-admin-usuarios/` | `administracion-programacion` |
| 8 | Programación semanal | `stitch/personal/08-admin-programacion-semanal/` | `administracion-programacion` |

Cada carpeta contiene:

- `screen.png`: referencia visual vinculante dentro de los límites indicados aquí.
- `code.html`: prototipo generado por Stitch, solo como apoyo para comprender estructura y estilos.

## Aspectos vinculantes

- En paciente: flujo móvil, orden de pasos y una acción principal evidente por pantalla.
- En personal: shell de escritorio, navegación lateral, jerarquía de tablas/formularios y adaptación responsive sin fijar el lienzo a 1600 px.
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

### Correcciones obligatorias para las maquetas de personal

- Roles, permisos, sesiones, campos persistidos y transiciones de cita proceden de OpenSpec; la presencia de un control en la captura no autoriza su implementación.
- Recuperación de contraseña, “mantener sesión”, soporte TI, notificaciones, perfiles con fotografía, ajustes, reportes, búsquedas globales, creación manual de citas e historial clínico no forman parte de estas pantallas salvo que un change posterior los especifique. Deben omitirse o aparecer realmente deshabilitados como “Próximamente”.
- El médico solo consulta su agenda diaria. “Ver historial”, seguimiento clínico, consulta en curso y escritura médica están fuera de alcance.
- Recepción registra `RESERVADA → PAGADA`, imprime una vista HTML y abre un enlace `wa.me`; no crea pagos en línea ni estados clínicos.
- Fotografías, edades, correos de pacientes, precios, montos, métricas, recaudación, porcentajes, alertas, QR, sedes y datos de ejemplo son ilustrativos. Solo se muestran datos autorizados y realmente disponibles desde la API.
- Los turnos canónicos prevalecen sobre la captura: mañana `09:00–13:00`, tarde `15:00–19:00`, noche `19:00–23:00`. No copiar `07:00–13:00`, `14:00–20:00` ni un turno que cruce medianoche.
- La programación semanal real usa médico, día ISO, turno canónico y consultorio, con las restricciones y estrategia de concurrencia definidas por el motor de disponibilidad.
- La constancia será HTML imprimible con `window.print()` y CSS `@media print`; el QR y cualquier descarga PDF son decorativos o quedan fuera de alcance.
- Los assets de personas del HTML exportado no se usan en producción. Se prefieren iniciales o iconos locales, sin URLs remotas.

## Procedencia

- Exportación paciente: `stitch_se_al_de_vida_booking_system.zip`.
- Pantallas de paciente importadas: 2026-07-16.
- Los PNG y HTML de `stitch/paciente/` se guardaron sin alterar su contenido.
- El sistema de diseño original se conserva en `stitch/DESIGN.md`.
- Exportación de personal: `stitch_se_al_de_vida_booking_system 2/`.
- Pantallas de personal importadas: 2026-07-18.
- Los PNG y HTML de `stitch/personal/` se guardaron sin alterar su contenido; sus discrepancias funcionales se resuelven mediante las reglas anteriores y OpenSpec.
