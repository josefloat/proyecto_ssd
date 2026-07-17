import { Turno } from "@prisma/client";

export type LimitesTurno = Readonly<{
  inicioMinuto: number;
  finMinuto: number;
}>;

export const TURNOS: Readonly<Record<Turno, LimitesTurno>> = {
  [Turno.MANANA]: { inicioMinuto: 9 * 60, finMinuto: 13 * 60 },
  [Turno.TARDE]: { inicioMinuto: 15 * 60, finMinuto: 19 * 60 },
  [Turno.NOCHE]: { inicioMinuto: 19 * 60, finMinuto: 23 * 60 },
};

export const HORAS_POR_TURNO = 4;
