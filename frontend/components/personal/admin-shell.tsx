"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BriefcaseMedical, CalendarDays, LayoutDashboard, LogOut, Users } from "lucide-react";
import { cerrarSesion } from "@/lib/personal-client";

const enlaces = [
  { href: "/personal/admin", label: "Panel", icono: LayoutDashboard },
  { href: "/personal/admin/usuarios", label: "Usuarios", icono: Users },
  { href: "/personal/admin/programacion", label: "Programación", icono: CalendarDays },
] as const;

export function AdminShell({
  actual,
  titulo,
  subtitulo,
  children,
  acciones,
}: Readonly<{
  actual: "panel" | "usuarios" | "programacion";
  titulo: string;
  subtitulo: string;
  children: ReactNode;
  acciones?: ReactNode;
}>) {
  const router = useRouter();
  async function salir() {
    await cerrarSesion();
    router.push("/personal/login");
  }
  return (
    <div className="personal-shell admin-shell">
      <aside className="personal-sidebar" aria-label="Navegación administrativa">
        <div className="personal-sidebar-brand">
          <span aria-hidden="true"><BriefcaseMedical size={26} /></span>
          <div><strong>Señal de Vida</strong><small>Administración</small></div>
        </div>
        <nav className="personal-sidebar-nav" aria-label="Secciones administrativas">
          {enlaces.map(({ href, label, icono: Icono }) => {
            const clave = href.endsWith("usuarios") ? "usuarios" : href.endsWith("programacion") ? "programacion" : "panel";
            return (
              <Link key={href} href={href} className={`personal-nav-item ${actual === clave ? "is-current" : ""}`} aria-current={actual === clave ? "page" : undefined}>
                <Icono aria-hidden="true" size={22} /> {label}
              </Link>
            );
          })}
        </nav>
        <button type="button" className="personal-logout" onClick={salir}>
          <LogOut aria-hidden="true" size={22} /> Cerrar sesión
        </button>
      </aside>
      <div className="personal-main-column">
        <header className="personal-topbar">
          <div><h1>{titulo}</h1><p>{subtitulo}</p></div>
          <div className="personal-topbar-right">{acciones}<span className="personal-user">ADMIN</span></div>
        </header>
        <main className="personal-content">{children}</main>
      </div>
    </div>
  );
}
