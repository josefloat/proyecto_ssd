import type { Metadata } from "next";
import { RecepcionAgendaScreen } from "@/components/personal/recepcion-agenda-screen";

export const metadata: Metadata = {
  title: "Agenda de recepción — Señal de Vida",
};

export default function RecepcionAgendaPage() {
  return <RecepcionAgendaScreen />;
}
