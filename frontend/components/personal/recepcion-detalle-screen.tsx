"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  MessageCircle,
  Printer,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { PersonalShell } from "./personal-shell";
import {
  enlaceWhatsApp,
  obtenerAgendaRecepcion,
  registrarPago,
} from "@/lib/personal-client";
import type { CitaAgendaPersonal } from "@/lib/personal-types";
import {
  ESTADO_ETIQUETA,
  formatearFechaLarga,
  formatearHora,
} from "@/lib/personal-format";

export function RecepcionDetalleScreen({ citaId }: { citaId: string }) {
  const router = useRouter();
  const [cita, setCita] = useState<CitaAgendaPersonal | null>(null);
  const [estadoCarga, setEstadoCarga] = useState<"cargando" | "listo" | "no-encontrada">(
    "cargando",
  );
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState("");
  const [mostrarConstancia, setMostrarConstancia] = useState(false);

  useEffect(() => {
    let activo = true;
    obtenerAgendaRecepcion()
      .then(({ items }) => {
        if (!activo) return;
        const encontrada = items.find((c) => c.id === citaId) ?? null;
        setCita(encontrada);
        setEstadoCarga(encontrada ? "listo" : "no-encontrada");
      })
      .catch((e: { status?: number }) => {
        if (!activo) return;
        if (e.status === 401) {
          router.replace("/personal/login");
          return;
        }
        setError("No pudimos cargar la cita. Intenta nuevamente.");
        setEstadoCarga("no-encontrada");
      });
    return () => {
      activo = false;
    };
  }, [citaId, router]);

  async function marcarPagada() {
    if (!cita || pagando) return;
    setPagando(true);
    setError("");
    try {
      const actualizada = await registrarPago(cita.id);
      setCita(actualizada);
    } catch {
      setError("No se pudo registrar el pago. Actualiza y verifica el estado de la cita.");
    } finally {
      setPagando(false);
    }
  }

  function imprimirConstancia() {
    setMostrarConstancia(true);
    // Se difiere para que la constancia esté en el DOM antes de imprimir.
    requestAnimationFrame(() => window.print());
  }

  if (estadoCarga === "cargando") {
    return (
      <PersonalShell titulo="Detalle de la cita" usuario="Recepción">
        <p className="agenda-cargando">Cargando cita…</p>
      </PersonalShell>
    );
  }

  if (!cita) {
    return (
      <PersonalShell titulo="Detalle de la cita" usuario="Recepción">
        <p className="personal-inline-error" role="alert">
          No encontramos la cita solicitada.
        </p>
        <Link className="detalle-volver" href="/personal/recepcion/agenda">
          <ArrowLeft aria-hidden="true" size={20} /> Volver a la agenda
        </Link>
      </PersonalShell>
    );
  }

  const esReservada = cita.estado === "RESERVADA";
  const esPagada = cita.estado === "PAGADA";

  return (
    <PersonalShell
      titulo="Detalle de la cita"
      subtitulo={`Código de seguimiento: ${cita.codigoReserva}`}
      usuario="Recepción"
      acciones={
        <div className="detalle-acciones">
          <button
            type="button"
            className="personal-primary-button"
            onClick={marcarPagada}
            disabled={!esReservada || pagando}
          >
            <CreditCard aria-hidden="true" size={22} />
            {pagando ? "Registrando…" : "Marcar como pagada"}
          </button>
          <button
            type="button"
            className="personal-secondary-button"
            onClick={imprimirConstancia}
            disabled={!esPagada}
          >
            <Printer aria-hidden="true" size={22} /> Imprimir constancia
          </button>
        </div>
      }
    >
      <Link className="detalle-volver" href="/personal/recepcion/agenda">
        <ArrowLeft aria-hidden="true" size={20} /> Volver a la agenda
      </Link>

      <span className={`estado-badge estado-${cita.estado.toLowerCase()} detalle-estado`}>
        {ESTADO_ETIQUETA[cita.estado]}
      </span>

      {error ? (
        <p className="personal-inline-error" role="alert">{error}</p>
      ) : null}

      <div className="detalle-grid">
        <section className="detalle-paciente-card" aria-label="Datos del paciente">
          <h2>{cita.paciente.nombre}</h2>
          <p className="detalle-dni">DNI: {cita.paciente.dni}</p>
          <div className="detalle-pares">
            <div>
              <span>Teléfono</span>
              <strong>{cita.paciente.telefono}</strong>
            </div>
            <div>
              <span>Código de reserva</span>
              <strong>{cita.codigoReserva}</strong>
            </div>
          </div>
          <a
            className="detalle-whatsapp"
            href={enlaceWhatsApp(cita)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" size={22} /> Contactar por WhatsApp
          </a>
        </section>

        <section className="detalle-cita-card" aria-label="Datos de la cita">
          <h3><CalendarDays aria-hidden="true" size={22} /> Datos de la cita</h3>
          <div className="detalle-cita-fecha">
            <span>Fecha y hora</span>
            <strong>{formatearFechaLarga(cita.inicioUtc)}</strong>
            <strong>{formatearHora(cita.inicioUtc)} – {formatearHora(cita.finUtc)}</strong>
          </div>
          <div className="detalle-cita-fecha">
            <span>Especialidad</span>
            <strong>{cita.especialidad.nombre}</strong>
          </div>
          <div className="detalle-cita-fecha">
            <span>Médico asignado</span>
            <strong>{cita.medico.nombre}</strong>
          </div>
          <div className="detalle-cita-fecha">
            <span>Consultorio</span>
            <strong>{cita.consultorio.nombre}</strong>
          </div>
        </section>
      </div>

      {mostrarConstancia ? (
        <section className="constancia" aria-label="Constancia imprimible">
          <div className="constancia-encabezado">
            <BrandMark size={56} />
            <strong>Señal de Vida Ayacucho</strong>
            <small>Constancia de pago y reserva</small>
          </div>
          <dl className="constancia-datos">
            <div><dt>Paciente</dt><dd>{cita.paciente.nombre}</dd></div>
            <div><dt>DNI / Documento</dt><dd>{cita.paciente.dni}</dd></div>
            <div><dt>Especialidad</dt><dd>{cita.especialidad.nombre}</dd></div>
            <div><dt>Médico asignado</dt><dd>{cita.medico.nombre}</dd></div>
            <div><dt>Consultorio</dt><dd>{cita.consultorio.nombre}</dd></div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>{formatearFechaLarga(cita.inicioUtc)} — {formatearHora(cita.inicioUtc)}</dd>
            </div>
            <div><dt>Código de reserva</dt><dd>{cita.codigoReserva}</dd></div>
          </dl>
          <button
            type="button"
            className="personal-primary-button constancia-imprimir"
            onClick={() => window.print()}
          >
            <Printer aria-hidden="true" size={22} /> Imprimir constancia
          </button>
        </section>
      ) : null}
    </PersonalShell>
  );
}
