// ==========================================
// payments.type.ts
// Type definitions for Payment module (UC-16)
// Schema dựa trên bảng Payments thực tế trong DB
// ==========================================

// ── Enums / Literals ─────────────────────────────────

export type PaymentMethod = "PayOS" | "Momo";

export type PaymentStatus =
  | "Pending"
  | "Paid"
  | "Failed"
  | "Refunded"
  | "Expired";

// ── DB Row Type ───────────────────────────────────────

/**
 * Ánh xạ 1:1 với bảng Payments trong SQL Server.
 * Không thêm/bớt cột so với schema thực tế.
 */
export type PaymentRow = {
  PaymentID: number;
  BookingID: number;
  PaymentMethod: PaymentMethod;
  Amount: number;
  PaymentCode: string;
  TransactionCode: string | null;
  GatewayOrderId: string | null;
  GatewayRequestId: string | null;
  GatewayResponse: string | null;
  Status: PaymentStatus;
  PaidAt: Date | null;
  FailedAt: Date | null;
  ExpiredAt: Date | null;
  CreatedAt: Date;
  UpdatedAt: Date | null;
};

// ── Booking row cần cho payment ───────────────────────

/**
 * Booking data cần thiết cho payment module.
 * Query riêng trong payments.repository – không gọi booking service.
 */
export type BookingForPayment = {
  BookingID: number;
  BookingCode: string;
  UserID: number;
  BookingType: "Court" | "Coach" | "Combo";
  TotalAmount: number;
  Status: string; // PendingPayment | Confirmed | Cancelled | ...
  // BookingDetails join
  SlotID: number | null;
  CoachScheduleID: number | null;
};

// ── Input types ───────────────────────────────────────

export type CreatePaymentInput = {
  bookingId: number;
  userId: number;
  paymentMethod: PaymentMethod;
};

export type CreatePendingPaymentData = {
  bookingId: number;
  paymentMethod: PaymentMethod;
  amount: number;
  paymentCode: string;
};

export type MarkPaymentPaidData = {
  paymentId: number;
  bookingId: number;
  transactionCode: string;
  gatewayResponse: string;
  // Slot/schedule IDs để update status (từ BookingDetails)
  slotId: number | null;
  coachScheduleId: number | null;
};

export type MarkPaymentFailedData = {
  paymentId: number;
  gatewayResponse: string;
};

// ── PayOS Webhook body ──────────────────────────────

/**
 * Body từ PayOS webhook POST (server-to-server).
 * Cấu trúc theo payOS docs v2.
 */
export type PayosWebhookBody = {
  code: string;
  desc: string;
  success: boolean;
  data: {
    orderCode: number;
    amount: number;
    description: string;
    accountNumber: string;
    reference: string;
    transactionDateTime: string;
    currency: string;
    paymentLinkId: string;
    code: string;
    desc: string;
    counterAccountBankId?: string;
    counterAccountBankName?: string;
    counterAccountName?: string;
    counterAccountNumber?: string;
    virtualAccountName?: string;
    virtualAccountNumber?: string;
  };
  signature: string;
};

// ── MoMo Webhook body ──────────────────────────────

export type MomoWebhookBody = {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
};

// ── Response types ────────────────────────────────────

export type CreatePaymentResponse = {
  paymentId: number;
  bookingId: number;
  paymentCode: string;
  paymentMethod: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  expiredAt: Date;
  paymentUrl: string;
  gatewayOrderId?: string; // PayOS: orderCode dạng string
};

export type PaymentStatusResponse = {
  bookingId: number;
  bookingStatus: string;
  bookingCode?: string | null; // Added to return the real BookingCode
  bookingType?: string | null; // Added to distinguish booking types
  paymentId: number | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentCode: string | null;
  amount: number | null;
  expiredAt: Date | null;
  paidAt: Date | null;
  failedAt: Date | null;
  gatewayOrderId: string | null; // PayOS: để frontend có thể query status
};
