import { Suspense } from "react";
import { DoctorScreen } from "@/components/booking/doctor-screen";
import { fotosDeMedicos, obtenerImagenesSitio } from "@/lib/site-images";

export default async function MedicoPage() {
  const fotos = fotosDeMedicos(await obtenerImagenesSitio());
  return (
    <Suspense fallback={<div className="route-fallback" role="status">Cargando opciones…</div>}>
      <DoctorScreen fotosMedicos={fotos} />
    </Suspense>
  );
}
