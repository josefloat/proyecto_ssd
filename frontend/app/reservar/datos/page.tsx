import { Suspense } from "react";
import { PatientDataScreen } from "@/components/booking/patient-data-screen";

export default function DatosPacientePage() {
  return (
    <Suspense fallback={<div className="route-fallback" role="status">Cargando resumen…</div>}>
      <PatientDataScreen />
    </Suspense>
  );
}
