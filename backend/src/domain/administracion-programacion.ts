import { Turno } from "@prisma/client";
import { validarFechaCivil, type FechaCivil } from "./fechas";
import { queryInvalidaPersonal } from "./personal-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TURNOS = new Set(Object.values(Turno));

export type ItemProgramacionAdmin = Readonly<{
  consultorioId: string;
  diaSemana: number;
  turno: Turno;
}>;

export type GuardarProgramacionAdmin = Readonly<{
  versionBase: number;
  vigenteDesde: FechaCivil;
  items: readonly ItemProgramacionAdmin[];
}>;

function uuid(valor: unknown): string {
  if (typeof valor !== "string" || !UUID.test(valor)) {
    throw queryInvalidaPersonal();
  }
  return valor;
}

export function validarMedicoId(valor: unknown): string {
  return uuid(valor);
}

export function validarFechaConsultaProgramacion(valor: unknown, hoy: FechaCivil) {
  if (valor === undefined) return hoy;
  if (typeof valor !== "string") throw queryInvalidaPersonal();
  return validarFechaCivil(valor);
}

export function validarGuardarProgramacion(
  valor: unknown,
  hoy: FechaCivil,
): GuardarProgramacionAdmin {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw queryInvalidaPersonal();
  }
  const body = valor as Record<string, unknown>;
  const claves = Object.keys(body);
  if (
    claves.length !== 3 ||
    !claves.includes("versionBase") ||
    !claves.includes("vigenteDesde") ||
    !claves.includes("items") ||
    !Number.isInteger(body.versionBase) ||
    (body.versionBase as number) < 0 ||
    typeof body.vigenteDesde !== "string" ||
    !Array.isArray(body.items)
  ) {
    throw queryInvalidaPersonal();
  }
  const vigenteDesde = validarFechaCivil(body.vigenteDesde);
  if (vigenteDesde <= hoy) {
    throw queryInvalidaPersonal();
  }
  const items = body.items.map((valorItem) => {
    if (!valorItem || typeof valorItem !== "object" || Array.isArray(valorItem)) {
      throw queryInvalidaPersonal();
    }
    const item = valorItem as Record<string, unknown>;
    if (
      Object.keys(item).length !== 3 ||
      !Number.isInteger(item.diaSemana) ||
      (item.diaSemana as number) < 1 ||
      (item.diaSemana as number) > 7 ||
      typeof item.turno !== "string" ||
      !TURNOS.has(item.turno as Turno)
    ) {
      throw queryInvalidaPersonal();
    }
    return {
      consultorioId: uuid(item.consultorioId),
      diaSemana: item.diaSemana as number,
      turno: item.turno as Turno,
    };
  });
  const medicos = new Set<string>();
  const consultorios = new Set<string>();
  for (const item of items) {
    const claveMedico = `${item.diaSemana}:${item.turno}`;
    const claveConsultorio = `${item.consultorioId}:${claveMedico}`;
    if (medicos.has(claveMedico) || consultorios.has(claveConsultorio)) {
      throw queryInvalidaPersonal();
    }
    medicos.add(claveMedico);
    consultorios.add(claveConsultorio);
  }
  return {
    versionBase: body.versionBase as number,
    vigenteDesde,
    items,
  };
}
