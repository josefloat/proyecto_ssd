import { Navigation } from "lucide-react";

// Ubicación real de la clínica (plus code RQVH+P98 — Los Andes, Ayacucho):
// Jirón Quinua con Augusto Salazar Bondy. El enlace abre las indicaciones
// de OpenStreetMap con el destino ya fijado, para que el paciente trace la
// ruta desde donde esté.
const DESTINO_OSM = "-13.15563%2C-74.22162";

export const DIRECCION_CLINICA = "Jirón Quinua, Los Andes — Ayacucho 05001";

export const RUTA_OSM = `https://www.openstreetmap.org/directions?to=${DESTINO_OSM}#map=18/-13.15563/-74.22162`;

export function ComoLlegar({ compacto = false }: { compacto?: boolean }) {
  return (
    <a
      className={`como-llegar${compacto ? " is-compact" : ""}`}
      href={RUTA_OSM}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Navigation aria-hidden="true" size={20} />
      Cómo llegar
    </a>
  );
}
