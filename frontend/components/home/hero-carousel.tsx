"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  Brain,
  CalendarClock,
  Check,
  Clock3,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  Wallet,
} from "lucide-react";

// Carrusel del hero. La foto de la clínica es la capa base SIEMPRE montada:
// los specs consultan getByRole("img") en modo estricto, así que debe existir
// exactamente una imagen accesible en todo momento. Las escenas ilustradas
// son overlays aria-hidden que barren por encima con clip-path (nunca
// opacidad: axe muestrearía texto a medio fundido). La costura del barrido
// coincide entre el overlay que entra y el que sale, como un wipe continuo.
// Autoplay con pausa al interactuar y barras de progreso tipo "historias";
// con prefers-reduced-motion no hay autoplay ni transiciones.

const DURACION_MS = 7000;

type Escena = "agenda" | "equipo" | "pago";

type Diapositiva = Readonly<{
  id: string;
  escena: Escena | null;
  titulo: string;
  icono: typeof HeartPulse;
}>;

const DIAPOSITIVAS: readonly Diapositiva[] = [
  { id: "foto", escena: null, titulo: "Equipo humano, atención cercana", icono: HeartPulse },
  { id: "agenda", escena: "agenda", titulo: "Elige fecha y hora en segundos", icono: CalendarClock },
  { id: "equipo", escena: "equipo", titulo: "Especialidades para toda tu familia", icono: Stethoscope },
  { id: "pago", escena: "pago", titulo: "Reserva gratis y paga en la clínica", icono: ShieldCheck },
];

const variantesBarrido = {
  enter: (direccion: number) => ({
    clipPath: direccion >= 0 ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)",
  }),
  center: { clipPath: "inset(0% 0% 0% 0%)" },
  exit: (direccion: number) => ({
    clipPath: direccion >= 0 ? "inset(0% 100% 0% 0%)" : "inset(0% 0% 0% 100%)",
  }),
};

