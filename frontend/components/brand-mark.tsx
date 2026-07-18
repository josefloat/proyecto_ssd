// Marca de "Señal de Vida": insignia redondeada con la línea de un pulso
// vital (ECG) que se dibuja en bucle. Es decorativa (los topbars ya anuncian
// el nombre verbalmente) y no usa hooks: sirve igual en server components.
export function BrandMark({
  size = 44,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`brand-mark ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" width={size} height={size} focusable="false">
        <path
          className="brand-mark-line"
          d="M7 27h7.5l3-9.5 5.5 17 4-11.5 2.8 4H41"
          pathLength={100}
        />
        <circle className="brand-mark-dot" cx="41" cy="27" r="2.7" />
      </svg>
    </span>
  );
}
