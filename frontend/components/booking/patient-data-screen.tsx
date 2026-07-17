"use client";

import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  CreditCard,
  ShieldCheck,
  Stethoscope,
  TimerReset,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookingShell, PrimaryFlowButton } from "./booking-shell";
import { LoadingPanel, MessagePanel } from "./resource-panel";
import { usePublicResource } from "@/hooks/use-public-resource";
import type { DetalleCita, DisponibilidadResponse } from "@/lib/api-types";
import {
  APPOINTMENT_STORAGE,
  CONFIRMATION_STORAGE,
  idempotencyKeyParaSlot,
  reservarCita,
  type BookingFailure,
} from "@/lib/appointment-client";
import {
  leerSeleccion,
  limpiarSeleccionInvalida,
  rutaPrimerPasoIncompleto,
} from "@/lib/booking-url";

const fechaLarga = new Intl.DateTimeFormat("es-PE", {
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

const vacio = (data: DisponibilidadResponse) => data.items.length === 0;

function validarFormulario(dni: string, nombre: string, telefono: string) {
  if (!/^\d{8}$/.test(dni.trim())) {
    return { field: "dni" as const, message: "Ingresa un DNI válido de 8 dígitos." };
  }
  if (!nombre.trim()) {
    return { field: "nombre" as const, message: "Ingresa el nombre completo." };
  }
  if (!/^\d{9}$/.test(telefono.replace(/[\s-]/g, ""))) {
    return {
      field: "telefono" as const,
      message: "Ingresa un número de celular válido de 9 dígitos.",
    };
  }
  return null;
}

export function PatientDataScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seleccion = useMemo(
    () => leerSeleccion(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const redirect = rutaPrimerPasoIncompleto(pathname, seleccion);
  const confirmacionPerdida = searchParams.get("aviso") === "confirmacion-perdida";
  const availabilityUrl =
    seleccion.especialidadId && seleccion.medicoId
      ? `/api/disponibilidad?especialidadId=${encodeURIComponent(seleccion.especialidadId)}&medicoId=${encodeURIComponent(seleccion.medicoId)}`
      : null;
  const availability = usePublicResource<DisponibilidadResponse>(
    `datos:${seleccion.especialidadId}:${seleccion.medicoId}`,
    availabilityUrl,
    vacio,
  );
  const data =
    availability.state.kind === "ready" || availability.state.kind === "empty"
      ? availability.state.data
      : null;
  const slot = data?.items.find((item) => item.id === seleccion.slotId);
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<BookingFailure | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  useEffect(() => {
    if (data && seleccion.slotId && !slot) {
      const frame = requestAnimationFrame(() => {
        setFailure({
          message: "Ese horario ya no está disponible. Elige otro.",
          clearSlot: true,
        });
        errorRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [data, seleccion.slotId, slot]);

  async function confirmar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot || pending) return;
    const validacion = validarFormulario(dni, nombre, telefono);
    if (validacion) {
      setFailure({ ...validacion, clearSlot: false });
      requestAnimationFrame(() => {
        document.getElementById(validacion.field)?.focus();
      });
      return;
    }

    setPending(true);
    setFailure(null);
    try {
      const detalle = await reservarCita(
        { slotId: slot.id, dni, nombre, telefono },
        idempotencyKeyParaSlot(slot.id),
      );
      const sesion = { detalle, dni: dni.trim(), codigoReserva: detalle.codigoReserva };
      window.sessionStorage.setItem(CONFIRMATION_STORAGE, JSON.stringify(detalle));
      window.sessionStorage.setItem(APPOINTMENT_STORAGE, JSON.stringify(sesion));
      const confirmationParams = new URLSearchParams(searchParams.toString());
      confirmationParams.delete("aviso");
      router.push(`/reservar/confirmacion?${confirmationParams.toString()}`);
    } catch (error) {
      const bookingFailure = (error as { bookingFailure?: BookingFailure })
        .bookingFailure ?? {
        message: "No pudimos confirmar la cita. Inténtalo nuevamente.",
        clearSlot: false,
      };
      setFailure(bookingFailure);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  function volverAHorarios() {
    router.push(
      limpiarSeleccionInvalida(seleccion, "slot", "/reservar/fecha-hora"),
    );
  }

  return (
    <BookingShell
      step={4}
      title="Completa tus datos"
      description="Usaremos estos datos solo para identificar tu reserva."
      inlineFooter
      footer={
        <PrimaryFlowButton
          disabled={!slot || pending}
          type="submit"
          form="patient-data-form"
        >
          <span aria-hidden="true" />
          {pending ? "Confirmando…" : "Confirmar cita"}
          <ShieldCheck aria-hidden="true" size={24} />
        </PrimaryFlowButton>
      }
    >
      {confirmacionPerdida ? (
        <div className="lost-confirmation-notice" role="status" aria-live="polite">
          No conservamos la confirmación en esta pestaña. No intentaremos reservar
          nuevamente; vuelve a elegir un horario o consulta tu cita con DNI y código.
        </div>
      ) : null}
      {availability.state.kind === "loading" ? <LoadingPanel /> : null}
      {availability.state.kind === "preparing" ? <LoadingPanel preparing /> : null}
      {availability.state.kind === "error" || availability.state.kind === "offline" ? (
        <MessagePanel
          kind={availability.state.kind === "offline" ? "offline" : "error"}
          title="No pudimos comprobar el horario"
          action="Intentar nuevamente"
          onAction={availability.retry}
        >
          Conserva esta pantalla abierta mientras volvemos a consultar.
        </MessagePanel>
      ) : null}

      {slot && data ? (
        <section className="appointment-summary-card" aria-label="Resumen de la cita">
          <span className="summary-medical-icon" aria-hidden="true">
            <Stethoscope size={30} />
          </span>
          <div>
            <strong>{data.especialidad.nombre}</strong>
            <span>{slot.medico.nombre}</span>
            <small>
              <CalendarDays aria-hidden="true" size={20} />
              {fechaLarga.format(new Date(slot.inicioUtc))}
            </small>
            <small>
              <Clock3 aria-hidden="true" size={20} />
              {hora.format(new Date(slot.inicioUtc))} · {slot.consultorio.nombre}
            </small>
          </div>
          <button type="button" onClick={volverAHorarios}>
            Cambiar
          </button>
        </section>
      ) : null}

      <div
        className={`booking-form-error ${failure ? "is-visible" : ""}`}
        role="alert"
        aria-live="assertive"
        ref={errorRef}
        tabIndex={-1}
      >
        {failure?.message}
        {failure?.clearSlot ? (
          <button type="button" onClick={volverAHorarios}>
            <ArrowLeft aria-hidden="true" size={20} /> Volver a elegir horario
          </button>
        ) : null}
      </div>

      {slot ? (
        <form
          id="patient-data-form"
          className="patient-data-form"
          onSubmit={confirmar}
          noValidate
        >
          <label htmlFor="dni">DNI (8 números)</label>
          <input
            id="dni"
            name="dni"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={dni}
            onChange={(event) => setDni(event.target.value.replace(/\D/g, ""))}
            aria-invalid={failure?.field === "dni"}
            placeholder="Ej.: 12345678"
          />

          <label htmlFor="nombre">Nombre completo</label>
          <input
            id="nombre"
            name="nombre"
            autoComplete="name"
            maxLength={120}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            aria-invalid={failure?.field === "nombre"}
            placeholder="Ej.: Juan Pérez García"
          />

          <label htmlFor="telefono">Número de celular (9 dígitos)</label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={9}
            value={telefono}
            onChange={(event) => setTelefono(event.target.value.replace(/\D/g, ""))}
            aria-invalid={failure?.field === "telefono"}
            placeholder="Ej.: 987654321"
          />

          <aside className="clinic-payment-note">
            <CreditCard aria-hidden="true" size={26} />
            <div>
              <strong>El pago se realiza en la clínica</strong>
              <span>No tienes que pagar por internet.</span>
            </div>
          </aside>

          <aside className="payment-deadline-note">
            <TimerReset aria-hidden="true" size={26} />
            <div>
              <strong>Debes pagar antes de que inicie tu cita.</strong>
              <span>El plazo máximo es de 72 horas.</span>
            </div>
          </aside>

        </form>
      ) : null}
    </BookingShell>
  );
}

export type { DetalleCita };
