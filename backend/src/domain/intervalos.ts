import { Turno } from "@prisma/client";
import { validarDuracionCita } from "./catalogo";
import {
  FechaCivil,
  fechaHoraLimaAUtc,
  validarFechaCivil,
} from "./fechas";
import { TURNOS } from "./turnos";

export type IntervaloSlot = Readonly<{
  inicioUtc: Date;
  finUtc: Date;
}>;

export type FabricaIntervalos = (
  fechaLima: FechaCivil,
  turno: Turno,
  duracionCitaMinutos: number,
) => readonly IntervaloSlot[];

export const crearIntervalosTurno: FabricaIntervalos = (
  fechaLima,
  turno,
  duracionCitaMinutos,
) => {
  validarFechaCivil(fechaLima);
  validarDuracionCita(duracionCitaMinutos);
  const limites = TURNOS[turno];
  const intervalos: IntervaloSlot[] = [];

  for (
    let inicioMinuto = limites.inicioMinuto;
    inicioMinuto + duracionCitaMinutos <= limites.finMinuto;
    inicioMinuto += duracionCitaMinutos
  ) {
    intervalos.push({
      inicioUtc: fechaHoraLimaAUtc(fechaLima, inicioMinuto),
      finUtc: fechaHoraLimaAUtc(
        fechaLima,
        inicioMinuto + duracionCitaMinutos,
      ),
    });
  }

  return intervalos;
};
