import { DomainError } from "./errors";

export const ZONA_OPERATIVA = "America/Lima";
const OFFSET_LIMA_MINUTOS = 5 * 60;

export type FechaCivil = string;

type PartesFecha = Readonly<{ anio: number; mes: number; dia: number }>;

function partes(fecha: string): PartesFecha {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!coincidencia) {
    throw new DomainError(
      "La fecha debe tener formato YYYY-MM-DD",
      "FECHA_LIMA_INVALIDA",
    );
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const comprobacion = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    comprobacion.getUTCFullYear() !== anio ||
    comprobacion.getUTCMonth() !== mes - 1 ||
    comprobacion.getUTCDate() !== dia
  ) {
    throw new DomainError("La fecha Lima no existe", "FECHA_LIMA_INVALIDA");
  }

  return { anio, mes, dia };
}

function formatear({ anio, mes, dia }: PartesFecha): FechaCivil {
  return `${anio.toString().padStart(4, "0")}-${mes
    .toString()
    .padStart(2, "0")}-${dia.toString().padStart(2, "0")}`;
}

export function validarFechaCivil(fecha: string): FechaCivil {
  partes(fecha);
  return fecha;
}

export function sumarDias(fecha: FechaCivil, dias: number): FechaCivil {
  const { anio, mes, dia } = partes(fecha);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return formatear({
    anio: resultado.getUTCFullYear(),
    mes: resultado.getUTCMonth() + 1,
    dia: resultado.getUTCDate(),
  });
}

export function diaIso(fecha: FechaCivil): number {
  const { anio, mes, dia } = partes(fecha);
  const diaUtc = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return diaUtc === 0 ? 7 : diaUtc;
}

export function fechaHoraLimaAUtc(
  fecha: FechaCivil,
  minutoDelDia: number,
): Date {
  const { anio, mes, dia } = partes(fecha);
  const minutosUtc = minutoDelDia + OFFSET_LIMA_MINUTOS;
  return new Date(
    Date.UTC(anio, mes - 1, dia, 0, minutosUtc, 0, 0),
  );
}

export function fechaCivilParaPrisma(fecha: FechaCivil): Date {
  validarFechaCivil(fecha);
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function fechaCivilDesdePrisma(fecha: Date): FechaCivil {
  return fecha.toISOString().slice(0, 10);
}

export function hoyEnLima(ahora: Date = new Date()): FechaCivil {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_OPERATIVA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const valores = Object.fromEntries(
    formato
      .formatToParts(ahora)
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, parte.value]),
  );
  return validarFechaCivil(`${valores.year}-${valores.month}-${valores.day}`);
}
