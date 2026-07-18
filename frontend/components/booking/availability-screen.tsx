"use client";

import { ArrowRight, CalendarDays, Check, Clock3, Moon, Stethoscope, Sun, Sunset } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookingShell, PrimaryFlowButton } from "./booking-shell";
import { LoadingPanel, MessagePanel } from "./resource-panel";
import { usePublicResource } from "@/hooks/use-public-resource";
import type {
  DisponibilidadResponse,
  MedicosResponse,
  SlotDto,
} from "@/lib/api-types";
import {
  leerSeleccion,
  limpiarSeleccionInvalida,
  rutaPrimerPasoIncompleto,
  seleccionarFecha,
  seleccionarSlot,
  urlPasoDatos,
} from "@/lib/booking-url";

const emptyDisponibilidad = (data: DisponibilidadResponse) => data.items.length === 0;
const emptyMedicos = (data: MedicosResponse) => data.items.length === 0;

const fechaFormatter = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const horaFormatter = new Intl.DateTimeFormat("es-PE", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Lima",
});
const hora24Formatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Lima",
});
const mesFormatter = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const fechaLargaFormatter = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

type CeldaCalendario = Readonly<{
  fecha: string;
  dia: number;
  etiqueta: string;
}>;

type MesCalendario = Readonly<{
  clave: string;
  titulo: string;
  vaciasIniciales: number;
  celdas: readonly CeldaCalendario[];
}>;

// Agrupa el horizonte de 28 días por mes y alinea cada mes por día de la
// semana ISO (lunes primero) para dibujar una grilla de calendario real.
function mesesCalendario(fechas: readonly string[]): MesCalendario[] {
  const meses = new Map<string, string[]>();
  for (const fecha of fechas) {
    const claveMes = fecha.slice(0, 7);
    const lista = meses.get(claveMes) ?? [];
    lista.push(fecha);
    meses.set(claveMes, lista);
  }
  return [...meses.entries()].map(([claveMes, dias]) => {
    const primera = new Date(`${dias[0]}T12:00:00.000Z`);
    const diaIso = primera.getUTCDay() === 0 ? 7 : primera.getUTCDay();
    return {
      clave: claveMes,
      titulo: mesFormatter.format(primera),
      vaciasIniciales: diaIso - 1,
      celdas: dias.map((fecha) => ({
        fecha,
        dia: Number(fecha.slice(8, 10)),
        etiqueta: fechaLargaFormatter.format(new Date(`${fecha}T12:00:00.000Z`)),
      })),
    };
  });
}

type GrupoTurno = "Mañana" | "Tarde" | "Noche";

function grupoTurno(slot: SlotDto): GrupoTurno {
  const hora = Number(hora24Formatter.format(new Date(slot.inicioUtc)));
  if (hora < 13) return "Mañana";
  if (hora < 19) return "Tarde";
  return "Noche";
}

function iconoTurno(grupo: GrupoTurno) {
  if (grupo === "Mañana") return Sun;
  if (grupo === "Tarde") return Sunset;
  return Moon;
}

