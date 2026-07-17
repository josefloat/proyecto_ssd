"use client";

import { ArrowLeft, HeartPulse, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { MotionPage } from "@/components/motion-page";

export function BookingShell({
  step,
  title,
  description,
  children,
  footer,
  inlineFooter = false,
}: {
  step: 1 | 2 | 3 | 4 | 5;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  inlineFooter?: boolean;
}) {
  const router = useRouter();
  return (
    <div className={`booking-shell ${inlineFooter ? "footer-inline" : ""}`}>
      <header className="booking-topbar">
        <button type="button" className="back-action" onClick={() => router.back()}>
          <ArrowLeft aria-hidden="true" size={26} />
          <span>Volver</span>
        </button>
        <div className="booking-brand" aria-label="Señal de Vida — Ayacucho">
          <HeartPulse aria-hidden="true" size={26} />
          <span>Señal de Vida</span>
        </div>
        <span className="topbar-spacer" aria-hidden="true" />
      </header>

      <MotionPage className="booking-main">
        <section className="booking-progress" aria-label={`Paso ${step} de 5`}>
          <div className="progress-segments" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className={index < step ? "is-complete" : ""} />
            ))}
          </div>
          <p>Paso {step} de 5</p>
        </section>

        <div className="booking-heading">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>

        {children}

        <aside className="booking-demo-note" aria-label="Aviso de demostración">
          <Info aria-hidden="true" size={21} />
          <span>
            Demostración académica: profesionales y horarios son datos ficticios.
          </span>
        </aside>
      </MotionPage>

      {footer ? <footer className="booking-footer">{footer}</footer> : null}
    </div>
  );
}

export function PrimaryFlowButton({
  children,
  disabled,
  onClick,
  type = "button",
  form,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      className="flow-primary-button"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
