"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseMedical, CalendarClock, LogOut } from "lucide-react";
import { cerrarSesion } from "@/lib/personal-client";

type PersonalShellProps = Readonly<{
  titulo: string;
  subtitulo?: string;
  usuario: string;
  children: ReactNode;
  acciones?: ReactNode;
}>;

export function PersonalShell({
  titulo,
  subtitulo,
  usuario,
  children,
  acciones,
}: PersonalShellProps) {
  const router = useRouter();

  async function salir() {
    await cerrarSesion();
    router.push("/personal/login");
  }

  return (
    <div className="personal-shell">
      <aside className="personal-sidebar" aria-label="Navegación del personal">
        <div className="personal-sidebar-brand">
          <span aria-hidden="true">
            <BriefcaseMedical size={26} />
          </span>
          <div>
            <strong>Señal de Vida</strong>
            <small>Gestión médica</small>
          </div>
        </div>
        <nav className="personal-sidebar-nav" aria-label="Secciones">
          <span className="personal-nav-item is-current" aria-current="page">
            <CalendarClock aria-hidden="true" size={22} /> Agenda
          </span>
        </nav>
        <button type="button" className="personal-logout" onClick={salir}>
          <LogOut aria-hidden="true" size={22} /> Cerrar sesión
        </button>
      </aside>

      <div className="personal-main-column">
        <header className="personal-topbar">
          <div>
            <h1>{titulo}</h1>
            {subtitulo ? <p>{subtitulo}</p> : null}
          </div>
          <div className="personal-topbar-right">
            {acciones}
            <span className="personal-user" aria-label="Usuario en sesión">
              {usuario}
            </span>
          </div>
        </header>
        <main className="personal-content">{children}</main>
      </div>
    </div>
  );
}
