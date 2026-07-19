"use client";

import { useReducedMotion } from "framer-motion";

// Fondo animado de la home. Es puramente decorativo, así que va dentro de un
// contenedor aria-hidden: axe exige subtítulos (regla video-caption) en todo
// <video> expuesto, y aquí no hay nada que subtitular. Sin controles y sin
// nada enfocable dentro, para no chocar con aria-hidden-focus.
//
// autoPlay solo es legal —y solo lo permiten los navegadores— con muted;
// playsInline evita que iOS lo abra a pantalla completa.
export function HomeBackgroundVideo({
  url,
  poster,
}: {
  url: string;
  poster: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="home-bg-video" aria-hidden="true">
      {reduceMotion ? (
        // Con movimiento reducido no se reproduce nada: queda el póster fijo
        // (o el degradado del contenedor si el ADMIN no subió póster).
        poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" />
        ) : null
      ) : (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster || undefined}
          src={url}
        />
      )}
      <i className="home-bg-veil" />
    </div>
  );
}
