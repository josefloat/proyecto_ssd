"use client";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  Copy,
  Info,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { BrandMark } from "./brand-mark";
import { MotionPage } from "./motion-page";
import type { DetalleCita } from "@/lib/api-types";
import {
  APPOINTMENT_STORAGE,
  cancelarCita,
  consultarCita,
} from "@/lib/appointment-client";

type AppointmentSession = Readonly<{
  detalle: DetalleCita;
  dni: string;
  codigoReserva: string;
}>;

const fecha = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Lima",
});
const hora = new Intl.DateTimeFormat("es-PE", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Lima",
});

function guardarSesion(sesion: AppointmentSession) {
  window.sessionStorage.setItem(APPOINTMENT_STORAGE, JSON.stringify(sesion));
}

function estadoVisible(detalle: DetalleCita) {
  if (detalle.estado === "RESERVADA") return "Pendiente de pago";
  if (detalle.estado === "CANCELADA" && detalle.motivoCancelacion === "EXPIRACION") {
    return "Reserva vencida";
  }
  if (detalle.estado === "CANCELADA") return "Cita cancelada";
  return detalle.estado.replace("_", " ").toLocaleLowerCase("es");
}

export function AppointmentSelfService() {
  const [sesion, setSesion] = useState<AppointmentSession | null>(null);
  const [dni, setDni] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmarCancelacion, setConfirmarCancelacion] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(APPOINTMENT_STORAGE);
    if (!raw) return;
    try {
      const restaurada = JSON.parse(raw) as AppointmentSession;
      const frame = requestAnimationFrame(() => setSesion(restaurada));
      return () => cancelAnimationFrame(frame);
    } catch {
      window.sessionStorage.removeItem(APPOINTMENT_STORAGE);
    }
  }, []);

  useEffect(() => {
    if (!confirmarCancelacion) return;
    const origen = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => confirmRef.current?.focus());
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmarCancelacion(false);
    };
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", cerrarConEscape);
      requestAnimationFrame(() => origen?.focus());
    };
  }, [confirmarCancelacion]);

  function contenerFoco(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const controles = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"),
    );
    if (controles.length === 0) return;
    const primero = controles[0];
    const ultimo = controles[controles.length - 1];
    if (event.shiftKey && document.activeElement === primero) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primero.focus();
    }
  }

  async function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{8}$/.test(dni) || !codigo.trim()) {
      setError("Ingresa un DNI de 8 dígitos y tu código de reserva.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setPending(true);
    setError("");
    try {
      const detalle = await consultarCita(dni, codigo);
      const nueva = { detalle, dni, codigoReserva: detalle.codigoReserva };
      guardarSesion(nueva);
      setSesion(nueva);
    } catch {
      setError("No encontramos una cita con esos datos. Revisa e intenta nuevamente.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  async function cancelar() {
    if (!sesion || pending) return;
    setPending(true);
    setError("");
    try {
      const detalle = await cancelarCita(sesion.dni, sesion.codigoReserva);
      const nueva = { ...sesion, detalle };
      guardarSesion(nueva);
      setSesion(nueva);
      setConfirmarCancelacion(false);
    } catch {
      setConfirmarCancelacion(false);
      setError("La cita ya no puede cancelarse. Actualiza la consulta.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  function volverABusqueda() {
    window.sessionStorage.removeItem(APPOINTMENT_STORAGE);
    setSesion(null);
    setError("");
    setCodigo("");
  }

  if (!sesion) {
    return (
      <div className="selfservice-shell search-mode">
        <header className="selfservice-topbar">
          <Link href="/" className="back-action">
            <ArrowLeft aria-hidden="true" size={26} /> Volver
          </Link>
          <span><BrandMark size={32} /> Señal de Vida</span>
          <i aria-hidden="true" />
        </header>
        <MotionPage className="lookup-main">
          <div className="lookup-progress" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
          <div className="lookup-illustration" aria-hidden="true">
            <ClipboardCheck size={74} />
          </div>
          <h1>Busca tu cita</h1>
          <p>Ingresa los datos que aparecen en tu comprobante.</p>
          <div
            className={`lookup-error ${error ? "is-visible" : ""}`}
            ref={errorRef}
            tabIndex={-1}
            role="alert"
          >
            {error}
          </div>
          <form className="lookup-form" onSubmit={buscar} noValidate>
            <label htmlFor="lookup-dni">DNI</label>
            <input
              id="lookup-dni"
              inputMode="numeric"
              maxLength={8}
              value={dni}
              onChange={(event) => setDni(event.target.value.replace(/\D/g, ""))}
              placeholder="Número de documento"
              autoComplete="off"
            />
            <label htmlFor="lookup-code">Código de reserva</label>
            <input
              id="lookup-code"
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.toUpperCase())}
              placeholder="Ej.: SV-ABCDEFGH"
              autoComplete="off"
            />
            <small><Info aria-hidden="true" size={18} /> El código empieza con SV-</small>
            <button type="submit" disabled={pending}>
              {pending ? "Buscando…" : "Buscar cita"}<Search aria-hidden="true" size={24} />
            </button>
          </form>
          <Link className="lookup-home-link" href="/"><ArrowLeft aria-hidden="true" /> Volver al inicio</Link>
        </MotionPage>
      </div>
    );
  }

  const { detalle } = sesion;
  const reservada = detalle.estado === "RESERVADA";
  return (
    <div className="selfservice-shell detail-mode">
      <header className="selfservice-topbar">
        <button type="button" className="back-action" onClick={volverABusqueda}>
          <ArrowLeft aria-hidden="true" size={26} /> Volver
        </button>
        <span>Mi cita</span>
        <i aria-hidden="true" />
      </header>
      <MotionPage className="appointment-detail-main">
        <span className={`appointment-state state-${detalle.estado.toLowerCase()}`}>
          <ClipboardCheck aria-hidden="true" size={22} /> {estadoVisible(detalle)}
        </span>
        <div
          className={`lookup-error ${error ? "is-visible" : ""}`}
          ref={errorRef}
          tabIndex={-1}
          role="alert"
        >
          {error}
        </div>
        <section className="patient-appointment-card" aria-label="Detalle de la cita">
          <div className="patient-name-row">
            <div><span>Paciente</span><h1>{detalle.paciente.nombre}</h1></div>
            <i aria-hidden="true"><UserRound size={31} /></i>
          </div>
          <div className="detail-pair">
            <div><span>Especialidad</span><strong>{detalle.slot.especialidad.nombre}</strong></div>
            <div><span>Médico</span><strong>{detalle.slot.medico.nombre}</strong></div>
          </div>
          <div className="appointment-date-block">
            <CalendarDays aria-hidden="true" size={29} />
            <div>
              <strong>{fecha.format(new Date(detalle.slot.inicioUtc))}</strong>
              <span><Clock3 aria-hidden="true" size={20} /> {hora.format(new Date(detalle.slot.inicioUtc))}</span>
              <small>{detalle.slot.consultorio.nombre}</small>
            </div>
          </div>
          <div className="detail-code-row">
            <div><span>Código de reserva</span><strong>{detalle.codigoReserva}</strong></div>
            <button
              type="button"
              aria-label="Copiar código de reserva"
              onClick={async () => {
                await navigator.clipboard.writeText(detalle.codigoReserva);
                setCopiado(true);
              }}
            >
              {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </button>
          </div>
        </section>

        {reservada ? (
          <aside className="detail-payment-card">
            <Info aria-hidden="true" size={27} />
            <div>
              <strong>Información de pago</strong>
              <p>El pago se realiza en la clínica. Paga antes del <b>{fecha.format(new Date(detalle.venceEn))}, {hora.format(new Date(detalle.venceEn))}</b>.</p>
            </div>
          </aside>
        ) : (
          <aside className="detail-cancelled-card" role="status">
            <XCircle aria-hidden="true" size={27} />
            <div><strong>{estadoVisible(detalle)}</strong><p>Este horario ya fue liberado.</p></div>
          </aside>
        )}

        <section className="clinic-location-card">
          <Stethoscope aria-hidden="true" size={30} />
          <div><strong>Clínica Señal de Vida</strong><span>Ayacucho</span></div>
          <ShieldCheck aria-hidden="true" size={28} />
        </section>

        {reservada ? (
          <button
            ref={cancelTriggerRef}
            type="button"
            className="cancel-appointment-button"
            onClick={() => setConfirmarCancelacion(true)}
          >
            <XCircle aria-hidden="true" size={24} /> Cancelar cita
          </button>
        ) : null}
        <Link className="detail-home-link" href="/">Volver al inicio</Link>
      </MotionPage>

      {confirmarCancelacion ? (
        <div className="dialog-backdrop">
          <section
            ref={dialogRef}
            className="cancel-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            onKeyDown={contenerFoco}
          >
            <XCircle aria-hidden="true" size={38} />
            <h2 id="cancel-title">¿Cancelar esta cita?</h2>
            <p>El horario quedará libre para otra persona. Esta acción no se puede deshacer.</p>
            <div>
              <button type="button" onClick={() => setConfirmarCancelacion(false)}>
                Conservar cita
              </button>
              <button
                ref={confirmRef}
                type="button"
                className="confirm-cancel-button"
                onClick={cancelar}
                disabled={pending}
              >
                {pending ? "Cancelando…" : "Sí, cancelar cita"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
