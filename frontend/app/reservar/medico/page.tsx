import { Suspense } from "react";
import { DoctorScreen } from "@/components/booking/doctor-screen";

export default function MedicoPage() {
  return (
    <Suspense fallback={<div className="route-fallback" role="status">Cargando opciones…</div>}>
      <DoctorScreen />
    </Suspense>
  );
}
