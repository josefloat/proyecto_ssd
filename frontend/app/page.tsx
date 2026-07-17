import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  Info,
  UserRound,
} from "lucide-react";
import { MotionPage } from "@/components/motion-page";

function Proximamente() {
  return <span className="soon-pill">Próximamente</span>;
}

export default function HomePaciente() {
  return (
    <div className="patient-home-shell">
      <header className="home-topbar">
        <div className="brand-lockup" aria-label="Señal de Vida — Ayacucho">
          <HeartPulse aria-hidden="true" size={30} strokeWidth={2.2} />
          <div>
            <span className="brand-name">Señal de Vida</span>
            <span className="brand-place">Ayacucho</span>
          </div>
        </div>
        <button
          type="button"
          className="round-future"
          disabled
          aria-label="Perfil — próximamente"
          title="Perfil — próximamente"
        >
          <UserRound aria-hidden="true" size={27} />
        </button>
      </header>

      <MotionPage className="home-main">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="hero-illustration">
            <Image
              src="/images/profesionales-ayacucho.png"
              width={1448}
              height={1086}
              priority
              sizes="(max-width: 640px) calc(100vw - 40px), 510px"
              alt="Una médica y un enfermero peruanos acompañan con calidez a un adulto mayor en un centro de salud de Ayacucho."
            />
          </div>

          <div className="hero-copy">
            <p className="eyebrow">Atención cercana en Ayacucho</p>
            <h1 id="home-title">Reserva tu cita de manera fácil y rápida</h1>
            <p>Te guiaremos paso a paso.</p>
          </div>

          <div className="home-actions" aria-label="Acciones principales">
            <Link className="home-action home-action-primary" href="/reservar/especialidad">
              <span className="action-icon" aria-hidden="true">
                <CalendarDays size={29} />
              </span>
              <span>Sacar una cita</span>
              <ChevronRight className="action-arrow" aria-hidden="true" size={26} />
            </Link>

            <button className="home-action home-action-disabled" type="button" disabled>
              <span className="action-icon" aria-hidden="true">
                <FileText size={29} />
              </span>
              <span className="disabled-action-copy">
                <span>Ver mi cita</span>
                <Proximamente />
              </span>
              <ChevronRight className="action-arrow" aria-hidden="true" size={26} />
            </button>
          </div>

          <div className="home-progress" aria-hidden="true">
            <span className="is-active" />
            <span />
            <span />
            <span />
            <span />
          </div>

          <aside className="academic-note" aria-label="Aviso de demostración">
            <Info aria-hidden="true" size={22} />
            <p>
              <strong>Demostración académica.</strong> Los profesionales y horarios
              mostrados son datos ficticios.
            </p>
          </aside>
        </section>
      </MotionPage>

      <nav className="home-bottom-nav" aria-label="Navegación principal">
        <span className="bottom-nav-item is-current" aria-current="page">
          <Home aria-hidden="true" size={25} />
          <span>Inicio</span>
        </span>
        <button type="button" className="bottom-nav-item" disabled>
          <ClipboardList aria-hidden="true" size={25} />
          <span>Mis citas</span>
          <span className="sr-only">Próximamente</span>
        </button>
        <button type="button" className="bottom-nav-item" disabled>
          <Bell aria-hidden="true" size={25} />
          <span>
            Notifica<wbr />ciones
          </span>
          <span className="sr-only">Próximamente</span>
        </button>
        <button type="button" className="bottom-nav-item" disabled>
          <UserRound aria-hidden="true" size={25} />
          <span>Perfil</span>
          <span className="sr-only">Próximamente</span>
        </button>
      </nav>
    </div>
  );
}
