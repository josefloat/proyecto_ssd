import { Suspense } from "react";
import { AvailabilityScreen } from "@/components/booking/availability-screen";

export default function FechaHoraPage() {
  return (
    <Suspense fallback={<div className="route-fallback" role="status">Cargando opciones…</div>}>
      <AvailabilityScreen />
    </Suspense>
  );
}
