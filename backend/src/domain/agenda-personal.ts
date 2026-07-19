import { EstadoCita } from "@prisma/client";
import { queryInvalidaPersonal } from "./personal-api";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS = new Set<string>(Object.values(EstadoCita));

export type FiltrosAgendaRecepcionQuery = {
  desde: string;
  especialidadId?: string;
  medicoId?: string;
  estado?: EstadoCita;
};

function uuidOpcional(valor: unknown): string | undefined {
  if (valor === undefined) {
    return undefined;
  }
  if (typeof valor !== "string" || !UUID.test(valor)) {
    throw queryInvalidaPersonal();
  }
  return valor;
}

function estadoOpcional(valor: unknown): EstadoCita | undefined {
  if (valor === undefined) {
    return undefined;
  }
  if (typeof valor !== "string" || !ESTADOS.has(valor)) {
    throw queryInvalidaPersonal();
  }
  return valor as EstadoCita;
}

export function validarFiltrosAgendaRecepcion(
  query: Readonly<Record<string, unknown>>,
  hoyPorDefecto: string,
): FiltrosAgendaRecepcionQuery {
  const permitidos = new Set(["especialidadId", "medicoId", "estado"]);
  if (Object.keys(query).some((clave) => !permitidos.has(clave))) {
    throw queryInvalidaPersonal();
  }
  const filtros: FiltrosAgendaRecepcionQuery = {
    desde: hoyPorDefecto,
  };
  const especialidadId = uuidOpcional(query.especialidadId);
  if (especialidadId) {
    filtros.especialidadId = especialidadId;
  }
  const medicoId = uuidOpcional(query.medicoId);
  if (medicoId) {
    filtros.medicoId = medicoId;
  }
  const estado = estadoOpcional(query.estado);
  if (estado) {
    filtros.estado = estado;
  }
  return filtros;
}
