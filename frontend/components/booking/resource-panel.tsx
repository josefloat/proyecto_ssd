"use client";

import { CloudOff, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";

export function LoadingPanel({ preparing = false }: { preparing?: boolean }) {
  return (
    <div className="resource-panel resource-loading" role="status" aria-live="polite">
      <LoaderCircle className="spinner" aria-hidden="true" size={34} />
      <div>
        <h2>{preparing ? "Estamos preparando el sistema" : "Cargando opciones…"}</h2>
        <p>
          {preparing
            ? "La primera consulta puede tardar hasta un minuto. Puedes esperar aquí; seguimos intentando por ti."
            : "Esto tomará solo un momento."}
        </p>
      </div>
      <div className="skeleton-stack" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function MessagePanel({
  kind,
  title,
  children,
  action,
  onAction,
}: {
  kind: "empty" | "offline" | "invalid" | "error";
  title: string;
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  const Icon = kind === "offline" ? CloudOff : TriangleAlert;
  return (
    <section
      className={`resource-panel resource-message is-${kind}`}
      role={kind === "invalid" || kind === "error" ? "alert" : "status"}
      aria-live="polite"
      tabIndex={-1}
    >
      <Icon aria-hidden="true" size={36} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action && onAction ? (
        <button type="button" onClick={onAction}>
          <RefreshCw aria-hidden="true" size={22} />
          {action}
        </button>
      ) : null}
    </section>
  );
}
