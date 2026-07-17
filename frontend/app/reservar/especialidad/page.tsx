import { Suspense } from "react";
import { SpecialtyScreen } from "@/components/booking/specialty-screen";

export default function EspecialidadPage() {
  return (
    <Suspense fallback={<div className="route-fallback" role="status">Cargando opciones…</div>}>
      <SpecialtyScreen />
    </Suspense>
  );
}
