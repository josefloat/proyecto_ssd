"use client";

import { Check, HeartPulse } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookingShell, PrimaryFlowButton } from "./booking-shell";
import { LoadingPanel, MessagePanel } from "./resource-panel";
import { usePublicResource } from "@/hooks/use-public-resource";
import type { MedicosResponse } from "@/lib/api-types";
import {
  leerSeleccion,
  limpiarSeleccionInvalida,
  rutaPrimerPasoIncompleto,
  seleccionarMedico,
  urlPasoFechaHora,
} from "@/lib/booking-url";

const emptyMedicos = (data: MedicosResponse) => data.items.length === 0;

function iniciales(nombre: string): string {
  return nombre
    .replace(/^(Dr\.|Dra\.)\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toLocaleUpperCase("es"))
    .join("");
}

export function DoctorScreen({
  fotosMedicos = {},
}: {
  // Retratos gestionados por el ADMIN (clave = id del médico). Si un médico
  // no tiene foto, se mantienen las iniciales — nunca fotos inventadas.
  fotosMedicos?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seleccion = useMemo(
    () => leerSeleccion(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [announcement, setAnnouncement] = useState("");
  const redirect = rutaPrimerPasoIncompleto(pathname, seleccion);
  const url = seleccion.especialidadId
    ? `/api/especialidades/${encodeURIComponent(seleccion.especialidadId)}/medicos`
    : null;
  const { state, retry } = usePublicResource<MedicosResponse>(
    `medicos:${seleccion.especialidadId ?? "invalida"}`,
    url,
    emptyMedicos,
  );

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  useEffect(() => {
    if (
      state.kind === "ready" &&
      seleccion.medicoId &&
      !state.data.items.some((item) => item.id === seleccion.medicoId)
    ) {
      router.replace(limpiarSeleccionInvalida(seleccion, "medico", pathname), {
        scroll: false,
      });
      requestAnimationFrame(() =>
        setAnnouncement("Ese médico ya no está disponible. Elige otro."),
      );
    }
  }, [pathname, router, seleccion, state]);

  const data = state.kind === "ready" || state.kind === "empty" ? state.data : null;
  const selected = data?.items.find((item) => item.id === seleccion.medicoId);

  return (
    <BookingShell
      step={2}
      title="Elige a tu médico"
      description="Selecciona al profesional con quien deseas atenderte."
      footer={
        <PrimaryFlowButton
          disabled={!selected}
          onClick={() => selected && router.push(urlPasoFechaHora(seleccion))}
        >
          Elegir médico
        </PrimaryFlowButton>
      }
    >
      <p className="selection-announcement" aria-live="polite">
        {announcement}
      </p>
      {data ? (
        <section className="selection-summary" aria-label="Especialidad seleccionada">
          <span className="summary-icon" aria-hidden="true"><HeartPulse size={29} /></span>
          <span><small>Especialidad</small><strong>{data.especialidad.nombre}</strong></span>
          <button type="button" onClick={() => router.push("/reservar/especialidad")}>Cambiar</button>
        </section>
      ) : null}
      {state.kind === "loading" ? <LoadingPanel /> : null}
      {state.kind === "preparing" ? <LoadingPanel preparing /> : null}
      {state.kind === "offline" ? <MessagePanel kind="offline" title="Parece que no tienes conexión" action="Intentar nuevamente" onAction={retry}>Revisa tu conexión y vuelve a intentarlo.</MessagePanel> : null}
      {state.kind === "error" ? <MessagePanel kind="error" title="No pudimos cargar los médicos" action="Intentar nuevamente" onAction={retry}>El sistema no respondió después de varios intentos.</MessagePanel> : null}
      {state.kind === "invalid" ? <MessagePanel kind="invalid" title="Elige primero una especialidad">Te llevaremos al paso correcto para continuar.</MessagePanel> : null}
      {state.kind === "empty" ? <MessagePanel kind="empty" title="No hay médicos disponibles">Cambia de especialidad para ver otras opciones.</MessagePanel> : null}
      {state.kind === "ready" ? (
        <div className="doctor-list" aria-label="Médicos disponibles">
          {state.data.items.map((medico) => {
            const isSelected = selected?.id === medico.id;
            return (
              <button
                type="button"
                key={medico.id}
                className={`choice-card doctor-card ${isSelected ? "is-selected" : ""}`}
                aria-pressed={isSelected}
                onClick={() => {
                  setAnnouncement("");
                  router.replace(seleccionarMedico(seleccion, medico.id, pathname), { scroll: false });
                }}
              >
                <span className="doctor-avatar" aria-hidden="true">
                  {fotosMedicos[medico.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotosMedicos[medico.id]} alt="" />
                  ) : (
                    iniciales(medico.nombre)
                  )}
                </span>
                <span className="doctor-copy"><strong>{medico.nombre}</strong><small>{state.data.especialidad.nombre}</small></span>
                {isSelected ? <span className="selected-badge"><Check aria-hidden="true" size={17} /> Seleccionado</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </BookingShell>
  );
}
