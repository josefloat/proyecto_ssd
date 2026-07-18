import type { Metadata } from "next";
import { AdminDashboardScreen } from "@/components/personal/admin-dashboard-screen";

export const metadata: Metadata = { title: "Panel administrativo — Señal de Vida" };

export default function AdminPage() {
  return <AdminDashboardScreen />;
}
