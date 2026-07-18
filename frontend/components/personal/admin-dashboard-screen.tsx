"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ImageIcon, Stethoscope, UserRoundCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { listarUsuariosAdmin } from "@/lib/personal-client";
import type { UsuarioAdmin } from "@/lib/personal-types";
import { AdminShell } from "./admin-shell";

export function AdminDashboardScreen() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    listarUsuariosAdmin().then(setUsuarios).catch((fallo: { status?: number }) => {
      if (fallo.status === 401 || fallo.status === 403) router.replace("/personal/login");
      else setError(true);
    });
  }, [router]);
  const medicos = usuarios?.filter((item) => item.rol === "MEDICO" && item.activo).length ?? 0;
  const recepcionistas = usuarios?.filter((item) => item.rol === "RECEPCIONISTA" && item.activo).length ?? 0;
  return (
    <AdminShell actual="panel" titulo="Panel administrativo" subtitulo="Operación real de personal y programación">
      {error ? <div className="admin-state admin-error" role="alert">No pudimos cargar el panel. Intenta nuevamente.</div> : null}
      {!usuarios && !error ? <div className="admin-state" role="status">Cargando información…</div> : null}
      {usuarios ? (
        <>
          <section className="admin-metrics" aria-label="Resumen de personal activo">
            <article><span><Stethoscope aria-hidden="true" /></span><div><small>Médicos activos</small><strong>{medicos}</strong></div></article>
            <article><span><UserRoundCheck aria-hidden="true" /></span><div><small>Recepcionistas</small><strong>{recepcionistas}</strong></div></article>
          </section>
          <section className="admin-access-grid" aria-label="Accesos administrativos">
            <Link href="/personal/admin/usuarios"><Users aria-hidden="true" size={34} /><div><h2>Administrar usuarios</h2><p>Crea médicos y recepcionistas, controla acceso y reinicia credenciales.</p></div></Link>
            <Link href="/personal/admin/programacion"><CalendarDays aria-hidden="true" size={34} /><div><h2>Programación semanal</h2><p>Asigna días, turnos canónicos y consultorios con vigencia futura.</p></div></Link>
            <Link href="/personal/admin/imagenes"><ImageIcon aria-hidden="true" size={34} /><div><h2>Imágenes del sitio</h2><p>Cambia la portada, los fondos y los retratos de los médicos.</p></div></Link>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
