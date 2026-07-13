// ==========================================
// refunds.service.ts
// Business logic cho Refund module
// BR-33, BR-34, BR-35, BR-36, BR-37, BR-38, BR-39,
// BR-54, BR-71, BR-76, BR-87
// ==========================================

import * as refundRepo from "./refunds.repository";
import { processMomoRefund as callMomoRefundGateway } from "./momo-refund.helper";
import type { RefundManagerRecord, RefundMethod, RefundRecord, RefundResult } from "./refunds.type";
import { createNotification } from "@/modules/notifications/notifications.service";

// ── Helper: Tạo RefundCode unique ─────────────────────

/**
 * Sinh RefundCode dạng RF-{bookingId}-{yyyyMMddHHmmss}-{rand6}
 * Lưu vào DB — là cột thật, không phải virtual.
 */
function generateRefundCode(bookingId: number): string {
  const now = new Date();
  // UTC+7
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts =
    `${vn.getUTCFullYear()}` +
    `${pad(vn.getUTCMonth() + 1)}` +
    `${pad(vn.getUTCDate())}` +
    `${pad(vn.getUTCHours())}` +
    `${pad(vn.getUTCMinutes())}` +
    `${pad(vn.getUTCSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RF-${bookingId}-${ts}-${rand}`;
}

// ── Helper: Tính refund amount ─────────────────────────

/**
 * Tính refund amount dựa trên thời gian còn lại trước giờ chơi (múi giờ UTC+7).
 * BR-33: >= 12h → 100%
 * BR-34: 2h–12h → 70%
 * BR-35: < 2h → 0%
 */
export function calculateRefundAmount(
  bookingDate: string | Date,
  startTime: string | Date | any,
  paidAmount: number
): { amount: number; percent: number } {
  // Parse bookingDate thành yyyy-MM-dd
  let dateStr = "";
  if (typeof bookingDate === "string") {
    dateStr = bookingDate.split("T")[0];
  } else {
    const yyyy = bookingDate.getFullYear();
    const mm = String(bookingDate.getMonth() + 1).padStart(2, "0");
    const dd = String(bookingDate.getDate()).padStart(2, "0");
    dateStr = `${yyyy}-${mm}-${dd}`;
  }

  // Parse startTime thành HH:mm
  let timeStr = "";
  if (typeof startTime === "string") {
    // Có thể dạng "07:00:00" hoặc "07:00"
    timeStr = startTime.slice(0, 5);
  } else if (startTime instanceof Date) {
    const hh = String(startTime.getUTCHours()).padStart(2, "0");
    const mm = String(startTime.getUTCMinutes()).padStart(2, "0");
    timeStr = `${hh}:${mm}`;
  } else {
    timeStr = "00:00";
  }

  // Parse datetime với timezone UTC+7
  const playDateTime = new Date(`${dateStr}T${timeStr}:00+07:00`);
  const now = new Date();
  const diffHours = (playDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours >= 12) {
    return { amount: Math.round(paidAmount), percent: 100 }; // BR-33
  } else if (diffHours >= 2) {
    return { amount: Math.round(paidAmount * 0.7), percent: 70 }; // BR-34
  } else {
    return { amount: 0, percent: 0 }; // BR-35
  }
}

// ── API: Request Refund ────────────────────────────────

/**
 * Player yêu cầu hoàn tiền.
 * POST /api/refunds/request
 */
