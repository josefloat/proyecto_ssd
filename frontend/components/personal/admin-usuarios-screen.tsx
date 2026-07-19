"use client";

import { FormEvent, useEffect, useState } from "react";
import { Copy, KeyRound, Pencil, Plus, Trash2, UserCheck, UserX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  actualizarUsuarioAdmin,
  crearUsuarioAdmin,
  eliminarUsuarioAdmin,
  listarUsuariosAdmin,
  obtenerCatalogosAdmin,
  reiniciarPasswordAdmin,
} from "@/lib/personal-client";
import type { CatalogosAdmin, UsuarioAdmin } from "@/lib/personal-types";
import { AdminShell } from "./admin-shell";

const FORM_INICIAL = { rol: "RECEPCIONISTA", nombre: "", email: "", especialidadId: "", horasSemanales: "8" };

export function AdminUsuariosScreen() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosAdmin | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [abierto, setAbierto] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [temporal, setTemporal] = useState<{ nombre: string; valor: string } | null>(null);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [porEliminar, setPorEliminar] = useState<UsuarioAdmin | null>(null);
  const [formEditar, setFormEditar] = useState({ nombre: "", email: "", especialidadId: "", horasSemanales: "" });

  async function cargar() {
    try {
      const [lista, datos] = await Promise.all([listarUsuariosAdmin(), obtenerCatalogosAdmin()]);
      setUsuarios(lista);
      setCatalogos(datos);
      setForm((actual) => ({ ...actual, especialidadId: actual.especialidadId || datos.especialidades[0]?.id || "" }));
    } catch (fallo) {
      const status = (fallo as { status?: number }).status;
      if (status === 401 || status === 403) router.replace("/personal/login");
      else setError("No pudimos cargar los usuarios.");
    }
  }
  useEffect(() => {
    Promise.all([listarUsuariosAdmin(), obtenerCatalogosAdmin()]).then(([lista, datos]) => {
      setUsuarios(lista);
      setCatalogos(datos);
      setForm((actual) => ({ ...actual, especialidadId: actual.especialidadId || datos.especialidades[0]?.id || "" }));
    }).catch((fallo: { status?: number }) => {
      if (fallo.status === 401 || fallo.status === 403) router.replace("/personal/login");
      else setError("No pudimos cargar los usuarios.");
    });
  }, [router]);

  async function crear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const body = form.rol === "MEDICO"
        ? { rol: "MEDICO", nombre: form.nombre, email: form.email, especialidadId: form.especialidadId, horasSemanales: Number(form.horasSemanales) }
        : { rol: "RECEPCIONISTA", nombre: form.nombre, email: form.email };
      const resultado = await crearUsuarioAdmin(body);
      setUsuarios((actual) => [...(actual ?? []), resultado.usuario]);
      setTemporal({ nombre: resultado.usuario.nombre, valor: resultado.passwordTemporal });
      setAbierto(false);
      setForm({ ...FORM_INICIAL, especialidadId: catalogos?.especialidades[0]?.id ?? "" });
    } catch (fallo) {
      const code = (fallo as { code?: string }).code;
      setError(code === "EMAIL_DUPLICADO" ? "Ese correo ya pertenece a otra cuenta." : "Revisa los datos e intenta nuevamente.");
    } finally {
      setPending(false);
    }
  }

  async function alternar(usuario: UsuarioAdmin) {
    setPending(true);
    try {
      const actualizado = await actualizarUsuarioAdmin(usuario.id, { activo: !usuario.activo });
      setUsuarios((actual) => actual?.map((item) => item.id === usuario.id ? actualizado : item) ?? null);
    } catch { setError("No se pudo cambiar el estado de la cuenta."); }
    finally { setPending(false); }
  }

  function abrirEdicion(usuario: UsuarioAdmin) {
    setError("");
    setFormEditar({
      nombre: usuario.nombre,
      email: usuario.email,
      especialidadId: usuario.medico?.especialidad.id ?? "",
      horasSemanales: usuario.medico ? String(usuario.medico.horasSemanales) : "",
    });
    setEditando(usuario);
  }

  async function guardarEdicion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editando) return;
    setPending(true);
    setError("");
    // Solo se envía lo que cambió: el backend rechaza cambios de
    // especialidad cuando el médico ya tiene programación.
    const cambios: Record<string, unknown> = {};
    if (formEditar.nombre !== editando.nombre) cambios.nombre = formEditar.nombre;
    if (formEditar.email !== editando.email) cambios.email = formEditar.email;
    if (editando.medico) {
      if (formEditar.especialidadId !== editando.medico.especialidad.id) cambios.especialidadId = formEditar.especialidadId;
      if (Number(formEditar.horasSemanales) !== editando.medico.horasSemanales) cambios.horasSemanales = Number(formEditar.horasSemanales);
    }
    try {
      if (Object.keys(cambios).length > 0) {
        const actualizado = await actualizarUsuarioAdmin(editando.id, cambios);
        setUsuarios((actual) => actual?.map((item) => item.id === editando.id ? actualizado : item) ?? null);
      }
      setEditando(null);
    } catch (fallo) {
      const code = (fallo as { code?: string }).code;
      setError(code === "HORAS_SEMANALES_INCOMPATIBLES"
        ? "Las horas no pueden ser menores que las ya programadas para el médico."
        : code === "MUTACION_NO_PERMITIDA"
          ? "No se puede cambiar la especialidad: el médico ya tiene programación asignada."
          : code === "EMAIL_DUPLICADO"
            ? "Ese correo ya pertenece a otra cuenta."
            : "No se pudo guardar la edición.");
    } finally {
      setPending(false);
    }
  }

  async function reiniciar(usuario: UsuarioAdmin) {
    setPending(true);
    try {
      const valor = await reiniciarPasswordAdmin(usuario.id);
      setTemporal({ nombre: usuario.nombre, valor });
      await cargar();
    } catch { setError("No se pudo reiniciar la contraseña."); }
    finally { setPending(false); }
  }

  async function confirmarEliminacion() {
    if (!porEliminar) return;
    setPending(true);
    setError("");
    try {
      await eliminarUsuarioAdmin(porEliminar.id);
      setUsuarios((actual) => actual?.filter((item) => item.id !== porEliminar.id) ?? null);
      setPorEliminar(null);
    } catch (fallo) {
      const code = (fallo as { code?: string }).code;
      setError(code === "CUENTA_CON_HISTORIAL"
        ? "Esta cuenta tiene historial operativo y no puede eliminarse. Desactívala para conservar la evidencia."
        : "No se pudo eliminar la cuenta.");
      setPorEliminar(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      actual="usuarios"
      titulo="Usuarios del personal"
      subtitulo="Cuentas de médicos y recepción"
      acciones={<button className="admin-primary-action" type="button" onClick={() => setAbierto(true)}><Plus aria-hidden="true" /> Nuevo usuario</button>}
    >
      {error ? <div className="admin-state admin-error" role="alert">{error}</div> : null}
      {!usuarios ? <div className="admin-state" role="status">Cargando usuarios…</div> : usuarios.length === 0 ? <div className="admin-state">Todavía no hay cuentas de personal.</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Especialidad</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td><strong>{usuario.nombre}</strong><small>{usuario.email}</small></td>
                <td>{usuario.rol === "MEDICO" ? "Médico" : "Recepcionista"}</td>
                <td>{usuario.medico?.especialidad.nombre ?? "—"}</td>
                <td><span className={`admin-status ${usuario.activo ? "is-active" : ""}`}>{usuario.activo ? "Activa" : "Inactiva"}</span></td>
                <td><div className="admin-row-actions">
                  <button type="button" disabled={pending} onClick={() => abrirEdicion(usuario)} aria-label={`Editar a ${usuario.nombre}`}><Pencil /></button>
                  <button type="button" disabled={pending} onClick={() => alternar(usuario)} aria-label={`${usuario.activo ? "Inactivar" : "Activar"} a ${usuario.nombre}`}>{usuario.activo ? <UserX /> : <UserCheck />}</button>
                  <button type="button" disabled={pending} onClick={() => reiniciar(usuario)} aria-label={`Reiniciar contraseña de ${usuario.nombre}`}><KeyRound /></button>
                  <button type="button" disabled={pending} onClick={() => setPorEliminar(usuario)} aria-label={`Eliminar cuenta de ${usuario.nombre}`}><Trash2 /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {abierto ? <div className="admin-modal-backdrop"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="nuevo-usuario-titulo">
        <button className="admin-modal-close" type="button" onClick={() => setAbierto(false)} aria-label="Cerrar"><X /></button>
        <h2 id="nuevo-usuario-titulo">Crear cuenta de personal</h2>
        <form className="admin-form" onSubmit={crear}>
          <label htmlFor="admin-rol">Rol</label><select id="admin-rol" value={form.rol} onChange={(event) => setForm({ ...form, rol: event.target.value })}><option value="RECEPCIONISTA">Recepcionista</option><option value="MEDICO">Médico</option></select>
          <label htmlFor="admin-nombre">Nombre completo</label><input id="admin-nombre" required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
          <label htmlFor="admin-email">Correo electrónico</label><input id="admin-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          {form.rol === "MEDICO" ? <>
            <label htmlFor="admin-especialidad">Especialidad</label><select id="admin-especialidad" value={form.especialidadId} onChange={(event) => setForm({ ...form, especialidadId: event.target.value })}>{catalogos?.especialidades.map((item) => <option value={item.id} key={item.id}>{item.nombre}</option>)}</select>
            <label htmlFor="admin-horas">Horas semanales</label><input id="admin-horas" type="number" min="1" max="168" required value={form.horasSemanales} onChange={(event) => setForm({ ...form, horasSemanales: event.target.value })} />
          </> : null}
          <button className="admin-primary-action" disabled={pending}>{pending ? "Creando…" : "Crear cuenta"}</button>
        </form>
      </section></div> : null}

      {editando ? <div className="admin-modal-backdrop"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="editar-usuario-titulo">
        <button className="admin-modal-close" type="button" onClick={() => setEditando(null)} aria-label="Cerrar edición"><X /></button>
        <h2 id="editar-usuario-titulo">Editar a {editando.nombre}</h2>
        <form className="admin-form" onSubmit={guardarEdicion}>
          <label htmlFor="editar-nombre">Nombre completo</label><input id="editar-nombre" required value={formEditar.nombre} onChange={(event) => setFormEditar({ ...formEditar, nombre: event.target.value })} />
          <label htmlFor="editar-email">Correo electrónico</label><input id="editar-email" type="email" required value={formEditar.email} onChange={(event) => setFormEditar({ ...formEditar, email: event.target.value })} />
          {editando.medico ? <>
            <label htmlFor="editar-especialidad">Especialidad</label><select id="editar-especialidad" value={formEditar.especialidadId} onChange={(event) => setFormEditar({ ...formEditar, especialidadId: event.target.value })}>{catalogos?.especialidades.map((item) => <option value={item.id} key={item.id}>{item.nombre}</option>)}</select>
            <label htmlFor="editar-horas">Horas semanales</label><input id="editar-horas" type="number" min="1" max="168" required value={formEditar.horasSemanales} onChange={(event) => setFormEditar({ ...formEditar, horasSemanales: event.target.value })} />
          </> : null}
          <button className="admin-primary-action" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</button>
        </form>
      </section></div> : null}

      {temporal ? <div className="admin-modal-backdrop"><section className="admin-modal credential-dialog" role="dialog" aria-modal="true" aria-labelledby="temporal-titulo">
        <h2 id="temporal-titulo">Contraseña temporal de {temporal.nombre}</h2>
        <p>Guárdala ahora. Al cerrar este diálogo no podrá recuperarse.</p>
        <output aria-label="Contraseña temporal">{temporal.valor}</output>
        <button className="admin-primary-action" type="button" onClick={() => navigator.clipboard.writeText(temporal.valor)}><Copy aria-hidden="true" /> Copiar contraseña</button>
        <button className="personal-secondary-button" type="button" onClick={() => setTemporal(null)}>Ya la guardé</button>
      </section></div> : null}

      {porEliminar ? <div className="admin-modal-backdrop"><section className="admin-modal" role="alertdialog" aria-modal="true" aria-labelledby="eliminar-usuario-titulo" aria-describedby="eliminar-usuario-descripcion">
        <h2 id="eliminar-usuario-titulo">Eliminar cuenta de {porEliminar.nombre}</h2>
        <p id="eliminar-usuario-descripcion">Esta acción es irreversible. Solo se eliminará si la cuenta no tiene programación, citas ni otro historial operativo.</p>
        <div className="admin-modal-actions">
          <button className="personal-secondary-button" type="button" disabled={pending} onClick={() => setPorEliminar(null)}>Cancelar</button>
          <button className="admin-primary-action" type="button" disabled={pending} onClick={confirmarEliminacion}>{pending ? "Eliminando…" : "Eliminar cuenta"}</button>
        </div>
      </section></div> : null}
    </AdminShell>
  );
}
