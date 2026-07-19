"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Carrusel del hero. La primera foto de la clínica es la capa base SIEMPRE
// montada: los specs consultan getByRole("img") en modo estricto, así que
// debe existir exactamente una imagen accesible en todo momento. Todo lo
// demás —escenas ilustradas y fotos adicionales que el ADMIN sube desde el
// panel— son overlays aria-hidden que barren por encima con clip-path (nunca
// opacidad: axe muestrearía texto a medio fundido). La costura del barrido
// coincide entre el overlay que entra y el que sale, como un wipe continuo.
// Autoplay con pausa al interactuar y barras de progreso tipo "historias";
// con prefers-reduced-motion no hay autoplay ni transiciones.

const DURACION_MS = 7000;

type Escena = "agenda" | "equipo" | "pago";

export type FotoHero = Readonly<{ url: string; alt: string }>;

type Diapositiva = Readonly<{
  id: string;
  escena: Escena | null;
  foto: FotoHero | null;
  titulo: string;
  icono: typeof HeartPulse;
}>;

// Escenas ilustradas fijas, en su orden narrativo: elegir hora, conocer las
// especialidades y saber que no se paga en línea.
const ESCENAS: readonly Omit<Diapositiva, "foto">[] = [
  { id: "agenda", escena: "agenda", titulo: "Elige fecha y hora en segundos", icono: CalendarClock },
  { id: "equipo", escena: "equipo", titulo: "Especialidades para toda tu familia", icono: Stethoscope },
  { id: "pago", escena: "pago", titulo: "Reserva gratis y paga en la clínica", icono: ShieldCheck },
];

// Leyenda de cada foto de portada. El ADMIN sube las fotos sin escribir
// texto, así que la leyenda es fija por posición: describe a la clínica, no
// a la imagen concreta (el contenido visual ya va en el alt de la primera).
const LEYENDAS_FOTO: readonly string[] = [
  "Equipo humano, atención cercana",
  "Un espacio pensado para cuidarte",
  "Cerca de ti, en Ayacucho",
  "Atención con calma y sin colas",
  "Profesionales de tu comunidad",
  "Tu salud, nuestra prioridad",
];

// Intercala fotos y escenas: la portada abre siempre (es la capa base) y a
// partir de ahí se alternan escena, foto, escena, foto… Si sobran fotos o
// sobran escenas, la cola se añade tal cual en su orden.
function construirDiapositivas(fotos: readonly FotoHero[]): Diapositiva[] {
  const [portada, ...resto] = fotos;
  const diapositivas: Diapositiva[] = [
    {
      id: "foto-01",
      escena: null,
      foto: portada,
      titulo: LEYENDAS_FOTO[0],
      icono: HeartPulse,
    },
  ];
  const total = Math.max(ESCENAS.length, resto.length);
  for (let i = 0; i < total; i += 1) {
    const escena = ESCENAS[i];
    if (escena) {
      diapositivas.push({ ...escena, foto: null });
    }
    const foto = resto[i];
    if (foto) {
      diapositivas.push({
        id: `foto-${String(i + 2).padStart(2, "0")}`,
        escena: null,
        foto,
        titulo: LEYENDAS_FOTO[(i + 1) % LEYENDAS_FOTO.length],
        icono: HeartPulse,
      });
    }
  }
  return diapositivas;
}

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

export function HeroCarousel({ fotos }: { fotos: readonly FotoHero[] }) {
  const reduceMotion = useReducedMotion();
  // Las fotos llegan del servidor y no cambian durante la vida de la página,
  // pero memorizamos para no rehacer el array en cada render del autoplay.
  const diapositivas = useMemo(() => construirDiapositivas(fotos), [fotos]);
  const total = diapositivas.length;

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

  const activa = diapositivas[indice];
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
            src={diapositivas[0].foto?.url ?? ""}
            alt={diapositivas[0].foto?.alt ?? ""}
            fill
            // `priority` quedó obsoleto en Next 16; con varias fotos de
            // portada solo la primera se carga con prisa (las demás son
            // overlays perezosos y no compiten por ser el LCP).
            loading="eager"
            fetchPriority="high"
            draggable={false}
            sizes="(max-width: 860px) calc(100vw - 40px), 560px"
          />
          <i className="hc-scrim" aria-hidden="true" />
          <Caption diapositiva={diapositivas[0]} />
        </div>

        <AnimatePresence custom={direccion} initial={false}>
          {indice > 0 ? (
            <motion.div
              key={activa.id}
              className={`hc-overlay ${activa.escena ? `hc-scene-${activa.escena}` : "hc-scene-foto"}`}
              aria-hidden="true"
              custom={direccion}
              variants={variantesBarrido}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transicion}
            >
              {activa.escena ? (
                <ArteEscena escena={activa.escena} />
              ) : activa.foto ? (
                <Image
                  src={activa.foto.url}
                  alt=""
                  fill
                  draggable={false}
                  sizes="(max-width: 860px) calc(100vw - 40px), 560px"
                />
              ) : null}
              {activa.foto ? <i className="hc-scrim" /> : null}
              <Caption diapositiva={activa} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      <div className="hc-progress">
        {diapositivas.map((d, i) => (
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