export async function requestRefund(
  bookingId: number,
  userId: number,
  reason: string
): Promise<RefundResult> {
  // 1. Lấy booking — check ownership
  const booking = await refundRepo.findRefundableBooking(bookingId, userId);
  if (!booking) {
    throw Object.assign(
      new Error("Không tìm thấy booking hoặc bạn không có quyền."),
      { statusCode: 403 }
    );
  }

  // 2. Booking phải đang Paid hoặc Confirmed
  if (!["Paid", "Confirmed"].includes(booking.Status)) {
    throw Object.assign(
      new Error(`Chỉ booking đã thanh toán (Paid/Confirmed) mới được hoàn tiền. Trạng thái hiện tại: ${booking.Status}`),
      { statusCode: 400 }
    );
  }

  // 3. Không cho double refund (check active refund)
  const hasActive = await refundRepo.hasActiveRefund(bookingId);
  if (hasActive) {
    throw Object.assign(
      new Error("Booking này đang có yêu cầu hoàn tiền đang xử lý."),
      { statusCode: 409 }
    );
  }

  // 4. Tìm payment Paid
  const payment = await refundRepo.findPaidPaymentByBookingId(bookingId);
  if (!payment) {
    throw Object.assign(
      new Error("Chưa có payment thành công (Paid) cho booking này."),
      { statusCode: 400 }
    );
  }

  // 5. Tính refund amount (backend authority — không nhận từ frontend) (BR-71)
  const { amount: refundAmount, percent } = calculateRefundAmount(
    booking.BookingDate,
    booking.StartTime,
    Number(payment.Amount)
  );

  if (refundAmount <= 0) {
    throw Object.assign(
      new Error("Thời gian hủy dưới 2 giờ, không được hoàn tiền (BR-35)."),
      { statusCode: 400 }
    );
  }

  if (refundAmount > Number(payment.Amount)) {
    throw Object.assign(
      new Error("Số tiền hoàn không được vượt quá số tiền đã thanh toán (BR-71)."),
      { statusCode: 400 }
    );
  }

  // 6. Xác định RefundMethod theo PaymentMethod (BR-36)
  const refundMethod: RefundMethod =
    payment.PaymentMethod === "Momo" ? "Momo" : "PayOSManual";

  // 7. Sinh RefundCode unique
  const refundCode = generateRefundCode(bookingId);

  // 8. Tạo Refund record
  const refundId = await refundRepo.createRefundRecord({
    bookingId,
    paymentId: payment.PaymentID,
    refundCode,
    refundAmount,
    refundMethod,
    reason,
    createdBy: userId,
  });

  // 9. Hủy booking và giải phóng slot/coach (BR-39: booking cancelled không thanh toán lại)
  await refundRepo.cancelBookingForRefund(
    bookingId,
    `Hủy booking để yêu cầu hoàn tiền: ${reason.slice(0, 100)}`
  );

  // 10. Xử lý theo PaymentMethod
  let finalStatus = "Requested";
  let message = "";

  if (refundMethod === "Momo") {
    // MoMo: thử auto-refund ngay, nếu không có config thì PendingManual
    try {
      await refundRepo.updateRefundStatus({
        refundId,
        status: "Processing",
      });
      await _processMomoRefundInternal(refundId, payment, refundAmount, refundCode);
      finalStatus = "Completed";
      message = `Đã hoàn tiền tự động ${refundAmount.toLocaleString("vi-VN")} VND qua MoMo.`;
    } catch (err: any) {
      // Nếu lỗi (thiếu config hoặc MoMo error) → PendingManual, chờ admin xử lý
      await refundRepo.updateRefundStatus({
        refundId,
        status: "PendingManual",
        gatewayResponse: `[Auto Refund Failed]: ${err.message}`,
      });
      finalStatus = "PendingManual";
      message = `Hoàn tiền MoMo tự động không thành công: ${err.message}. Yêu cầu đã chuyển sang chờ xử lý thủ công bởi Admin/Manager.`;
    }
  } else {
    // PayOS/VietQR: luôn là manual (tiền đã về tài khoản ngân hàng thật)
    await refundRepo.updateRefundStatus({
      refundId,
      status: "PendingManual",
    });
    finalStatus = "PendingManual";
    message = `Yêu cầu hoàn tiền ${refundAmount.toLocaleString("vi-VN")} VND đã được ghi nhận. Admin/Manager sẽ chuyển khoản thủ công trong tối đa 7 ngày làm việc (BR-37).`;
  }

  // 11. AuditLog (BR-76)
  void refundRepo.createAuditLog(
    userId,
    "REFUND_REQUEST",
    "Refunds",
    refundId,
    `User ${userId} yêu cầu hoàn tiền ${refundAmount} VND cho booking ${bookingId}. RefundCode: ${refundCode}`
  );

  return {
    refundId,
    refundCode,
    bookingId,
    paymentId: payment.PaymentID,
    refundAmount,
    refundPercent: percent,
    refundMethod,
    status: finalStatus as any,
    message,
  };
}

// ── API: Coach Cancel Refund (BR-54) ───────────────────

