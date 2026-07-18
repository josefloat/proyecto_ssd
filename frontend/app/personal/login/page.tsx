import type { Metadata } from "next";
import { PersonalLoginScreen } from "@/components/personal/login-screen";
import { obtenerImagenesSitio } from "@/lib/site-images";

export const metadata: Metadata = {
  title: "Acceso del personal — Señal de Vida",
};

export default async function PersonalLoginPage() {
  const imagenes = await obtenerImagenesSitio();
  return <PersonalLoginScreen fondoUrl={imagenes["fondo-login"]?.url} />;
}
