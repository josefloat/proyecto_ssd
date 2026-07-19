"use client";

import {
  Baby,
  Bone,
  BriefcaseMedical,
  Check,
  Hand,
  HeartPulse,
  Stethoscope,
  Venus,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingShell, PrimaryFlowButton } from "./booking-shell";
import { LoadingPanel, MessagePanel } from "./resource-panel";
import { usePublicResource } from "@/hooks/use-public-resource";
import type { EspecialidadesResponse } from "@/lib/api-types";
import {
  leerSeleccion,
  limpiarSeleccionInvalida,
  seleccionarEspecialidad,
  urlPasoMedico,
} from "@/lib/booking-url";
import { presentacionEspecialidad } from "@/lib/specialty-presentation";

const emptyEspecialidades = (data: EspecialidadesResponse) => data.items.length === 0;
const ICONS = {
  briefcase: BriefcaseMedical,
  heart: HeartPulse,
  baby: Baby,
  bone: Bone,
  venus: Venus,
  hand: Hand,
  neutral: Stethoscope,
};

export function SpecialtyScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seleccion = useMemo(
    () => leerSeleccion(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [announcement, setAnnouncement] = useState("");
  const { state, retry } = usePublicResource<EspecialidadesResponse>(
    "especialidades",
    "/api/especialidades",
    emptyEspecialidades,
  );

  const items = useMemo(
    () => (state.kind === "ready" || state.kind === "empty" ? state.data.items : []),
    [state],
  );
  const selected = items.find((item) => item.id === seleccion.especialidadId);

  useEffect(() => {
    if (
      state.kind === "ready" &&
      seleccion.especialidadId &&
      !state.data.items.some((item) => item.id === seleccion.especialidadId)
    ) {
      router.replace(
        limpiarSeleccionInvalida(seleccion, "especialidad", pathname),
        { scroll: false },
      );
      requestAnimationFrame(() =>
        setAnnouncement("Esa especialidad ya no está disponible. Elige otra."),
      );
    }
  }, [pathname, router, seleccion, state]);

  const choose = useCallback(
    (id: string) => {
      setAnnouncement("");
      router.replace(seleccionarEspecialidad(id, pathname), { scroll: false });
    },
    [pathname, router],
  );

  useEffect(() => {
    if (state.kind !== "ready" || selected) return;
    const nombre = searchParams.get("nombre");
    if (!nombre) return;
    const coincidencia = items.find(
      (item) => item.nombre.toLocaleLowerCase("es") === nombre.toLocaleLowerCase("es"),
    );
    if (coincidencia) {
      router.replace(seleccionarEspecialidad(coincidencia.id, pathname), { scroll: false });
    }
  }, [state.kind, items, selected, searchParams, pathname, router]);

  return (
    <BookingShell
      step={1}
      title="¿En qué necesitas atención?"
      description="Toca una opción para elegirla."
      footer={
        <PrimaryFlowButton
          disabled={!selected}
          onClick={() => selected && router.push(urlPasoMedico(selected.id))}
        >
          Elegir especialidad
        </PrimaryFlowButton>
      }
    >
      <p className="selection-announcement" aria-live="polite">
        {announcement}
      </p>
      {state.kind === "loading" ? <LoadingPanel /> : null}
      {state.kind === "preparing" ? <LoadingPanel preparing /> : null}
      {state.kind === "offline" ? (
        <MessagePanel kind="offline" title="Parece que no tienes conexión" action="Intentar nuevamente" onAction={retry}>
          Revisa tu conexión a internet y vuelve a intentarlo.
        </MessagePanel>
      ) : null}
      {state.kind === "error" ? (
        <MessagePanel kind="error" title="No pudimos cargar las especialidades" action="Intentar nuevamente" onAction={retry}>
          El sistema no respondió después de varios intentos.
        </MessagePanel>
      ) : null}
      {state.kind === "invalid" ? (
        <MessagePanel kind="invalid" title="Necesitamos empezar otra vez">
          Vuelve a elegir una especialidad para continuar.
        </MessagePanel>
      ) : null}
      {state.kind === "empty" ? (
        <MessagePanel kind="empty" title="No hay especialidades disponibles" action="Intentar nuevamente" onAction={retry}>
          No mostraremos opciones de ejemplo. Puedes volver a consultar en unos minutos.
        </MessagePanel>
      ) : null}
      {state.kind === "ready" ? (
        <div className="specialty-grid" aria-label="Especialidades disponibles">
          {items.map((especialidad) => {
            const visual = presentacionEspecialidad(especialidad.nombre);
            const Icon = ICONS[visual.icon];
            const isSelected = selected?.id === especialidad.id;
            return (
              <button
                key={especialidad.id}
                type="button"
                className={`choice-card specialty-card tone-${visual.tone} ${isSelected ? "is-selected" : ""}`}
                aria-pressed={isSelected}
                onClick={() => choose(especialidad.id)}
              >
                {isSelected ? (
                  <span className="selected-badge">
                    <Check aria-hidden="true" size={17} /> Elegida
                  </span>
                ) : null}
                <span className="specialty-icon" aria-hidden="true">
                  <Icon size={32} />
                </span>
                <span>{especialidad.nombre}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </BookingShell>
  );
}