/**
 * BR-54: Hoàn tiền 100% khi Coach chủ động hủy booking Confirmed.
 * Khác requestRefund:
 *   - Không check ownership (coach cancel thay mặt player).
 *   - Không tính theo thời gian — luôn hoàn 100% tổng tiền đã trả.
 *   - Không throw nếu < 2h trước giờ chơi.
 * Gọi nội bộ từ bookings.service.cancelBookingByCoach.
 */
export async function requestCoachCancelRefund(
  bookingId: number,
  bookingOwnerId: number,
  reason: string
): Promise<RefundResult> {
  // 1. Kiểm tra không double refund
  const hasActive = await refundRepo.hasActiveRefund(bookingId);
  if (hasActive) {
    throw Object.assign(
      new Error("Booking này đang có yêu cầu hoàn tiền đang xử lý."),
      { statusCode: 409 }
    );
  }

  // 2. Tìm payment Paid
  const payment = await refundRepo.findPaidPaymentByBookingId(bookingId);
  if (!payment) {
    throw Object.assign(
      new Error("Chưa có payment thành công (Paid) cho booking này."),
      { statusCode: 400 }
    );
  }

  // 3. BR-54: Luôn hoàn 100% — không phụ thuộc vào thời gian
  const refundAmount = Math.round(Number(payment.Amount));
  const percent = 100;

  // 4. Xác định method theo PaymentMethod gốc (BR-36)
  const refundMethod: RefundMethod =
    payment.PaymentMethod === "Momo" ? "Momo" : "PayOSManual";

  // 5. Sinh RefundCode
  const refundCode = generateRefundCode(bookingId);

  // 6. Tạo Refund record — createdBy = bookingOwnerId (chủ booking được hoàn tiền)
  const refundId = await refundRepo.createRefundRecord({
    bookingId,
    paymentId: payment.PaymentID,
    refundCode,
    refundAmount,
    refundMethod,
    reason,
    createdBy: bookingOwnerId,
  });

  // 7. Cancel booking VÀ giải phóng slot/schedule (PHẢI sau khi tạo refund record)
  await refundRepo.cancelBookingForRefund(
    bookingId,
    `[Coach Cancel BR-54] ${reason.slice(0, 100)}`
  );

  // 8. Cập nhật trạng thái refund → PendingManual (chờ admin chuyển khoản)
  //    MoMo có thể thử auto-refund, nhưng để đơn giản và an toàn, dùng PendingManual cho cả hai
  await refundRepo.updateRefundStatus({
    refundId,
    status: "PendingManual",
  });

  // 9. AuditLog (BR-76)
  void refundRepo.createAuditLog(
    null,
    "REFUND_COACH_CANCEL_BR54",
    "Refunds",
    refundId,
    `Coach cancel BR-54: hoàn 100% (${refundAmount} VND) cho booking ${bookingId}. RefundCode: ${refundCode}`
  );

  return {
    refundId,
    refundCode,
    bookingId,
    paymentId: payment.PaymentID,
    refundAmount,
    refundPercent: percent,
    refundMethod,
    status: "PendingManual" as any,
    message: `Yêu cầu hoàn tiền 100% (${refundAmount.toLocaleString("vi-VN")} VND) đã được ghi nhận (BR-54). Admin sẽ xử lý trong 24 giờ.`,
  };
}

// ── Internal: MoMo auto-refund ─────────────────────────

/**
 * Nội bộ — gọi MoMo Refund Gateway.
 * Chỉ gọi khi status đang Processing.
 * Nếu thiếu config → throw (caller sẽ fallback sang PendingManual).
 */
