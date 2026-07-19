import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  CreditCard,
  FileText,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Home,
  MapPin,
  Microscope,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ComoLlegar, DIRECCION_CLINICA } from "@/components/clinic-directions";
import { MapaClinica } from "@/components/home/clinic-map";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { HomeBackgroundVideo } from "@/components/home/home-background-video";
import { SpecialtyRail } from "@/components/home/specialty-rail";
import { MotionPage } from "@/components/motion-page";
import {
  fondoDeVideo,
  fotoDeEspecialidad,
  fotosDelHero,
  obtenerImagenesSitio,
} from "@/lib/site-images";

// Fallback local versionado: si la base de datos no define "hero-home"
// (o el backend no responde), la home sigue mostrando la ilustración local.
const HERO_LOCAL = "/images/profesionales-ayacucho.png";

// Fotos gestionables de la sección "Conoce la clínica": si el ADMIN aún no
// sube una foto para la clave, se muestra un marcador ilustrado (sin <img>).
const TARJETAS_CLINICA = [
  {
    clave: "clinica-recepcion",
    titulo: "Recepción y admisión",
    detalle: "Te orientamos desde que llegas.",
    icono: HeartHandshake,
    tono: "ph-periwinkle",
  },
  {
    clave: "clinica-consultorios",
    titulo: "Consultorios",
    detalle: "Atención cómoda por especialidad.",
    icono: Stethoscope,
    tono: "ph-cyan",
  },
  {
    clave: "clinica-laboratorio",
    titulo: "Laboratorio y apoyo",
    detalle: "Resultados que acompañan tu cita.",
    icono: Microscope,
    tono: "ph-pink",
  },
] as const;
const HERO_ALT =
  "Una médica y un enfermero peruanos acompañan con calidez a un adulto mayor en un centro de salud de Ayacucho.";

// Especialidades del catálogo canónico del backend (nombre y duración de
// consulta), con su tono e icono de la presentación pública. Cada tarjeta
// del carrusel lleva al primer paso de la reserva; la foto la sube el ADMIN
// desde el panel (clave "especialidad-<slug>") y, si falta, la tarjeta cae
// en un marcador ilustrado con el icono de la especialidad.
const ESPECIALIDADES_HOME = [
  {
    nombre: "Medicina General",
    detalle: "Chequeos y atención primaria",
    duracion: 20,
    icono: "stethoscope",
    tono: "spec-amber",
  },
  {
    nombre: "Cardiología",
    detalle: "Cuidado del corazón",
    duracion: 30,
    icono: "heart",
    tono: "spec-rose",
  },
  {
    nombre: "Pediatría",
    detalle: "Salud de los más pequeños",
    duracion: 20,
    icono: "baby",
    tono: "spec-cyan",
  },
  {
    nombre: "Traumatología",
    detalle: "Huesos, golpes y articulaciones",
    duracion: 30,
    icono: "bone",
    tono: "spec-violet",
  },
  {
    nombre: "Ginecología",
    detalle: "Salud de la mujer",
    duracion: 30,
    icono: "venus",
    tono: "spec-blue",
  },
  {
    nombre: "Dermatología",
    detalle: "Cuidado de la piel",
    duracion: 15,
    icono: "hand",
    tono: "spec-orange",
  },
] as const;

// Dudas típicas del paciente, resueltas sin salir de la página. Acordeón
// nativo (details/summary): accesible por teclado y sin JavaScript extra.
const PREGUNTAS_FRECUENTES = [
  {
    pregunta: "¿Necesito pagar para reservar en línea?",
    respuesta:
      "No. La reserva es gratuita: pagas tu consulta directamente en recepción el día de tu cita.",
  },
  {
    pregunta: "¿Cómo consulto o cancelo mi cita?",
    respuesta:
      "Ingresa a «Ver mi cita» con tu DNI y tu código de reserva. Desde ahí puedes revisar el detalle o cancelar sin costo.",
  },
  {
    pregunta: "¿Qué debo llevar el día de mi cita?",
    respuesta:
      "Tu DNI y el código de reserva que recibiste al confirmar. Te recomendamos llegar 10 minutos antes de tu horario.",
  },
  {
    pregunta: "¿Puedo reservar para un familiar?",
    respuesta:
      "Sí. Solo necesitas su DNI, su nombre completo y un número de celular de contacto.",
  },
] as const;

