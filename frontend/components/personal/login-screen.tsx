"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseMedical, LogOut, Lock, Mail } from "lucide-react";
import { MotionPage } from "@/components/motion-page";
import { cerrarSesion, iniciarSesion } from "@/lib/personal-client";
import type { RolPersonal } from "@/lib/personal-types";

const DESTINO_POR_ROL: Record<Exclude<RolPersonal, "ADMIN">, string> = {
  RECEPCIONISTA: "/personal/recepcion/agenda",
  MEDICO: "/personal/medico/agenda",
};

export function PersonalLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Estado temporal 4A: un ADMIN inicia sesión pero aún no tiene panel.
  const [adminPendiente, setAdminPendiente] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const { rol } = await iniciarSesion(email.trim(), password);
      if (rol === "ADMIN") {
        setAdminPendiente(true);
        return;
      }
      router.push(DESTINO_POR_ROL[rol]);
    } catch {
      setError("Correo o contraseña incorrectos.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  async function salir() {
    await cerrarSesion();
    setAdminPendiente(false);
    setEmail("");
    setPassword("");
  }

  if (adminPendiente) {
    return (
      <div className="personal-login-shell">
        <MotionPage className="personal-login-card">
          <div className="personal-brand">
            <span className="personal-brand-badge" aria-hidden="true">
              <BriefcaseMedical size={30} />
            </span>
            <h1>Señal de Vida</h1>
            <p>Portal administrativo — Ayacucho</p>
          </div>
          <p className="admin-pendiente-aviso" role="status">
            El panel administrativo se habilitará en la siguiente etapa.
          </p>
          <button type="button" className="personal-primary-button" onClick={salir}>
            <LogOut aria-hidden="true" size={22} /> Cerrar sesión
          </button>
        </MotionPage>
      </div>
    );
  }

  return (
    <div className="personal-login-shell">
      <MotionPage className="personal-login-card">
        <div className="personal-brand">
          <span className="personal-brand-badge" aria-hidden="true">
            <BriefcaseMedical size={30} />
          </span>
          <h1>Señal de Vida</h1>
          <p>Portal administrativo — Ayacucho</p>
        </div>

        <h2>Iniciar sesión</h2>
        <p className="personal-login-intro">Ingresa tus credenciales de personal autorizado.</p>

        <div
          className={`personal-form-error ${error ? "is-visible" : ""}`}
          ref={errorRef}
          tabIndex={-1}
          role="alert"
        >
          {error}
        </div>

        <form className="personal-login-form" onSubmit={enviar} noValidate>
          <label htmlFor="login-email">Correo electrónico</label>
          <div className="personal-input-group">
            <Mail aria-hidden="true" size={22} />
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ejemplo@senaldevida.pe"
            />
          </div>

          <label htmlFor="login-password">Contraseña</label>
          <div className="personal-input-group">
            <Lock aria-hidden="true" size={22} />
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
            />
          </div>

          <button type="submit" className="personal-primary-button" disabled={pending}>
            {pending ? "Ingresando…" : "Acceder al sistema"}
          </button>
        </form>
      </MotionPage>
    </div>
  );
}
