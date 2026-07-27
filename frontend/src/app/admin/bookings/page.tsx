import AdminBookingsPage from "@/modules/admin/bookings/AdminBookingsPage";
import { Suspense } from "react";

export const metadata = {
  title: "Quản lý Booking - Admin",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AdminBookingsPage />
    </Suspense>
  );
}