async function _processMomoRefundInternal(
  refundId: number,
  payment: any,
  refundAmount: number,
  refundCode: string
): Promise<void> {
  // Extract transId từ GatewayResponse của payment gốc
  let transId = 0;
  if (payment.GatewayResponse) {
    try {
      const parsed = JSON.parse(payment.GatewayResponse);
      transId = Number(parsed.transId || parsed.transid || 0);
    } catch {
      // Fallback: tìm transId trong raw string
      const match = payment.GatewayResponse.match(/"transId"\s*:\s*(\d+)/);
      transId = match ? Number(match[1]) : 0;
    }
  }

  if (!transId && payment.TransactionCode) {
    // Thử parse từ TransactionCode
    const cleaned = payment.TransactionCode.replace(/\D/g, "");
    transId = Number(cleaned) || 0;
  }

  const momoResponse = await callMomoRefundGateway(
    {
      orderId: payment.TransactionCode || payment.GatewayOrderId || `ORDER-${payment.PaymentID}`,
      amount: Number(payment.Amount),
      transId,
      refundAmount,
    },
    refundCode
  );

  if (momoResponse.resultCode === 0) {
    // MoMo success
    await refundRepo.updateRefundStatus({
      refundId,
      status: "Completed",
      setProcessedAt: true,
      gatewayRefundId: String(momoResponse.momoRefundId || momoResponse.transId || ""),
      gatewayResponse: JSON.stringify(momoResponse),
    });

    // Mark payment refunded nếu full refund
    const refund = await refundRepo.getRefundById(refundId);
    if (refund && Number(refund.RefundAmount) === Number(payment.Amount)) {
      await refundRepo.markPaymentRefunded(payment.PaymentID);
    }

    // Update booking → Refunded
    await refundRepo.markBookingRefunded(payment.BookingID);
  } else {
    await refundRepo.updateRefundStatus({
      refundId,
      status: "Failed",
      setProcessedAt: true,
      gatewayResponse: JSON.stringify(momoResponse),
    });
    throw new Error(`MoMo refund failed: ${momoResponse.message || momoResponse.resultCode}`);
  }
}

// ── API: Approve Refund ────────────────────────────────

/**
 * Manager/Admin approve yêu cầu refund.
 * POST /api/refunds/approve
 * - Nếu refundMethod = Momo → Processing
 * - Nếu refundMethod = PayOSManual → PendingManual (chờ manual transfer)
 */
export async function approveRefund(
  refundCode: string,
  approvedBy: number
): Promise<{ success: boolean; message: string; newStatus: string }> {
  const refund = await refundRepo.getRefundByCode(refundCode);
  if (!refund) {
    throw Object.assign(new Error("Không tìm thấy refund với mã này."), { statusCode: 404 });
  }

  if (!["Requested"].includes(refund.Status)) {
    throw Object.assign(
      new Error(`Chỉ có thể duyệt refund đang ở trạng thái Requested. Hiện tại: ${refund.Status}`),
      { statusCode: 400 }
    );
  }

  const newStatus = refund.RefundMethod === "Momo" ? "Processing" : "PendingManual";

  await refundRepo.updateRefundStatus({
    refundId: refund.RefundID,
    status: newStatus as any,
    processedBy: approvedBy,
  });

  void refundRepo.createAuditLog(
    approvedBy,
    "REFUND_APPROVE",
    "Refunds",
    refund.RefundID,
    `Admin ${approvedBy} duyệt refund ${refundCode} → ${newStatus}`
  );

  void createNotification({
    userId: refund.CreatedBy as number,
    title: "Yêu cầu hoàn tiền được chấp nhận",
    message: `Yêu cầu hoàn tiền cho Booking #${refund.BookingID} đã được chấp nhận và đang được xử lý.`,
    notificationType: "System",
  });

  const message =
    newStatus === "Processing"
      ? "Đã duyệt yêu cầu hoàn tiền MoMo. Hệ thống đang xử lý tự động."
      : "Đã duyệt yêu cầu hoàn tiền. Vui lòng chuyển khoản thủ công cho khách rồi bấm Complete Manual.";

  return { success: true, message, newStatus };
}

// ── API: Process MoMo Refund ───────────────────────────

/**
 * Manager/Admin kích hoạt MoMo refund tự động.
 * POST /api/refunds/process
 * Chỉ dùng cho RefundMethod = Momo và Status = Processing.
 */
