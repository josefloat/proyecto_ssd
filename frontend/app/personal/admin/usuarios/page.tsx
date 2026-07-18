import type { Metadata } from "next";
import { AdminUsuariosScreen } from "@/components/personal/admin-usuarios-screen";

export const metadata: Metadata = { title: "Usuarios — Administración Señal de Vida" };

export default function UsuariosPage() { return <AdminUsuariosScreen />; }
