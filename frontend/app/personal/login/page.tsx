import type { Metadata } from "next";
import { PersonalLoginScreen } from "@/components/personal/login-screen";

export const metadata: Metadata = {
  title: "Acceso del personal — Señal de Vida",
};

export default function PersonalLoginPage() {
  return <PersonalLoginScreen />;
}