function ArteEscena({ escena }: { escena: Escena }) {
  if (escena === "agenda") {
    return (
      <div className="hc-art">
        <i className="hc-halo hc-halo-a" />
        <i className="hc-halo hc-halo-b" />
        <svg className="hc-ecg" viewBox="0 0 320 64" focusable="false">
          <path d="M0 36h52l10-18 14 36 12-28 9 10h223" pathLength={100} />
        </svg>
        <div className="hc-card hc-card-calendar">
          <div className="hc-card-head">
            <i />
            <span />
          </div>
          <div className="hc-cal-grid">
            {Array.from({ length: 21 }, (_, i) => (
              <i
                key={i}
                className={i === 9 ? "is-today" : i === 10 ? "is-pick" : ""}
              />
            ))}
          </div>
        </div>
        <div className="hc-chip hc-chip-a">
          <Clock3 size={17} />
          <span>Hoy</span>
        </div>
        <div className="hc-chip hc-chip-b">
          <Check size={17} />
          <span>08:30</span>
        </div>
      </div>
    );
  }

  if (escena === "equipo") {
    return (
      <div className="hc-art">
        <i className="hc-halo hc-halo-a" />
        <i className="hc-halo hc-halo-b" />
        <div className="hc-orbit">
          <i className="hc-orbit-ring" />
          <span className="hc-core">
            <Stethoscope size={44} />
          </span>
          <span className="hc-sat hc-sat-1">
            <HeartPulse size={21} />
          </span>
          <span className="hc-sat hc-sat-2">
            <Baby size={21} />
          </span>
          <span className="hc-sat hc-sat-3">
            <Brain size={21} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="hc-art">
      <i className="hc-halo hc-halo-a" />
      <i className="hc-halo hc-halo-b" />
      <div className="hc-card hc-card-receipt">
        <i className="hc-receipt-row hc-w-70" />
        <i className="hc-receipt-row hc-w-45" />
        <i className="hc-receipt-row hc-w-60" />
        <div className="hc-receipt-total">
          <span />
          <strong />
        </div>
      </div>
      <div className="hc-badge-shield">
        <ShieldCheck size={30} />
      </div>
      <div className="hc-chip hc-chip-c">
        <Wallet size={17} />
        <span>S/ 0 en línea</span>
      </div>
    </div>
  );
}

function Caption({ diapositiva }: { diapositiva: Diapositiva }) {
  const Icono = diapositiva.icono;
  return (
    <span className="hc-caption">
      <span className="hc-caption-icon">
        <Icono size={19} aria-hidden="true" />
      </span>
      <span>{diapositiva.titulo}</span>
    </span>
  );
}

export function HeroCarousel({
  fotoUrl,
  fotoAlt,
}: {
  fotoUrl: string;
  fotoAlt: string;
}) {
  const reduceMotion = useReducedMotion();
  const total = DIAPOSITIVAS.length;

  const [{ indice, direccion }, setEstado] = useState({ indice: 0, direccion: 1 });

  const pausadoRef = useRef(false);
  const barrasRef = useRef<Array<HTMLSpanElement | null>>([]);

  const irA = useCallback(
    (destino: number, dir?: number) => {
      setEstado((actual) => {
        const limpio = ((destino % total) + total) % total;
        if (limpio === actual.indice) return actual;
        return {
          indice: limpio,
          direccion: dir ?? (limpio > actual.indice ? 1 : -1),
        };
      });
    },
    [total],
  );

  // Autoplay con rAF: acumula progreso solo sin pausa y con la pestaña
  // visible; cada avance reinicia el efecto (y con él, el temporizador).
  // Si el movimiento reducido se activa (incluso tarde, tras hidratar),
  // limpiamos las barras para que el CSS determine su estado final.
  useEffect(() => {
    if (reduceMotion || total < 2) {
      for (const barra of barrasRef.current) {
        if (barra) barra.style.transform = "";
      }
      return;
    }
    for (const barra of barrasRef.current) {
      if (barra) barra.style.transform = "";
    }
    let raf = 0;
    let transcurrido = 0;
    let ultimo = performance.now();
    const pulsar = (ahora: number) => {
      const delta = ahora - ultimo;
      ultimo = ahora;
      if (!pausadoRef.current && !document.hidden) {
        transcurrido += delta;
        const progreso = Math.min(transcurrido / DURACION_MS, 1);
        const barra = barrasRef.current[indice];
        if (barra) barra.style.transform = `scaleX(${progreso})`;
        if (progreso >= 1) {
          irA(indice + 1, 1);
          return;
        }
      }
      raf = requestAnimationFrame(pulsar);
    };
    raf = requestAnimationFrame(pulsar);
    return () => cancelAnimationFrame(raf);
  }, [indice, irA, reduceMotion, total]);

  const activa = DIAPOSITIVAS[indice];
  const transicion = reduceMotion
    ? { duration: 0 }
    : { duration: 0.85, ease: [0.32, 0.72, 0, 1] as const };

  return (
    <section
      className="hero-carousel"
      aria-roledescription="carrusel"
      aria-label="La clínica en imágenes"
      onMouseEnter={() => (pausadoRef.current = true)}
      onMouseLeave={() => (pausadoRef.current = false)}
      onFocus={() => (pausadoRef.current = true)}
      onBlur={() => (pausadoRef.current = false)}
    >
      <motion.div
        className="hc-stage"
        drag={reduceMotion ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.14}
        dragDirectionLock
        onDragEnd={(_, info) => {
          if (info.offset.x <= -72) irA(indice + 1, 1);
          else if (info.offset.x >= 72) irA(indice - 1, -1);
        }}
      >
        <div className="hc-base">
          <Image
            src={fotoUrl}
            alt={fotoAlt}
            fill
            priority
            draggable={false}
            sizes="(max-width: 860px) calc(100vw - 40px), 560px"
          />
          <i className="hc-scrim" aria-hidden="true" />
          <Caption diapositiva={DIAPOSITIVAS[0]} />
        </div>

        <AnimatePresence custom={direccion} initial={false}>
          {activa.escena ? (
            <motion.div
              key={activa.id}
              className={`hc-overlay hc-scene-${activa.escena}`}
              aria-hidden="true"
              custom={direccion}
              variants={variantesBarrido}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transicion}
            >
              <ArteEscena escena={activa.escena} />
              <Caption diapositiva={activa} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      <div className="hc-progress">
        {DIAPOSITIVAS.map((d, i) => (
          <button
            key={d.id}
            type="button"
            className={`hc-segment${i < indice ? " is-done" : ""}${i === indice ? " is-active" : ""}`}
            aria-label={`Ver diapositiva ${i + 1}: ${d.titulo}`}
            aria-current={i === indice || undefined}
            onClick={() => irA(i, i > indice ? 1 : -1)}
          >
            <span className="hc-track">
              <span
                className="hc-fill"
                ref={(el) => {
                  barrasRef.current[i] = el;
                }}
              />
            </span>
          </button>
        ))}
      </div>

      <div className="hc-arrows">
        <button
          type="button"
          aria-label="Diapositiva anterior"
          onClick={() => irA(indice - 1, -1)}
        >
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Diapositiva siguiente"
          onClick={() => irA(indice + 1, 1)}
        >
          <ArrowRight size={19} aria-hidden="true" />
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {activa.titulo}
      </p>
    </section>
  );
}