export default async function HomePaciente() {
  const imagenes = await obtenerImagenesSitio();

  // Portada: las fotos que el ADMIN haya subido, o la ilustración local
  // versionada si todavía no hay ninguna (o el backend no responde).
  const subidas = fotosDelHero(imagenes);
  const fotosHero = subidas.length
    ? subidas.map((foto, i) => ({
        url: foto.url,
        alt: i === 0 ? foto.alt || HERO_ALT : "",
      }))
    : [{ url: HERO_LOCAL, alt: HERO_ALT }];

  const especialidades = ESPECIALIDADES_HOME.map((especialidad) => ({
    ...especialidad,
    foto: fotoDeEspecialidad(imagenes, especialidad.nombre)?.url ?? "",
  }));

  // El fondo en vídeo es opcional: solo cuando existe, la home pasa a su
  // variante en cristal para que las secciones se lean sobre el movimiento.
  const video = fondoDeVideo(imagenes);

  return (
    <div className={`patient-home-shell${video ? " tiene-video" : ""}`}>
      {video ? <HomeBackgroundVideo url={video.url} poster={video.poster} /> : null}
      <header className="home-topbar">
        <div className="brand-lockup" aria-label="Señal de Vida — Ayacucho">
          <BrandMark size={46} />
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
              <HeroCarousel fotos={fotosHero} />
            </div>

            <div className="hero-copy">
              <p className="eyebrow">
                <HeartPulse aria-hidden="true" size={18} />
                Clínica Señal de Vida · Ayacucho
              </p>
              <h1 id="home-title">Reserva tu cita de manera fácil y rápida</h1>
              <span className="pulse-underline" aria-hidden="true">
                <svg viewBox="0 0 220 26" focusable="false">
                  <path d="M2 15h56l9-10 10 17 8-13 6 6h127" pathLength={100} />
                </svg>
              </span>
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

          <section className="home-specialties" aria-labelledby="specialties-title">
            <div className="home-section-head">
              <h2 id="specialties-title">Nuestras especialidades</h2>
              <p>Seis áreas de atención para ti y tu familia.</p>
            </div>
            <SpecialtyRail especialidades={especialidades} />
          </section>

          <section className="home-clinic" aria-labelledby="clinic-title">
            <div className="home-section-head">
              <h2 id="clinic-title">Conoce la clínica</h2>
              <p>Espacios pensados para atenderte con calma.</p>
            </div>
            <div className="clinic-grid">
              {TARJETAS_CLINICA.map((tarjeta) => {
                const imagen = imagenes[tarjeta.clave];
                const Icono = tarjeta.icono;
                return (
                  <figure className="clinic-card" key={tarjeta.clave}>
                    {imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagen.url} alt={imagen.alt || tarjeta.titulo} loading="lazy" />
                    ) : (
                      <span className={`clinic-placeholder ${tarjeta.tono}`} aria-hidden="true">
                        <i><Icono size={34} /></i>
                      </span>
                    )}
                    <figcaption>
                      <strong>{tarjeta.titulo}</strong>
                      <span>{tarjeta.detalle}</span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>

          <section className="home-map-info" aria-labelledby="map-title">
            <div className="home-section-head">
              <h2 id="map-title">Estamos en Ayacucho</h2>
            </div>
            <div className="map-hero">
              <MapaClinica />
              <div className="map-card">
                <MapPin className="map-card-icon" aria-hidden="true" size={20} />
                <span>{DIRECCION_CLINICA}</span>
                <ComoLlegar compacto />
              </div>
            </div>
            <div className="home-info-strip">
              <span>
                <Clock3 aria-hidden="true" size={20} />
                Turnos de 9:00 a 23:00
              </span>
              <span>
                <Stethoscope aria-hidden="true" size={20} />
                6 especialidades
              </span>
              <span>
                <ShieldCheck aria-hidden="true" size={20} />
                Reserva sin costo
              </span>
            </div>
          </section>

          <section className="home-faq" aria-labelledby="faq-title">
            <div className="home-section-head">
              <h2 id="faq-title">Preguntas frecuentes</h2>
              <p>Lo que más nos preguntan nuestros pacientes.</p>
            </div>
            <div className="faq-list">
              {PREGUNTAS_FRECUENTES.map((item) => (
                <details className="faq-item" key={item.pregunta}>
                  <summary>
                    <CircleHelp className="faq-q-icon" aria-hidden="true" size={22} />
                    <span>{item.pregunta}</span>
                    <ChevronDown className="faq-chev" aria-hidden="true" size={22} />
                  </summary>
                  <p className="faq-answer">{item.respuesta}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="home-cta" aria-labelledby="cta-title">
            <svg className="cta-ecg" viewBox="0 0 220 26" aria-hidden="true" focusable="false">
              <path d="M2 15h56l9-10 10 17 8-13 6 6h127" pathLength={100} />
            </svg>
            <div className="cta-copy">
              <h2 id="cta-title">¿Listo para reservar tu cita?</h2>
              <p>
                Elige especialidad, médico y horario en cinco pasos guiados.
                Sin pagos en línea y con cancelación gratuita.
              </p>
            </div>
            <div className="cta-actions">
              <Link className="cta-btn cta-btn-primary" href="/reservar/especialidad">
                Reservar ahora
                <ChevronRight aria-hidden="true" size={22} />
              </Link>
              <Link className="cta-btn cta-btn-ghost" href="/mi-cita">
                Consultar mi cita
              </Link>
            </div>
          </section>
        </section>
      </MotionPage>

      <footer className="home-footer">
        <div className="home-footer-main">
          <div className="footer-brand">
            <span className="footer-brand-lockup">
              <BrandMark size={42} />
              <span className="footer-brand-name">Señal de Vida</span>
            </span>
            <p>
              Clínica en Ayacucho, Perú. Reserva tu cita en línea, paga en la
              clínica y cancela sin costo cuando lo necesites.
            </p>
          </div>

          <nav className="footer-col" aria-label="Enlaces de interés">
            <h2 className="footer-title">Accesos</h2>
            <ul className="footer-links">
              <li>
                <Link href="/">Inicio</Link>
              </li>
              <li>
                <Link href="/reservar/especialidad">Reservar cita</Link>
              </li>
              <li>
                <Link href="/mi-cita">Consultar cita</Link>
              </li>
              <li>
                <Link href="/personal/login">Portal del personal</Link>
              </li>
            </ul>
          </nav>

          <div className="footer-col">
            <h2 className="footer-title">La clínica</h2>
            <ul className="footer-facts">
              <li>
                <MapPin aria-hidden="true" size={20} />
                <span>{DIRECCION_CLINICA}</span>
              </li>
              <li>
                <Clock3 aria-hidden="true" size={20} />
                <span>Turnos de 9:00 a 23:00, según especialidad.</span>
              </li>
              <li>
                <Stethoscope aria-hidden="true" size={20} />
                <span>6 especialidades para ti y tu familia.</span>
              </li>
            </ul>
            <ComoLlegar compacto />
          </div>
        </div>

        <div className="home-footer-bar">
          <div>
            <span>© {new Date().getFullYear()} Señal de Vida · Ayacucho, Perú</span>
          </div>
        </div>
      </footer>

      <nav className="patient-nav" aria-label="Navegación principal">
        <span className="patient-nav-item is-current" aria-current="page">
          <Home aria-hidden="true" size={25} />
          <span>Inicio</span>
        </span>
        <Link className="patient-nav-item" href="/mi-cita">
          <ClipboardList aria-hidden="true" size={25} />
          <span>Mis citas</span>
        </Link>
        <Link className="patient-nav-item" href="/mi-cita">
          <UserRound aria-hidden="true" size={25} />
          <span>Perfil</span>
        </Link>
      </nav>
    </div>
  );
}
