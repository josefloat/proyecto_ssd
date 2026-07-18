"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  guardarProgramacionAdmin,
  obtenerCatalogosAdmin,
  obtenerProgramacionAdmin,
} from "@/lib/personal-client";
import type { CatalogosAdmin, ItemProgramacionAdmin } from "@/lib/personal-types";
import { AdminShell } from "./admin-shell";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TURNOS = [
  { id: "MANANA", label: "Mañana", horario: "09:00–13:00" },
  { id: "TARDE", label: "Tarde", horario: "15:00–19:00" },
  { id: "NOCHE", label: "Noche", horario: "19:00–23:00" },
] as const;

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function proximoLunes(): string {
  const hoy = hoyLima();
  const fecha = new Date(`${hoy}T00:00:00.000Z`);
  const iso = fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay();
  fecha.setUTCDate(fecha.getUTCDate() + (iso === 1 ? 7 : 8 - iso));
  return fecha.toISOString().slice(0, 10);
}

function clave(diaSemana: number, turno: string) { return `${diaSemana}:${turno}`; }

export function AdminProgramacionScreen() {
  const router = useRouter();
  const [catalogos, setCatalogos] = useState<CatalogosAdmin | null>(null);
  const [medicoId, setMedicoId] = useState("");
  const [version, setVersion] = useState(0);
  const [vigenteDesde, setVigenteDesde] = useState(proximoLunes);
  const [celdas, setCeldas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    obtenerCatalogosAdmin().then((datos) => {
      setCatalogos(datos);
      setMedicoId(datos.medicos[0]?.id ?? "");
      setCargando(false);
    }).catch((fallo: { status?: number }) => {
      if (fallo.status === 401 || fallo.status === 403) router.replace("/personal/login");
      else { setError("No pudimos cargar los catálogos."); setCargando(false); }
    });
  }, [router]);

  useEffect(() => {
    if (!medicoId) return;
    obtenerProgramacionAdmin(medicoId).then((programacion) => {
      setVersion(programacion.version);
      const base = programacion.pendientes.at(-1) ?? programacion.revisionAplicable;
      const siguientes: Record<string, string> = {};
      for (const item of base?.items ?? []) siguientes[clave(item.diaSemana, item.turno)] = item.consultorioId;
      setCeldas(siguientes);
      setVigenteDesde(programacion.pendientes.at(-1)?.vigenteDesde ?? proximoLunes());
      setError("");
    }).catch((fallo: { status?: number }) => {
      if (fallo.status === 401 || fallo.status === 403) router.replace("/personal/login");
      else setError("No pudimos cargar la programación del médico.");
    }).finally(() => setCargando(false));
  }, [medicoId, router]);

  async function guardar() {
    if (!medicoId) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    const items: ItemProgramacionAdmin[] = [];
    for (let diaSemana = 1; diaSemana <= 7; diaSemana += 1) {
      for (const turno of TURNOS) {
        const consultorioId = celdas[clave(diaSemana, turno.id)];
        if (consultorioId) items.push({ consultorioId, diaSemana, turno: turno.id });
      }
    }
    try {
      const resultado = await guardarProgramacionAdmin(medicoId, { versionBase: version, vigenteDesde, items });
      setVersion(resultado.revision.numero);
      setMensaje(resultado.reconciliacion.omitidosPorOcupacion > 0
        ? `Programación guardada. ${resultado.reconciliacion.omitidosPorOcupacion} intervalos se omitieron para conservar reservas o bloqueos.`
        : "Programación guardada y disponibilidad futura reconciliada.");
    } catch (fallo) {
      const code = (fallo as { code?: string }).code;
      setError(code === "VERSION_PROGRAMACION_OBSOLETA"
        ? "Otra edición se guardó primero. Vuelve a seleccionar el médico para recargar."
        : code === "PROGRAMACION_EN_CONFLICTO"
          ? "El plan excede las horas o usa un consultorio ocupado."
          : "No se pudo guardar la programación.");
    } finally { setGuardando(false); }
  }

  return (
    <AdminShell
      actual="programacion"
      titulo="Programación semanal"
      subtitulo="Días ISO, turnos canónicos y consultorios"
      acciones={<button className="admin-primary-action" type="button" disabled={guardando || cargando || !medicoId} onClick={guardar}><Save aria-hidden="true" /> {guardando ? "Guardando…" : "Guardar plan"}</button>}
    >
      <section className="schedule-controls" aria-label="Parámetros de programación">
        <label htmlFor="schedule-medico">Médico<select id="schedule-medico" value={medicoId} onChange={(event) => { setCargando(true); setMedicoId(event.target.value); }}><option value="">Selecciona un médico</option>{catalogos?.medicos.map((item) => <option key={item.id} value={item.id}>{item.nombre} — {item.especialidad.nombre}</option>)}</select></label>
        <label htmlFor="schedule-vigencia">Vigente desde<input id="schedule-vigencia" type="date" min={proximoLunes()} value={vigenteDesde} onChange={(event) => setVigenteDesde(event.target.value)} /></label>
        <div className="schedule-version"><span>Versión leída</span><strong>{version}</strong></div>
      </section>
      <p className="schedule-warning"><AlertTriangle aria-hidden="true" /> Guardar reemplaza solo slots libres desde la vigencia. Reservas y bloqueos se conservan.</p>
      {error ? <div className="admin-state admin-error" role="alert">{error}</div> : null}
      {mensaje ? <div className="admin-state admin-success" role="status">{mensaje}</div> : null}
      {cargando ? <div className="admin-state" role="status">Cargando programación…</div> : !medicoId ? <div className="admin-state">No hay médicos disponibles.</div> : (
        <div className="schedule-matrix-wrap">
          <table className="schedule-matrix">
            <thead><tr><th>Turno</th>{DIAS.map((dia) => <th key={dia}>{dia}</th>)}</tr></thead>
            <tbody>{TURNOS.map((turno) => <tr key={turno.id}>
              <th><strong>{turno.label}</strong><small>{turno.horario}</small></th>
              {DIAS.map((dia, indice) => <td key={dia}>
                <label className="sr-only" htmlFor={`celda-${turno.id}-${indice + 1}`}>{dia}, turno {turno.label}</label>
                <select id={`celda-${turno.id}-${indice + 1}`} value={celdas[clave(indice + 1, turno.id)] ?? ""} onChange={(event) => setCeldas({ ...celdas, [clave(indice + 1, turno.id)]: event.target.value })}>
                  <option value="">Sin turno</option>
                  {catalogos?.consultorios.map((item) => <option key={item.id} value={item.id}>{item.codigo}</option>)}
                </select>
              </td>)}
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
