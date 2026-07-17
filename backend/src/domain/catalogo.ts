import { DomainError } from "./errors";

export const DURACION_MINIMA_MINUTOS = 1;
export const DURACION_MAXIMA_MINUTOS = 240;

export type EspecialidadCanonica = Readonly<{
  nombre: string;
  duracionCitaMinutos: number;
}>;

export const ESPECIALIDADES_CANONICAS: readonly EspecialidadCanonica[] = [
  { nombre: "Medicina General", duracionCitaMinutos: 20 },
  { nombre: "Cardiología", duracionCitaMinutos: 30 },
  { nombre: "Pediatría", duracionCitaMinutos: 20 },
  { nombre: "Traumatología", duracionCitaMinutos: 30 },
  { nombre: "Ginecología", duracionCitaMinutos: 30 },
  { nombre: "Dermatología", duracionCitaMinutos: 15 },
] as const;

export function validarDuracionCita(duracionCitaMinutos: number): number {
  if (
    !Number.isInteger(duracionCitaMinutos) ||
    duracionCitaMinutos < DURACION_MINIMA_MINUTOS ||
    duracionCitaMinutos > DURACION_MAXIMA_MINUTOS
  ) {
    throw new DomainError(
      "La duración de cita debe ser un entero entre 1 y 240 minutos",
      "DURACION_CITA_INVALIDA",
    );
  }

  return duracionCitaMinutos;
}

export function validarCatalogoCanonico(
  catalogo: readonly EspecialidadCanonica[],
): void {
  if (catalogo.length !== ESPECIALIDADES_CANONICAS.length) {
    throw new DomainError(
      "El catálogo debe contener exactamente las seis especialidades canónicas",
      "CATALOGO_ESPECIALIDADES_DIVERGENTE",
    );
  }

  for (const esperada of ESPECIALIDADES_CANONICAS) {
    const encontrada = catalogo.find((item) => item.nombre === esperada.nombre);
    if (
      !encontrada ||
      encontrada.duracionCitaMinutos !== esperada.duracionCitaMinutos
    ) {
      throw new DomainError(
        `La especialidad ${esperada.nombre} no coincide con el catálogo canónico`,
        "CATALOGO_ESPECIALIDADES_DIVERGENTE",
      );
    }
  }
}