export async function processMomoRefund(
  refundCode: string,
  processedBy: number
): Promise<{ success: boolean; message: string }> {
  const refund = await refundRepo.getRefundByCode(refundCode);
  if (!refund) {
    throw Object.assign(new Error("Không tìm thấy refund."), { statusCode: 404 });
  }

  if (refund.RefundMethod !== "Momo") {
    throw Object.assign(
      new Error("API này chỉ dành cho MoMo refund."),
      { statusCode: 400 }
    );
  }

  if (!["Processing", "PendingManual"].includes(refund.Status)) {
    throw Object.assign(
      new Error(`Refund phải ở trạng thái Processing hoặc PendingManual. Hiện tại: ${refund.Status}`),
      { statusCode: 400 }
    );
  }

  // Đảm bảo status = Processing trước khi gọi gateway
  if (refund.Status !== "Processing") {
    await refundRepo.updateRefundStatus({
      refundId: refund.RefundID,
      status: "Processing",
      processedBy,
    });
  }

  if (!refund.BookingID || !refund.PaymentID) {
    throw Object.assign(
      new Error("Không tìm thấy thông tin Booking hoặc Payment cho yêu cầu hoàn tiền MoMo."),
      { statusCode: 400 }
    );
  }

  // Lấy payment trực tiếp theo PaymentID từ refund record (không query theo BookingID+Paid
  // vì sau khi booking bị cancel, payment status có thể không còn là Paid)
  const payment = await _getPaymentForRefund(refund.BookingID, refund.PaymentID);
  if (!payment) {
    throw Object.assign(new Error("Không tìm thấy thông tin payment gốc (PaymentID: " + refund.PaymentID + ")."), { statusCode: 400 });
  }

  try {
    await _processMomoRefundInternal(
      refund.RefundID,
      payment,
      Number(refund.RefundAmount),
      refund.RefundCode || refundCode
    );

    void refundRepo.createAuditLog(
      processedBy,
      "REFUND_MOMO_PROCESS",
      "Refunds",
      refund.RefundID,
      `Admin ${processedBy} xử lý MoMo refund ${refundCode} thành công`
    );

    void createNotification({
      userId: refund.CreatedBy as number,
      title: "Hoàn tiền MoMo thành công",
      message: `Số tiền ${Number(refund.RefundAmount).toLocaleString("vi-VN")} VND cho Booking #${refund.BookingID} đã được hoàn tự động qua MoMo.`,
      notificationType: "System",
    });

    return { success: true, message: "Hoàn tiền MoMo tự động thành công." };
  } catch (err: any) {
    void refundRepo.createAuditLog(
      processedBy,
      "REFUND_MOMO_PROCESS_FAILED",
      "Refunds",
      refund.RefundID,
      `Admin ${processedBy} xử lý MoMo refund ${refundCode} thất bại: ${err.message}`
    );
    throw err;
  }
}

// ── API: Complete Manual Refund ────────────────────────

/**
 * Manager/Admin xác nhận đã chuyển khoản thủ công.
 * POST /api/refunds/complete-manual
 * Dùng cho PayOS/VietQR và bất kỳ manual refund nào.
 */
