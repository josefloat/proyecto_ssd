"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Filter } from "lucide-react";
import { PersonalShell } from "./personal-shell";
import { obtenerAgendaRecepcion } from "@/lib/personal-client";
import type { AgendaResponse, FiltrosAgenda } from "@/lib/personal-types";
import type { EstadoCita } from "@/lib/api-types";
import {
  ESTADO_ETIQUETA,
  enmascararDni,
  formatearFechaCivil,
  formatearHora,
  sumarDiasCivil,
} from "@/lib/personal-format";

const ESTADOS: EstadoCita[] = [
  "RESERVADA",
  "PAGADA",
  "ATENDIDA",
  "NO_ASISTIO",
  "CANCELADA",
];

export function RecepcionAgendaScreen() {
  const router = useRouter();
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState<FiltrosAgenda>({});

  useEffect(() => {
    let activo = true;
    obtenerAgendaRecepcion()
      .then((respuesta) => {
        if (activo) setAgenda(respuesta);
      })
      .catch((e: { status?: number }) => {
        if (!activo) return;
        if (e.status === 401) {
          router.replace("/personal/login");
          return;
        }
        setError("No pudimos cargar la agenda. Intenta nuevamente.");
      });
    return () => {
      activo = false;
    };
  }, [router]);

  const especialidades = useMemo(() => {
    const mapa = new Map<string, string>();
    (agenda?.items ?? []).forEach((c) => mapa.set(c.especialidad.id, c.especialidad.nombre));
    return [...mapa.entries()];
  }, [agenda]);

  const medicos = useMemo(() => {
    const mapa = new Map<string, string>();
    (agenda?.items ?? []).forEach((c) => mapa.set(c.medico.id, c.medico.nombre));
    return [...mapa.entries()];
  }, [agenda]);

  const visibles = useMemo(() => {
    return (agenda?.items ?? []).filter((c) => {
      if (filtros.especialidadId && c.especialidad.id !== filtros.especialidadId) return false;
      if (filtros.medicoId && c.medico.id !== filtros.medicoId) return false;
      if (filtros.estado && c.estado !== filtros.estado) return false;
      return true;
    });
  }, [agenda, filtros]);

  const dias = useMemo(() => agenda
    ? Array.from({ length: 7 }, (_, indice) => {
        const fecha = sumarDiasCivil(agenda.desde, indice);
        return { fecha, citas: visibles.filter((cita) => cita.fechaLima === fecha) };
      })
    : [], [agenda, visibles]);

  return (
    <PersonalShell
      titulo="Agenda de los próximos 7 días"
      subtitulo={agenda ? `Desde ${formatearFechaCivil(agenda.desde)}` : undefined}
      usuario="Recepción"
    >
      <section className="agenda-filtros" aria-label="Filtros de la agenda">
        <div className="agenda-filtros-header">
          <Filter aria-hidden="true" size={20} /> Filtros
        </div>
        <div className="agenda-filtros-grid">
          <label>
            Especialidad
            <select
              value={filtros.especialidadId ?? ""}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, especialidadId: e.target.value || undefined }))
              }
            >
              <option value="">Todas las especialidades</option>
              {especialidades.map(([id, nombre]) => (
                <option key={id} value={id}>{nombre}</option>
              ))}
            </select>
          </label>
          <label>
            Médico
            <select
              value={filtros.medicoId ?? ""}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, medicoId: e.target.value || undefined }))
              }
            >
              <option value="">Todos los médicos</option>
              {medicos.map(([id, nombre]) => (
                <option key={id} value={id}>{nombre}</option>
              ))}
            </select>
          </label>
          <label>
            Estado de cita
            <select
              value={filtros.estado ?? ""}
              onChange={(e) =>
                setFiltros((f) => ({
                  ...f,
                  estado: (e.target.value || undefined) as EstadoCita | undefined,
                }))
              }
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>{ESTADO_ETIQUETA[estado]}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="agenda-limpiar"
            onClick={() => setFiltros({})}
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      {error ? (
        <p className="personal-inline-error" role="alert">{error}</p>
      ) : null}

      {agenda === null && !error ? (
        <p className="agenda-cargando">Cargando agenda…</p>
      ) : null}

      {agenda !== null ? (
        <div className="agenda-semana" aria-label="Citas de los próximos siete días">
          {dias.map((dia) => <section className="agenda-dia" key={dia.fecha}>
          <h2>{formatearFechaCivil(dia.fecha)}</h2>
        <div className="agenda-tabla" aria-label={`Citas del ${dia.fecha}`}>
          <div className="agenda-row agenda-head" aria-hidden="true">
            <span>Hora</span>
            <span>Paciente</span>
            <span>Médico / Especialidad</span>
            <span>Estado</span>
            <span>Acción</span>
          </div>
          {dia.citas.length === 0 ? (
            <p className="agenda-vacia" role="status">
              Sin citas
            </p>
          ) : (
            dia.citas.map((cita) => (
              <div className="agenda-row" key={cita.id}>
                <span className="agenda-hora">{formatearHora(cita.inicioUtc)}</span>
                <span className="agenda-paciente">
                  <strong>{cita.paciente.nombre}</strong>
                  <small>DNI: {enmascararDni(cita.paciente.dni)}</small>
                </span>
                <span className="agenda-medico">
                  <strong>{cita.medico.nombre}</strong>
                  <small>{cita.especialidad.nombre}</small>
                </span>
                <span>
                  <span className={`estado-badge estado-${cita.estado.toLowerCase()}`}>
                    {ESTADO_ETIQUETA[cita.estado]}
                  </span>
                </span>
                <span>
                  <Link
                    className="agenda-detalle-link"
                    href={`/personal/recepcion/citas/${cita.id}`}
                    aria-label={`Ver detalle de la cita de ${cita.paciente.nombre}`}
                  >
                    Ver detalle <ChevronRight aria-hidden="true" size={20} />
                  </Link>
                </span>
              </div>
            ))
          )}</div></section>)}
        </div>
      ) : null}
    </PersonalShell>
  );
}
