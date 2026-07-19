import { Navigation } from "lucide-react";

// Ubicación real de la clínica (plus code RQVH+P98 — Los Andes, Ayacucho):
// Jirón Quinua con Augusto Salazar Bondy.
export const LAT_CLINICA = -13.15563;
export const LON_CLINICA = -74.22162;

export const DIRECCION_CLINICA = "Jirón Quinua, Los Andes — Ayacucho 05001";

// "Cómo llegar" abre las indicaciones de Google Maps con el destino ya
// fijado: es la app de mapas que el paciente lleva instalada en el móvil, así
// que el enlace se abre en su aplicación y traza la ruta desde donde esté.
// El mapa de OpenStreetMap se sigue usando para la vista embebida (sin
// clave de API), pero ya no como destino de este botón.
export const RUTA_MAPS = `https://www.google.com/maps/dir/?api=1&destination=${LAT_CLINICA}%2C${LON_CLINICA}`;

export function ComoLlegar({ compacto = false }: { compacto?: boolean }) {
  return (
    <a
      className={`como-llegar${compacto ? " is-compact" : ""}`}
      href={RUTA_MAPS}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Navigation aria-hidden="true" size={20} />
      Cómo llegar
    </a>
  );
}
