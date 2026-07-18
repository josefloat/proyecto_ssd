import type { Metadata } from "next";
import { AdminImagenesScreen } from "@/components/personal/admin-imagenes-screen";

export const metadata: Metadata = {
  title: "Imágenes del sitio — Señal de Vida",
};

export default function AdminImagenesPage() {
  return <AdminImagenesScreen />;
}
