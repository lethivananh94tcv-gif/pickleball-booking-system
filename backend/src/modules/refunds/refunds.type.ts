// ==========================================
// refunds.type.ts
// Types cho Refund module
// ==========================================

export type RefundStatus =
  | "Requested"
  | "Approved"
  | "Processing"
  | "PendingManual"
  | "Completed"
  | "Failed"
  | "Rejected";

export type RefundMethod = "Momo" | "PayOSManual" | "Manual";

// Input khi tạo refund record mới
export type CreateRefundInput = {
  bookingId?: number | null;
  paymentId?: number | null;
  registrationId?: number | null;
  tournamentPaymentId?: number | null;
  refundCode: string;
  refundAmount: number;
  refundMethod: RefundMethod;
  reason: string;
  createdBy: number;
};

// Kết quả trả về cho user sau khi request refund
export type RefundResult = {
  refundId: number;
  refundCode: string;
  bookingId: number;
  paymentId: number;
  refundAmount: number;
  refundPercent: number;
  refundMethod: RefundMethod;
  status: RefundStatus;
  message: string;
};

// Record từ DB — dùng cho Player (my refunds)
export type RefundRecord = {
  RefundID: number;
  BookingID: number | null;
  PaymentID: number | null;
  RegistrationID: number | null;
  TournamentPaymentID: number | null;
  RefundCode: string | null;
  RefundMethod: RefundMethod | null;
  RefundAmount: number;
  Reason: string | null;
  Status: RefundStatus;
  RequestedAt: Date | string;
  ProcessedAt: Date | string | null;
  CreatedBy: number | null;
  ProcessedBy: number | null;
  UpdatedAt: Date | string | null;
  GatewayRefundId?: string | null;
  GatewayResponse?: string | null;
  // Joined
  PaymentMethod?: string;
};

// Record mở rộng — dùng cho Manager/Admin (join Users)
export type RefundManagerRecord = RefundRecord & {
  PlayerName?: string;
  PlayerEmail?: string;
  BookingCode?: string;
};

// Input update status
export type UpdateRefundStatusInput = {
  refundId: number;
  status: RefundStatus;
  processedBy?: number;
  gatewayRefundId?: string;
  gatewayResponse?: string;
  setProcessedAt?: boolean;
};
