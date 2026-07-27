import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";

// ── Types ────────────────────────────────────────────

export type PaymentMethod = "PayOS" | "Momo";

export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded" | "Expired";

export type CreatePaymentPayload = {
  bookingId: number;
  paymentMethod: PaymentMethod;
};

export type CreatePaymentResult = {
  paymentId: number;
  bookingId: number;
  paymentCode: string;
  paymentMethod: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  expiredAt: string;
  paymentUrl: string;
};

export type PaymentStatusResult = {
  bookingId: number;
  bookingStatus: string;
  bookingCode?: string | null;
  bookingType?: string | null;
  paymentId: number | null;
  paymentStatus: PaymentStatus | null;
  paymentMethod: PaymentMethod | null;
  paymentCode: string | null;
  amount: number | null;
  expiredAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  gatewayOrderId: string | null; // PayOS orderCode
};

// ── API Functions ─────────────────────────────────────

/**
 * UC-16: Tạo payment và lấy payment URL (PayOS).
 * Amount KHÔNG được lấy từ frontend – backend tự tính từ Bookings.TotalAmount.
 * Sau khi nhận paymentUrl, dùng window.location.href = paymentUrl để redirect.
 */
export async function createPayment(
  token: string,
  payload: CreatePaymentPayload
): Promise<CreatePaymentResult> {
  const res = await apiClient<ApiResponse<CreatePaymentResult>>(
    "/api/payments/create",
    {
      method: "POST",
      token,
      body: payload,
    }
  );
  return res.data;
}

/**
 * Lấy trạng thái payment của booking.
 * Chỉ user sở hữu booking mới gọi được.
 * Dùng ở trang /payment/success và /payment/failed để hiển thị trạng thái thật từ backend.
 */
export async function getPaymentStatus(
  token: string,
  bookingId: number
): Promise<PaymentStatusResult> {
  const res = await apiClient<ApiResponse<PaymentStatusResult>>(
    `/api/payments/status?bookingId=${bookingId}`,
    { token }
  );
  return res.data;
}
