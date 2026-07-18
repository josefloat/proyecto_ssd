import { Suspense } from "react";
import { AvailabilityScreen } from "@/components/booking/availability-screen";
import { fotosDeMedicos, obtenerImagenesSitio } from "@/lib/site-images";

export default async function FechaHoraPage() {
  const fotos = fotosDeMedicos(await obtenerImagenesSitio());
  return (
    <Suspense fallback={<div className="route-fallback" role="status">Cargando opciones…</div>}>
      <AvailabilityScreen fotosMedicos={fotos} />
    </Suspense>
  );
}
