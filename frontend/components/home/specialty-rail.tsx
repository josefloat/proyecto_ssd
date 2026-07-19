"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  Bone,
  ChevronRight,
  Hand,
  HeartPulse,
  Stethoscope,
  Venus,
} from "lucide-react";

// Carrusel horizontal de especialidades: una fila de tarjetas altas con la
// foto que el ADMIN sube desde el panel (clave "especialidad-<slug>"). Se
// desplaza con scroll nativo + scroll-snap —así funciona con dedo, rueda y
// teclado sin JavaScript— y las flechas solo son un atajo para ratón.
//
// No reutiliza .specialty-grid / .specialty-card: esas clases las comparte
// el paso de especialidad del flujo de reserva y convertirlas en carrusel
// rompería esa pantalla. Prefijo propio .spec-* , como .hc-* en el hero.

const ICONOS = {
  stethoscope: Stethoscope,
  heart: HeartPulse,
  baby: Baby,
  bone: Bone,
  venus: Venus,
  hand: Hand,
} as const;

export type EspecialidadDestacada = Readonly<{
  nombre: string;
  detalle: string;
  duracion: number;
  icono: keyof typeof ICONOS;
  tono: string;
  foto: string;
}>;

export function SpecialtyRail({
  especialidades,
}: {
  especialidades: readonly EspecialidadDestacada[];
}) {
  const railRef = useRef<HTMLUListElement | null>(null);
  const [puedeIr, setPuedeIr] = useState({ atras: false, adelante: true });

  // Las flechas se apagan en los extremos para no prometer un movimiento que
  // no ocurre; el margen de 2 px absorbe los redondeos del scroll fraccional.
  const revisarBordes = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setPuedeIr({
      atras: rail.scrollLeft > 2,
      adelante: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    revisarBordes();
    window.addEventListener("resize", revisarBordes);
    return () => window.removeEventListener("resize", revisarBordes);
  }, [revisarBordes]);

  const desplazar = (sentido: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    // Un "paso" es el ancho de una tarjeta; con una sola visible avanza una,
    // con varias visibles avanza casi una pantalla completa.
    const tarjeta = rail.firstElementChild as HTMLElement | null;
    const paso = tarjeta ? tarjeta.offsetWidth + 18 : rail.clientWidth * 0.8;
    rail.scrollBy({ left: paso * sentido, behavior: "smooth" });
  };

  return (
    <div className="spec-rail-wrap">
      <ul className="spec-rail" ref={railRef} onScroll={revisarBordes}>
        {especialidades.map((especialidad) => {
          const Icono = ICONOS[especialidad.icono];
          return (
            <li key={especialidad.nombre}>
              <Link
                  className="spec-slide"
                  href={`/reservar/especialidad?nombre=${encodeURIComponent(especialidad.nombre)}`}
                >
                <span className="spec-shot">
                  {especialidad.foto ? (
                    <Image
                      src={especialidad.foto}
                      alt=""
                      fill
                      sizes="(max-width: 860px) 62vw, 260px"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <span className={`spec-shot-ph ${especialidad.tono}`}>
                      <Icono size={44} aria-hidden="true" />
                    </span>
                  )}
                  <span className="spec-shot-badge" aria-hidden="true">
                    <Icono size={22} />
                  </span>
                </span>
                <span className="spec-slide-text">
                  <strong>{especialidad.nombre}</strong>
                  <span>
                    {especialidad.detalle} · {especialidad.duracion} min
                  </span>
                </span>
                <ChevronRight className="spec-slide-go" aria-hidden="true" size={22} />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="spec-arrows">
        <button
          type="button"
          aria-label="Ver especialidades anteriores"
          disabled={!puedeIr.atras}
          onClick={() => desplazar(-1)}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Ver más especialidades"
          disabled={!puedeIr.adelante}
          onClick={() => desplazar(1)}
        >
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
