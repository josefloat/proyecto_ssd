"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { PersonalShell } from "./personal-shell";
import { obtenerAgendaMedico } from "@/lib/personal-client";
import type { AgendaResponse } from "@/lib/personal-types";
import {
  ESTADO_ETIQUETA,
  enmascararDni,
  formatearFechaCivil,
  formatearHora,
  sumarDiasCivil,
} from "@/lib/personal-format";

export function MedicoAgendaScreen() {
  const router = useRouter();
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    obtenerAgendaMedico()
      .then((respuesta) => {
        if (activo) setAgenda(respuesta);
      })
      .catch((e: { status?: number }) => {
        if (!activo) return;
        if (e.status === 401) {
          router.replace("/personal/login");
          return;
        }
        setError("No pudimos cargar tu agenda. Intenta nuevamente.");
      });
    return () => {
      activo = false;
    };
  }, [router]);

  const resumen = useMemo(() => {
    const total = agenda?.items.length ?? 0;
    return { total };
  }, [agenda]);

  const dias = useMemo(() => agenda
    ? Array.from({ length: 7 }, (_, indice) => {
        const fecha = sumarDiasCivil(agenda.desde, indice);
        return { fecha, citas: agenda.items.filter((cita) => cita.fechaLima === fecha) };
      })
    : [], [agenda]);

  return (
    <PersonalShell
      titulo="Mi agenda"
      subtitulo={agenda ? `${formatearFechaCivil(agenda.desde)} · próximos 7 días` : undefined}
      usuario="Médico"
      acciones={
        <span className="medico-solo-lectura" aria-label="Vista de solo lectura">
          <Lock aria-hidden="true" size={20} /> Solo lectura
        </span>
      }
    >
      <p className="medico-conteo">
        Tienes <strong>{resumen.total}</strong> {resumen.total === 1 ? "cita" : "citas"} entre hoy y los próximos seis días.
      </p>

      {error ? (
        <p className="personal-inline-error" role="alert">{error}</p>
      ) : null}

      {agenda === null && !error ? (
        <p className="agenda-cargando">Cargando agenda…</p>
      ) : null}

      {agenda !== null ? (
        <div className="agenda-semana" aria-label="Agenda médica de los próximos siete días">
          {dias.map((dia) => <section className="agenda-dia" key={dia.fecha}>
            <h2>{formatearFechaCivil(dia.fecha)}</h2>
            <ul className="medico-agenda-lista">
          {dia.citas.length === 0 ? (
            <li className="agenda-vacia">Sin citas</li>
          ) : (
            dia.citas.map((cita) => (
              <li className="medico-cita" key={cita.id}>
                <span className="medico-cita-hora">{formatearHora(cita.inicioUtc)}</span>
                <span className="medico-cita-datos">
                  <strong>{cita.paciente.nombre}</strong>
                  <small>DNI: {enmascararDni(cita.paciente.dni)} · {cita.especialidad.nombre}</small>
                </span>
                <span className={`estado-badge estado-${cita.estado.toLowerCase()}`}>
                  {ESTADO_ETIQUETA[cita.estado]}
                </span>
              </li>
            ))
          )}</ul></section>)}
        </div>
      ) : null}
    </PersonalShell>
  );
}