export async function completeManualRefund(
  refundCode: string,
  processedBy: number,
  billImage: { buffer: Buffer; filename: string; mimeType: string }
): Promise<{ success: boolean; message: string }> {
  const refund = await refundRepo.getRefundByCode(refundCode);
  if (!refund) {
    throw Object.assign(new Error("Không tìm thấy refund."), { statusCode: 404 });
  }

  // Fix bug: accept cả PendingManual và Processing
  if (!["PendingManual", "Processing"].includes(refund.Status)) {
    throw Object.assign(
      new Error(`Chỉ có thể hoàn tất refund đang ở trạng thái PendingManual hoặc Processing. Hiện tại: ${refund.Status}`),
      { statusCode: 400 }
    );
  }

  const gatewayResponse = `[Hoàn tất thủ công lúc ${new Date().toISOString()} bởi UserID: ${processedBy}] [Có kèm Bill: ${billImage.filename}]`;

  await refundRepo.updateRefundStatus({
    refundId: refund.RefundID,
    status: "Completed",
    setProcessedAt: true,
    processedBy,
    gatewayResponse,
  });

  // Update Booking / Tournament Registration and Payment Status
  if (refund.RegistrationID) {
    // ── TOURNAMENT REFUND FLOW ──
    const { getPool } = await import("@/database/connection");
    const sql = await import("mssql");
    await refundRepo.rejectTournamentRegistration(refund.RegistrationID);
    if (refund.TournamentPaymentID) {
      await refundRepo.markTournamentPaymentRefunded(refund.TournamentPaymentID);
    }
    
    // Send email / push notification to the user
    try {
      const pool = await getPool();
      const regResult = await pool.request()
        .input("RegistrationID", sql.Int, refund.RegistrationID)
        .query("SELECT RegisteredBy, TournamentID, DivisionID FROM TournamentRegistrations WHERE RegistrationID = @RegistrationID");
      const reg = regResult.recordset[0];
      if (reg) {
        const namesResult = await pool.request()
          .input("TournamentID", sql.Int, reg.TournamentID)
          .input("DivisionID", sql.Int, reg.DivisionID)
          .query(`
            SELECT t.TournamentName, d.DivisionName 
            FROM Tournaments t, TournamentDivisions d
            WHERE t.TournamentID = @TournamentID AND d.DivisionID = @DivisionID
          `);
        const names = namesResult.recordset[0] || {};
        
        // Notify in-app to CUSTOMER
        void createNotification({
          userId: reg.RegisteredBy,
          title: "Hoàn tiền đăng ký giải đấu thành công",
          message: `Lệ phí đăng ký nội dung ${names.DivisionName || ""} tại giải ${names.TournamentName || ""} của bạn đã được hoàn trả thành công.`,
          notificationType: "System",
        });

        // Send email to CUSTOMER with bill image
        const userRes = await pool.request()
          .input("UserID", sql.Int, reg.RegisteredBy)
          .query("SELECT Email, FullName FROM Users WHERE UserID = @UserID");
        const user = userRes.recordset[0];
        if (user && user.Email) {
          const { sendTournamentRefundCompletedEmail } = await import("../../utils/mail");
          void sendTournamentRefundCompletedEmail(user.Email, {
            tournamentName: names.TournamentName || "Giải đấu",
            divisionName: names.DivisionName || "Nội dung",
            amount: refund.RefundAmount,
            billImage: billImage,
          });
        }
      }
    } catch (err: any) {
      console.error("[Refund] Failed to send tournament rejection completion notification:", err.message);
    }

    // Notify in-app to STAFF (who requested the rejection)
    void createNotification({
      userId: refund.CreatedBy as number,
      title: "Hoàn tiền giải đấu thành công",
      message: `Đã hoàn tất chuyển khoản số tiền ${Number(refund.RefundAmount).toLocaleString("vi-VN")} VND cho đăng ký giải đấu ID: ${refund.RegistrationID}.`,
      notificationType: "System",
    });

  } else {
    // ── BOOKING REFUND FLOW ──
    if (!refund.BookingID || !refund.PaymentID) {
      throw Object.assign(
        new Error("Không tìm thấy thông tin Booking hoặc Payment cho yêu cầu hoàn tiền."),
        { statusCode: 400 }
      );
    }
    await refundRepo.markBookingRefunded(refund.BookingID);

    // Nếu full refund → Update Payment → Refunded
    const payment = await _getPaymentForRefund(refund.BookingID, refund.PaymentID);
    if (payment && Number(refund.RefundAmount) >= Number(payment.Amount)) {
      await refundRepo.markPaymentRefunded(refund.PaymentID);
    }

    let targetBankInfo = "tài khoản ngân hàng của bạn";
    if (refund.Reason) {
      const bankMatch = refund.Reason.match(/\[Bank:(.+?)\]/);
      const accountMatch = refund.Reason.match(/\[Account:(.+?)\]/);
      const nameMatch = refund.Reason.match(/\[Name:(.+?)\]/);
      if (bankMatch && accountMatch && nameMatch) {
        targetBankInfo = `tài khoản ${bankMatch[1]} - ${accountMatch[1]} - ${nameMatch[1]}`;
      }
    }

    // Notify in-app to CUSTOMER (who requested the refund)
    void createNotification({
      userId: refund.CreatedBy as number,
      title: "Hoàn tiền thành công",
      message: `Đã hoàn số tiền ${Number(refund.RefundAmount).toLocaleString("vi-VN")} VND về ${targetBankInfo}.`,
      notificationType: "System",
    });

    // Send email to CUSTOMER with bill image
    try {
      const { getPool, sql } = await import("@/database/connection");
      const pool = await getPool();
      const userRes = await pool.request().input("UID", sql.Int, refund.CreatedBy).query("SELECT Email FROM Users WHERE UserID = @UID");
      const bookingRes = await pool.request().input("BID", sql.Int, refund.BookingID).query("SELECT BookingCode FROM Bookings WHERE BookingID = @BID");
      const bookingCode = bookingRes.recordset[0]?.BookingCode || "N/A";
      
      if (userRes.recordset[0]?.Email) {
        const { sendRefundCompletedEmail } = await import("@/utils/mail");
        void sendRefundCompletedEmail(userRes.recordset[0].Email, {
          bookingCode: bookingCode,
          amount: refund.RefundAmount,
          billImage: billImage,
        });
      }
    } catch (err: any) {
      console.error("[Refund] Failed to send booking refund completion email:", err.message);
    }
  }

  void refundRepo.createAuditLog(
    processedBy,
    "REFUND_COMPLETE_MANUAL",
    "Refunds",
    refund.RefundID,
    `Admin ${processedBy} hoàn tất thủ công refund ${refundCode}.`
  );

  return { success: true, message: "Hoàn tiền thủ công đã được xác nhận thành công." };
}