export function AvailabilityScreen({
  fotosMedicos = {},
}: {
  fotosMedicos?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seleccion = useMemo(
    () => leerSeleccion(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const redirect = rutaPrimerPasoIncompleto(pathname, seleccion);
  const [announcement, setAnnouncement] = useState("");
  const [verCalendario, setVerCalendario] = useState(false);
  const announcementRef = useRef<HTMLParagraphElement>(null);
  const availabilityUrl =
    seleccion.especialidadId && seleccion.medicoId
      ? `/api/disponibilidad?especialidadId=${encodeURIComponent(seleccion.especialidadId)}&medicoId=${encodeURIComponent(seleccion.medicoId)}`
      : null;
  const doctorsUrl = seleccion.especialidadId
    ? `/api/especialidades/${encodeURIComponent(seleccion.especialidadId)}/medicos`
    : null;
  const availability = usePublicResource<DisponibilidadResponse>(
    `disponibilidad:${seleccion.especialidadId}:${seleccion.medicoId}`,
    availabilityUrl,
    emptyDisponibilidad,
  );
  const doctors = usePublicResource<MedicosResponse>(
    `resumen-medico:${seleccion.especialidadId}`,
    doctorsUrl,
    emptyMedicos,
  );

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  const data =
    availability.state.kind === "ready" || availability.state.kind === "empty"
      ? availability.state.data
      : null;
  const doctorData =
    doctors.state.kind === "ready" || doctors.state.kind === "empty"
      ? doctors.state.data
      : null;
  const medico = doctorData?.items.find((item) => item.id === seleccion.medicoId);
  useEffect(() => {
    if (!data) return;
    if (seleccion.fechaLima && !data.horizonte.fechas.includes(seleccion.fechaLima)) {
      router.replace(limpiarSeleccionInvalida(seleccion, "fecha", pathname), {
        scroll: false,
      });
      requestAnimationFrame(() => {
        setAnnouncement(
          "Esa fecha ya no pertenece al horizonte disponible. Elige otra.",
        );
        announcementRef.current?.focus();
      });
      return;
    }
    if (seleccion.slotId && !data.items.some((slot) => slot.id === seleccion.slotId)) {
      router.replace(limpiarSeleccionInvalida(seleccion, "slot", pathname), {
        scroll: false,
      });
      requestAnimationFrame(() => {
        setAnnouncement("Ese horario ya no está disponible. Elige otro.");
        announcementRef.current?.focus();
      });
    }
  }, [data, pathname, router, seleccion]);

  useEffect(() => {
    if (
      availability.state.kind === "invalid" &&
      (availability.state.status === 404 || availability.state.status === 422)
    ) {
      router.replace(limpiarSeleccionInvalida(seleccion, "medico", "/reservar/medico"));
    }
  }, [availability.state, router, seleccion]);

  const slotsFecha = data?.items.filter((slot) => slot.fechaLima === seleccion.fechaLima) ?? [];
  const selectedSlot = slotsFecha.find((slot) => slot.id === seleccion.slotId);
  const grupos = (["Mañana", "Tarde", "Noche"] as const).map((nombre) => ({
    nombre,
    slots: slotsFecha.filter((slot) => grupoTurno(slot) === nombre),
  }));

  const loading =
    availability.state.kind === "loading" || doctors.state.kind === "loading";
  const preparing =
    availability.state.kind === "preparing" || doctors.state.kind === "preparing";

  return (
    <BookingShell
      step={3}
      title="Elige la fecha y la hora"
      footer={
        <PrimaryFlowButton
          disabled={!selectedSlot}
          onClick={() => {
            if (selectedSlot) router.push(urlPasoDatos(seleccion));
          }}
        >
          Continuar <ArrowRight aria-hidden="true" size={23} />
        </PrimaryFlowButton>
      }
    >
      <p
        className="selection-announcement"
        aria-live="assertive"
        ref={announcementRef}
        tabIndex={-1}
      >
        {announcement}
      </p>

      {medico && data ? (
        <section className="doctor-summary" aria-label="Selección actual">
          <span className="doctor-avatar" aria-hidden="true">
            {fotosMedicos[medico.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotosMedicos[medico.id]} alt="" />
            ) : (
              medico.nombre
                .replace(/^(Dr\.|Dra\.)\s*/i, "")
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
            )}
          </span>
          <span>
            <strong>{medico.nombre}</strong>
            <small>{data.especialidad.nombre}</small>
          </span>
          <button type="button" onClick={() => router.push(`/reservar/medico?especialidadId=${data.especialidad.id}`)}>
            Cambiar
          </button>
        </section>
      ) : null}

      {loading && !preparing ? <LoadingPanel /> : null}
      {preparing ? <LoadingPanel preparing /> : null}
      {availability.state.kind === "offline" || doctors.state.kind === "offline" ? (
        <MessagePanel kind="offline" title="Parece que no tienes conexión" action="Intentar nuevamente" onAction={() => { availability.retry(); doctors.retry(); }}>
          Revisa tu conexión y vuelve a intentarlo.
        </MessagePanel>
      ) : null}
      {availability.state.kind === "error" || doctors.state.kind === "error" ? (
        <MessagePanel kind="error" title="No pudimos cargar los horarios" action="Intentar nuevamente" onAction={() => { availability.retry(); doctors.retry(); }}>
          El sistema no respondió después de varios intentos.
        </MessagePanel>
      ) : null}
      {availability.state.kind === "invalid" || doctors.state.kind === "invalid" ? (
        <MessagePanel kind="invalid" title="La selección necesita actualizarse">
          Te llevaremos al paso correcto para elegir nuevamente.
        </MessagePanel>
      ) : null}

      {data ? (
        <>
          <section className="date-section" aria-labelledby="date-title">
            <div className="section-title-row">
              <h2 id="date-title">Próximos 28 días</h2>
              <div className="date-tools">
                <span>Hora local de Ayacucho</span>
                <button
                  type="button"
                  className="cal-toggle"
                  aria-expanded={verCalendario}
                  onClick={() => setVerCalendario((visible) => !visible)}
                >
                  <CalendarDays aria-hidden="true" size={22} />
                  {verCalendario ? "Ocultar calendario" : "Ver calendario"}
                </button>
              </div>
            </div>
            {verCalendario ? (
              <div className="cal-panel" role="group" aria-label="Calendario de fechas del horizonte">
                {mesesCalendario(data.horizonte.fechas).map((mes) => (
                  <div key={mes.clave} className="cal-mes">
                    <strong className="cal-mes-titulo">{mes.titulo}</strong>
                    <div className="cal-grid">
                      {["L", "M", "X", "J", "V", "S", "D"].map((letra, indice) => (
                        <span key={`${letra}-${indice}`} className="cal-dow" aria-hidden="true">{letra}</span>
                      ))}
                      {Array.from({ length: mes.vaciasIniciales }, (_, indice) => (
                        <span key={`vacia-${indice}`} className="cal-void" aria-hidden="true" />
                      ))}
                      {mes.celdas.map((celda) => {
                        const isSelected = seleccion.fechaLima === celda.fecha;
                        const hasSlots = data.items.some((slot) => slot.fechaLima === celda.fecha);
                        return (
                          <button
                            type="button"
                            key={celda.fecha}
                            className={`cal-day${isSelected ? " is-selected" : ""}${hasSlots ? " has-slots" : ""}`}
                            aria-pressed={isSelected}
                            aria-label={`${celda.etiqueta}${hasSlots ? ", con horarios" : ", sin horarios"}`}
                            onClick={() => {
                              setAnnouncement("");
                              router.replace(seleccionarFecha(seleccion, celda.fecha, pathname), { scroll: false });
                            }}
                          >
                            {celda.dia}
                            <i aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="date-rail" aria-label="Fechas disponibles">
              {data.horizonte.fechas.map((fecha) => {
                const [weekday, day, month] = fechaFormatter
                  .format(new Date(`${fecha}T12:00:00.000Z`))
                  .replace(".", "")
                  .split(" ");
                const isSelected = seleccion.fechaLima === fecha;
                const hasSlots = data.items.some((slot) => slot.fechaLima === fecha);
                return (
                  <button
                    type="button"
                    key={fecha}
                    className={`date-card ${isSelected ? "is-selected" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setAnnouncement("");
                      router.replace(seleccionarFecha(seleccion, fecha, pathname), { scroll: false });
                    }}
                  >
                    <span>{weekday}</span>
                    <strong>{day}</strong>
                    <small>{month}</small>
                    <i
                      className={hasSlots ? "has-slots" : ""}
                      role="img"
                      aria-label={hasSlots ? "Con horarios" : "Sin horarios"}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          {availability.state.kind === "empty" ? (
            <MessagePanel kind="empty" title="No hay horarios disponibles">
              Conservamos las 28 fechas del horizonte. Cambia de médico para buscar otras opciones.
            </MessagePanel>
          ) : !seleccion.fechaLima ? (
            <MessagePanel kind="empty" title="Elige una fecha">
              Las fechas con un punto azul tienen horarios libres.
            </MessagePanel>
          ) : slotsFecha.length === 0 ? (
            <MessagePanel kind="empty" title="No hay horarios ese día">
              Elige otra fecha o cambia de médico para encontrar disponibilidad.
            </MessagePanel>
          ) : (
            <div className="time-groups" aria-label="Horarios libres">
              {grupos
                .filter((grupo) => grupo.slots.length > 0)
                .map((grupo) => {
                  const Icon = iconoTurno(grupo.nombre);
                  return (
                    <section key={grupo.nombre} className="time-group">
                      <h2><Icon aria-hidden="true" size={25} /> {grupo.nombre}</h2>
                      <div>
                        {grupo.slots.map((slot) => {
                          const isSelected = selectedSlot?.id === slot.id;
                          return (
                            <button
                              type="button"
                              key={slot.id}
                              className={`time-slot ${isSelected ? "is-selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() => {
                                setAnnouncement("");
                                router.replace(seleccionarSlot(seleccion, slot.id, pathname), { scroll: false });
                              }}
                            >
                              <span><Clock3 aria-hidden="true" size={22} /> {horaFormatter.format(new Date(slot.inicioUtc))}</span>
                              <small>{slot.consultorio.nombre}</small>
                              {isSelected ? <Check aria-hidden="true" size={24} /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
            </div>
          )}

          {selectedSlot ? (
            <>
              <section className="slot-summary" aria-label="Horario seleccionado">
                <Stethoscope aria-hidden="true" size={27} />
                <div>
                  <strong>Horario seleccionado</strong>
                  <span>
                    {selectedSlot.fechaLima} · {horaFormatter.format(new Date(selectedSlot.inicioUtc))} · {selectedSlot.consultorio.nombre}
                  </span>
                </div>
              </section>
              <p className="reservation-warning">
                Este horario todavía no está reservado. Revisa tus datos y confirma en el siguiente paso.
              </p>
            </>
          ) : data ? (
            <p className="reservation-warning">
              Selecciona un horario. Elegirlo todavía no crea una reserva.
            </p>
          ) : null}
        </>
      ) : null}
    </BookingShell>
  );
}
