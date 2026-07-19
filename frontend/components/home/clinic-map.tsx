import { LAT_CLINICA, LON_CLINICA } from "@/components/clinic-directions";

// Mapa pequeño embebido de OpenStreetMap: da la ubicación de un vistazo sin
// pedir clave de API ni cargar SDK de terceros. Es solo una vista global —
// el paciente que quiere la ruta usa el botón "Cómo llegar", que abre Google
// Maps. Vive únicamente en la home para no alterar las pantallas del flujo
// de reserva ni el autoservicio.
//
// El recuadro visible se calcula alrededor de la clínica: un margen pequeño
// deja la manzana a escala de barrio y el marcador centrado.
const MARGEN_LON = 0.0042;
const MARGEN_LAT = 0.0026;

const BBOX = [
  LON_CLINICA - MARGEN_LON,
  LAT_CLINICA - MARGEN_LAT,
  LON_CLINICA + MARGEN_LON,
  LAT_CLINICA + MARGEN_LAT,
]
  .map((valor) => valor.toFixed(5))
  .join("%2C");

const MAPA_EMBEBIDO =
  `https://www.openstreetmap.org/export/embed.html?bbox=${BBOX}` +
  `&layer=mapnik&marker=${LAT_CLINICA}%2C${LON_CLINICA}`;

export function MapaClinica() {
  return (
    <span className="clinic-map">
      <iframe
        title="Mapa de la ubicación de la clínica en Ayacucho"
        src={MAPA_EMBEBIDO}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </span>
  );
}
