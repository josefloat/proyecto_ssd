"use client";

import {
  CalendarCheck2,
  Check,
  Clock3,
  Copy,
  Home,
  Search,
  TimerReset,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { MotionPage } from "@/components/motion-page";
import type { DetalleCita } from "@/lib/api-types";
import { CONFIRMATION_STORAGE } from "@/lib/appointment-client";

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

export function BookingConfirmationScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [detalle, setDetalle] = useState<DetalleCita | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(CONFIRMATION_STORAGE);
    if (!raw) {
      const regreso = new URLSearchParams(searchParams.toString());
      regreso.set("aviso", "confirmacion-perdida");
      router.replace(`/reservar/datos?${regreso.toString()}`);
      return;
    }
    try {
      const restaurada = JSON.parse(raw) as DetalleCita;
      const frame = requestAnimationFrame(() => setDetalle(restaurada));
      return () => cancelAnimationFrame(frame);
    } catch {
      const regreso = new URLSearchParams(searchParams.toString());
      regreso.set("aviso", "confirmacion-perdida");
      router.replace(`/reservar/datos?${regreso.toString()}`);
    }
  }, [router, searchParams]);

  if (!detalle) {
    return <div className="route-fallback" role="status">Recuperando tu confirmación…</div>;
  }

  async function copiar() {
    await navigator.clipboard.writeText(detalle!.codigoReserva);
    setCopiado(true);
  }

  return (
    <div className="confirmation-shell">
      <header className="confirmation-topbar">
        <span><BrandMark size={32} /> Señal de Vida</span>
        <Link href="/" aria-label="Cerrar y volver al inicio">
          <X aria-hidden="true" size={28} />
        </Link>
      </header>
      <MotionPage className="confirmation-main">
        <div
          className="confirmation-progress"
          role="progressbar"
          aria-label="Progreso de la reserva"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={5}
          aria-valuetext="Paso 5 de 5"
        >
          {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
        </div>
        <div className="success-seal" aria-hidden="true">
          <CalendarCheck2 size={54} />
          <i><Check size={30} /></i>
        </div>
        <p className="success-step">Paso 5 de 5</p>
        <h1>Tu cita está reservada</h1>

        <section className="reservation-code-card" aria-label="Código de reserva">
          <span>Código de reserva</span>
          <strong>{detalle.codigoReserva}</strong>
          <button type="button" onClick={copiar}>
            {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copiado ? "Código copiado" : "Copiar código"}
          </button>
        </section>

        <section className="confirmation-status-card">
          <CalendarCheck2 aria-hidden="true" size={27} />
          <div><strong>Estado de cita</strong><span>Horario confirmado</span></div>
          <b>Pendiente de pago</b>
        </section>

        <section className="deadline-card">
          <TimerReset aria-hidden="true" size={30} />
          <div>
            <span>Plazo máximo</span>
            <strong>Paga en la clínica antes de:</strong>
            <b>{fecha.format(new Date(detalle.venceEn))}</b>
            <p><Clock3 aria-hidden="true" size={20} /> {hora.format(new Date(detalle.venceEn))}</p>
            <small>Si no se registra el pago, el horario se liberará automáticamente.</small>
          </div>
        </section>

        <section className="confirmed-appointment-summary">
          <strong>{detalle.slot.especialidad.nombre}</strong>
          <span>{detalle.slot.medico.nombre}</span>
          <p>{fecha.format(new Date(detalle.slot.inicioUtc))} · {hora.format(new Date(detalle.slot.inicioUtc))}</p>
          <small>{detalle.slot.consultorio.nombre}</small>
        </section>

        <div className="confirmation-actions">
          <Link className="primary-confirmation-link" href="/mi-cita">
            <Search aria-hidden="true" size={23} /> Ver mi cita
          </Link>
          <Link className="secondary-confirmation-link" href="/">
            <Home aria-hidden="true" size={22} /> Volver al inicio
          </Link>
        </div>
      </MotionPage>
    </div>
  );
}
