"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CircleCheck,
  HeartPulse,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { MotionPage } from "@/components/motion-page";
import { cambiarPassword, iniciarSesion } from "@/lib/personal-client";
import type { RolPersonal } from "@/lib/personal-types";

const DESTINO_POR_ROL: Record<RolPersonal, string> = {
  ADMIN: "/personal/admin",
  RECEPCIONISTA: "/personal/recepcion/agenda",
  MEDICO: "/personal/medico/agenda",
};

// Escenario compartido del login: panel visual (con fondo gestionable desde
// el panel de imágenes del ADMIN) + tarjeta del formulario.
function LoginStage({
  fondoUrl,
  children,
}: {
  fondoUrl?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="personal-login-shell">
      <div className="login-stage">
        <aside
          className="login-aside"
          style={fondoUrl ? { backgroundImage: `url(${fondoUrl})` } : undefined}
        >
          <div className="login-aside-art" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="login-aside-content">
            <HeartPulse aria-hidden="true" />
            <strong>El cuidado empieza con una buena organización.</strong>
            <p>
              Agenda, pagos y programación del equipo de salud de Señal de Vida,
              en un solo lugar.
            </p>
            <ul className="login-points">
              <li>
                <CalendarClock aria-hidden="true" size={20} />
                <span>Agenda del día siempre actualizada</span>
              </li>
              <li>
                <CircleCheck aria-hidden="true" size={20} />
                <span>Registro de pagos en recepción</span>
              </li>
              <li>
                <ShieldCheck aria-hidden="true" size={20} />
                <span>Acceso según tu rol y sesión segura</span>
              </li>
            </ul>
          </div>
        </aside>
        {children}
      </div>
    </div>
  );
}

export function PersonalLoginScreen({ fondoUrl }: { fondoUrl?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [rolPendiente, setRolPendiente] = useState<RolPersonal | null>(null);
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const { rol, debeCambiarPassword } = await iniciarSesion(email.trim(), password);
      if (debeCambiarPassword) {
        setRolPendiente(rol);
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

  async function cambiar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (passwordNueva !== confirmacion) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await cambiarPassword(password, passwordNueva);
      setRolPendiente(null);
      setPassword("");
      setPasswordNueva("");
      setConfirmacion("");
      setMensaje("Contraseña actualizada. Inicia sesión nuevamente.");
    } catch {
      setError("Usa al menos 12 caracteres, con mayúscula, minúscula y número.");
    } finally {
      setPending(false);
    }
  }

  if (rolPendiente) {
    return (
      <LoginStage fondoUrl={fondoUrl}>
        <MotionPage className="personal-login-card">
          <div className="personal-brand">
            <BrandMark size={62} />
            <h1>Señal de Vida</h1>
            <p>Portal administrativo — Ayacucho</p>
          </div>
          <h2>Cambia tu contraseña temporal</h2>
          <p className="personal-login-intro">
            Por seguridad, completa este paso antes de acceder a tu área.
          </p>
          <div className={`personal-form-error ${error ? "is-visible" : ""}`} role="alert">
            {error}
          </div>
          <form className="personal-login-form" onSubmit={cambiar}>
            <label htmlFor="password-nueva">Nueva contraseña</label>
            <div className="personal-input-group">
              <Lock aria-hidden="true" size={22} />
              <input id="password-nueva" type="password" autoComplete="new-password" value={passwordNueva} onChange={(event) => setPasswordNueva(event.target.value)} />
            </div>
            <label htmlFor="password-confirmacion">Confirmar nueva contraseña</label>
            <div className="personal-input-group">
              <Lock aria-hidden="true" size={22} />
              <input id="password-confirmacion" type="password" autoComplete="new-password" value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} />
            </div>
            <button type="submit" className="personal-primary-button" disabled={pending}>
              {pending ? "Guardando…" : "Cambiar contraseña"}
            </button>
          </form>
        </MotionPage>
      </LoginStage>
    );
  }

  return (
    <LoginStage fondoUrl={fondoUrl}>
      <MotionPage className="personal-login-card">
        <div className="personal-brand">
          <BrandMark size={62} />
          <h1>Señal de Vida</h1>
          <p>Portal administrativo — Ayacucho</p>
        </div>

        <h2>Iniciar sesión</h2>
        <p className="personal-login-intro">Ingresa tus credenciales de personal autorizado.</p>
        {mensaje ? <p className="personal-success-message" role="status">{mensaje}</p> : null}

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
    </LoginStage>
  );
}
