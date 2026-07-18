import type { Metadata } from "next";
import { MedicoAgendaScreen } from "@/components/personal/medico-agenda-screen";

export const metadata: Metadata = {
  title: "Mi agenda — Señal de Vida",
};

export default function MedicoAgendaPage() {
  return <MedicoAgendaScreen />;
}