// ── API: Reject Refund ─────────────────────────────────

/**
 * Manager/Admin từ chối yêu cầu hoàn tiền.
 * POST /api/refunds/reject
 */
export async function rejectRefund(
  refundCode: string,
  rejectedBy: number,
  rejectReason: string
): Promise<{ success: boolean; message: string }> {
  const refund = await refundRepo.getRefundByCode(refundCode);
  if (!refund) {
    throw Object.assign(new Error("Không tìm thấy refund."), { statusCode: 404 });
  }

  // Fix bug: accept Requested, Processing, PendingManual
  if (!["Requested", "Approved", "Processing", "PendingManual"].includes(refund.Status)) {
    throw Object.assign(
      new Error(`Chỉ có thể từ chối refund đang ở trạng thái Requested, Processing hoặc PendingManual. Hiện tại: ${refund.Status}`),
      { statusCode: 400 }
    );
  }

  await refundRepo.updateRefundStatus({
    refundId: refund.RefundID,
    status: "Rejected",
    setProcessedAt: true,
    processedBy: rejectedBy,
    gatewayResponse: `[Từ chối bởi UserID ${rejectedBy}]: ${rejectReason}`,
  });

  void refundRepo.createAuditLog(
    rejectedBy,
    "REFUND_REJECT",
    "Refunds",
    refund.RefundID,
    `Admin ${rejectedBy} từ chối refund ${refundCode}: ${rejectReason}`
  );

  void createNotification({
    userId: refund.CreatedBy as number,
    title: "Yêu cầu hoàn tiền bị từ chối",
    message: `Yêu cầu hoàn tiền cho Booking #${refund.BookingID} đã bị từ chối. Lý do: ${rejectReason}`,
    notificationType: "System",
  });

  return { success: true, message: "Đã từ chối yêu cầu hoàn tiền." };
}

// ── API: Get Status ────────────────────────────────────

/**
 * Lấy trạng thái refund theo RefundCode.
 * Player chỉ xem của mình (check ở controller).
 */
export async function getRefundStatus(refundCode: string): Promise<RefundRecord | null> {
  return await refundRepo.getRefundByCode(refundCode);
}

// ── API: Get My Refunds ────────────────────────────────

export async function getMyRefunds(userId: number): Promise<RefundRecord[]> {
  return await refundRepo.getMyRefunds(userId);
}

// ── API: Get Manager Refunds ───────────────────────────

export async function getManagerRefunds(filters?: {
  status?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<RefundManagerRecord[]> {
  return await refundRepo.getManagerRefunds(filters);
}

// ── Internal helper ────────────────────────────────────

/**
 * Lấy payment theo PaymentID — dùng cho refund processing.
 * Không filter theo Status vì sau cancel booking, status payment đã thay đổi.
 */
async function _getPaymentForRefund(bookingId: number, paymentId: number) {
  try {
    const { getPool, sql } = await import("@/database/connection");
    const pool = await getPool();
    const result = await pool
      .request()
      .input("PaymentID", sql.Int, paymentId)
      .query(`
        SELECT
          PaymentID, BookingID, PaymentMethod, Amount,
          TransactionCode, GatewayResponse, Status
        FROM Payments
        WHERE PaymentID = @PaymentID
      `);
    return result.recordset[0] ?? null;
  } catch {
    return null;
  }
}
