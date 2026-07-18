import type { Metadata } from "next";
import { AdminProgramacionScreen } from "@/components/personal/admin-programacion-screen";

export const metadata: Metadata = { title: "Programación — Administración Señal de Vida" };

export default function ProgramacionPage() { return <AdminProgramacionScreen />; }
