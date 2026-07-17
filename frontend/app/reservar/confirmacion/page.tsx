import { Suspense } from "react";
import { BookingConfirmationScreen } from "@/components/booking/booking-confirmation-screen";

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={<div className="route-fallback" role="status">Recuperando tu confirmación…</div>}>
      <BookingConfirmationScreen />
    </Suspense>
  );
}
