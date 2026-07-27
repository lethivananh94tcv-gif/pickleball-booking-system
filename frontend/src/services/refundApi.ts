import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";

// ── Types ──────────────────────────────────────────────

export type RefundStatus =
  | "Requested"
  | "Approved"
  | "Processing"
  | "PendingManual"
  | "Completed"
  | "Failed"
  | "Rejected";

export type RefundMethod = "Momo" | "PayOSManual" | "Manual";

export interface RefundRecord {
  RefundID: number;
  BookingID: number;
  PaymentID: number;
  RefundCode: string | null;
  RefundMethod: RefundMethod | null;
  RefundAmount: number;
  Reason: string | null;
  GatewayRefundId: string | null;
  GatewayResponse: string | null;
  Status: RefundStatus;
  RequestedAt: string;
  ProcessedAt: string | null;
  CreatedBy: number | null;
  ProcessedBy: number | null;
  UpdatedAt: string | null;
  PaymentMethod?: string;
}

export interface RefundManagerRecord extends RefundRecord {
  PlayerName?: string;
  PlayerEmail?: string;
  PlayerPhone?: string;
  BookingCode?: string;
}

export interface RequestRefundResult {
  refundId: number;
  refundCode: string;
  bookingId: number;
  paymentId: number;
  refundAmount: number;
  refundPercent: number;
  refundMethod: RefundMethod;
  status: RefundStatus;
  message: string;
}

export interface ManagerRefundFilters {
  status?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── API Functions ──────────────────────────────────────

/**
 * Player yêu cầu hoàn tiền.
 * Backend tự tính refundAmount — không gửi từ frontend (BR-71).
 */
export async function requestRefund(
  token: string,
  bookingId: number,
  reason: string
): Promise<RequestRefundResult> {
  const res = await apiClient<ApiResponse<RequestRefundResult>>("/api/refunds/request", {
    method: "POST",
    token,
    body: { bookingId, reason },
  });
  return res.data;
}

/**
 * Player xem danh sách refund của mình.
 */
export async function getMyRefunds(token: string): Promise<RefundRecord[]> {
  const res = await apiClient<ApiResponse<RefundRecord[]>>("/api/refunds/my", { token });
  return res.data;
}

/**
 * Xem chi tiết trạng thái refund theo refundCode.
 * Player chỉ xem của mình. Manager/Admin xem tất cả.
 */
export async function getRefundStatus(token: string, refundCode: string): Promise<RefundRecord> {
  const res = await apiClient<ApiResponse<RefundRecord>>(
    `/api/refunds/status?refundCode=${encodeURIComponent(refundCode)}`,
    { token }
  );
  return res.data;
}

/**
 * Manager/Admin xem tất cả refund requests với filter tùy chọn.
 */
export async function getManagerRefunds(
  token: string,
  filters?: ManagerRefundFilters
): Promise<RefundManagerRecord[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await apiClient<ApiResponse<RefundManagerRecord[]>>(
    `/api/refunds/manager${query}`,
    { token }
  );
  return res.data;
}

/**
 * Manager/Admin duyệt refund.
 * MoMo → Processing, PayOS → PendingManual
 */
export async function approveRefund(
  token: string,
  refundCode: string
): Promise<{ success: boolean; message: string; newStatus: string }> {
  const res = await apiClient<ApiResponse<{ success: boolean; message: string; newStatus: string }>>(
    "/api/refunds/approve",
    {
      method: "POST",
      token,
      body: { refundCode },
    }
  );
  return res.data;
}

/**
 * Manager/Admin kích hoạt MoMo refund tự động.
 * Chỉ dành cho RefundMethod = Momo, Status = Processing.
 */
export async function processRefund(
  token: string,
  refundCode: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient<ApiResponse<{ success: boolean; message: string }>>(
    "/api/refunds/process",
    {
      method: "POST",
      token,
      body: { refundCode },
    }
  );
  return res.data;
}

/**
 * Manager/Admin xác nhận đã chuyển khoản thủ công.
 * Dành cho PayOS/VietQR hoặc mọi manual refund.
 */
export async function completeManualRefund(
  token: string,
  formData: FormData
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient<ApiResponse<{ success: boolean; message: string }>>(
    "/api/refunds/complete-manual",
    {
      method: "POST",
      token,
      body: formData,
    }
  );
  return res.data;
}

/**
 * Manager/Admin từ chối yêu cầu hoàn tiền.
 */
export async function rejectRefund(
  token: string,
  refundCode: string,
  rejectReason: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient<ApiResponse<{ success: boolean; message: string }>>(
    "/api/refunds/reject",
    {
      method: "POST",
      token,
      body: { refundCode, rejectReason },
    }
  );
  return res.data;
}

/**
 * Staff/Manager/Admin cập nhật thông tin ngân hàng nhận tiền của khách.
 */
export async function updateRefundBankDetails(
  token: string,
  data: {
    refundCode: string;
    bankId: string;
    accountNo: string;
    accountName: string;
  }
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient<ApiResponse<{ success: boolean; message: string }>>(
    "/api/refunds/update-bank-details",
    {
      method: "PUT",
      token,
      body: data,
    }
  );
  return res.data;
}
