"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { PersonalShell } from "./personal-shell";
import { obtenerAgendaMedico } from "@/lib/personal-client";
import type { CitaAgendaPersonal } from "@/lib/personal-types";
import {
  ESTADO_ETIQUETA,
  enmascararDni,
  formatearFechaLarga,
  formatearHora,
} from "@/lib/personal-format";

export function MedicoAgendaScreen() {
  const router = useRouter();
  const [citas, setCitas] = useState<CitaAgendaPersonal[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    obtenerAgendaMedico()
      .then((items) => {
        if (activo) setCitas(items);
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

  const fechaHoy = citas && citas.length > 0 ? formatearFechaLarga(citas[0].inicioUtc) : "";

  const resumen = useMemo(() => {
    const total = citas?.length ?? 0;
    return { total };
  }, [citas]);

  return (
    <PersonalShell
      titulo="Mi agenda"
      subtitulo={fechaHoy || undefined}
      usuario="Médico"
      acciones={
        <span className="medico-solo-lectura" aria-label="Vista de solo lectura">
          <Lock aria-hidden="true" size={20} /> Solo lectura
        </span>
      }
    >
      <p className="medico-conteo">
        Tienes <strong>{resumen.total}</strong> {resumen.total === 1 ? "cita" : "citas"} para hoy.
      </p>

      {error ? (
        <p className="personal-inline-error" role="alert">{error}</p>
      ) : null}

      {citas === null && !error ? (
        <p className="agenda-cargando">Cargando agenda…</p>
      ) : null}

      {citas !== null ? (
        <ul className="medico-agenda-lista">
          {citas.length === 0 ? (
            <li className="agenda-vacia" role="status">No tienes citas programadas para hoy.</li>
          ) : (
            citas.map((cita) => (
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
          )}
        </ul>
      ) : null}
    </PersonalShell>
  );
}
