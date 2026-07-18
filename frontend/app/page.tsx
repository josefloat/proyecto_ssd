import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  HandHeart,
  HeartPulse,
  Home,
  Info,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { MotionPage } from "@/components/motion-page";
import { obtenerImagenesSitio } from "@/lib/site-images";

// Fallback local versionado: si la base de datos no define "hero-home"
// (o el backend no responde), la home sigue mostrando la ilustración local.
const HERO_LOCAL = "/images/profesionales-ayacucho.png";
const HERO_ALT =
  "Una médica y un enfermero peruanos acompañan con calidez a un adulto mayor en un centro de salud de Ayacucho.";

export default async function HomePaciente() {
  const imagenes = await obtenerImagenesSitio();
  const hero = imagenes["hero-home"];

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
          <div className="home-hero-grid">
            <div className="hero-media">
              <div className="hero-glow" aria-hidden="true" />
              <div className="hero-illustration">
                <Image
                  src={hero?.url ?? HERO_LOCAL}
                  width={1448}
                  height={1086}
                  priority
                  sizes="(max-width: 860px) calc(100vw - 40px), 520px"
                  alt={hero?.alt || HERO_ALT}
                />
              </div>
              <span className="hero-badge">
                <ShieldCheck aria-hidden="true" size={22} />
                <span>Atención cercana y segura</span>
              </span>
            </div>

            <div className="hero-copy">
              <p className="eyebrow">
                <Sparkles aria-hidden="true" size={20} />
                Atención cercana en Ayacucho
              </p>
              <h1 id="home-title">Reserva tu cita de manera fácil y rápida</h1>
              <p>Te guiaremos paso a paso.</p>

              <div className="home-actions" aria-label="Acciones principales">
                <Link className="home-action home-action-primary" href="/reservar/especialidad">
                  <span className="action-icon" aria-hidden="true">
                    <CalendarDays size={29} />
                  </span>
                  <span>Sacar una cita</span>
                  <ChevronRight className="action-arrow" aria-hidden="true" size={26} />
                </Link>

                <Link className="home-action home-action-secondary" href="/mi-cita">
                  <span className="action-icon" aria-hidden="true">
                    <FileText size={29} />
                  </span>
                  <span>Ver mi cita</span>
                  <ChevronRight className="action-arrow" aria-hidden="true" size={26} />
                </Link>
              </div>
            </div>
          </div>

          <div className="home-features" aria-label="Cómo funciona el servicio">
            <article className="feature-card">
              <ClipboardList aria-hidden="true" />
              <div>
                <strong>5 pasos guiados</strong>
                <span>Especialidad, médico, horario y listo.</span>
              </div>
            </article>
            <article className="feature-card">
              <CreditCard aria-hidden="true" />
              <div>
                <strong>Pago en la clínica</strong>
                <span>No necesitas pagar por internet.</span>
              </div>
            </article>
            <article className="feature-card">
              <HandHeart aria-hidden="true" />
              <div>
                <strong>Cancela sin costo</strong>
                <span>Con tu DNI y código de reserva.</span>
              </div>
            </article>
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

      <nav className="patient-nav" aria-label="Navegación principal">
        <span className="patient-nav-item is-current" aria-current="page">
          <Home aria-hidden="true" size={25} />
          <span>Inicio</span>
        </span>
        <button type="button" className="patient-nav-item" disabled>
          <ClipboardList aria-hidden="true" size={25} />
          <span>Mis citas</span>
          <span className="sr-only">Próximamente</span>
        </button>
        <button type="button" className="patient-nav-item" disabled>
          <Bell aria-hidden="true" size={25} />
          <span>
            Notifica<wbr />ciones
          </span>
          <span className="sr-only">Próximamente</span>
        </button>
        <button type="button" className="patient-nav-item" disabled>
          <UserRound aria-hidden="true" size={25} />
          <span>Perfil</span>
          <span className="sr-only">Próximamente</span>
        </button>
      </nav>
    </div>
  );
}
