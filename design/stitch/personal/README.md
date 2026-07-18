# Pantallas internas — Señal de Vida

Exportación aprobada para los changes de Sprint 4. Los tokens compartidos están en `../DESIGN.md` y las reglas de autoridad, accesibilidad y corrección de datos están en `../../README.md`.

## Inventario

| Pantalla | Referencia vinculante | Alcance |
| --- | --- | --- |
| Acceso | `01-login/screen.png` | Login común del personal |
| Agenda de recepción | `02-recepcion-agenda/screen.png` | Agenda del día y filtros |
| Detalle de cita | `03-recepcion-detalle-cita/screen.png` | Pago, constancia y `wa.me` |
| Constancia | `04-constancia/screen.png` | Vista HTML imprimible |
| Agenda médica | `05-medico-agenda/screen.png` | Agenda propia, solo lectura |
| Dashboard admin | `06-admin-dashboard/screen.png` | Entrada y navegación administrativa |
| Usuarios | `07-admin-usuarios/screen.png` | Médicos y recepcionistas |
| Programación | `08-admin-programacion-semanal/screen.png` | Día, turno y consultorio por médico |

Cada carpeta conserva `screen.png` como referencia de composición y `code.html` únicamente como apoyo estructural. El HTML no es código de producción.

## Límites de interpretación

- OpenSpec prevalece sobre nombres, fechas, horarios, estados, importes, datos personales y acciones ilustrativas.
- Las capturas son desktop-first, no desktop-only. La implementación debe conservar navegación y jerarquía en móvil sin scroll horizontal obligatorio.
- No se implementan historial clínico, reportes, métricas inventadas, fotografías remotas, QR, PDF, mapas, notificaciones ni creación manual de citas por aparecer en las maquetas.
- El cambio 4A usa `01`–`05`; el cambio 4B usa `06`–`08` y depende de la autenticación de 4A.
