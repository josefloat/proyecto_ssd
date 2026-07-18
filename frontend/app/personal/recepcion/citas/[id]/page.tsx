import type { Metadata } from "next";
import { RecepcionDetalleScreen } from "@/components/personal/recepcion-detalle-screen";

export const metadata: Metadata = {
  title: "Detalle de cita — Señal de Vida",
};

export default async function RecepcionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecepcionDetalleScreen citaId={id} />;
}
