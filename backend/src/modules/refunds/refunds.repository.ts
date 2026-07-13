// ==========================================
// refunds.repository.ts
// Database queries cho Refund module
// ==========================================

import { getPool, sql } from "@/database/connection";
import type {
  CreateRefundInput,
  RefundManagerRecord,
  RefundRecord,
  RefundStatus,
  UpdateRefundStatusInput,
} from "./refunds.type";

// ── Booking & Payment queries ──────────────────────────

/**
 * Lấy booking của đúng user, bao gồm StartTime từ BookingDetails.
 * Dùng cho refund request ownership check.
 */
export async function findRefundableBooking(bookingId: number, userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT
        b.BookingID,
        b.BookingCode,
        b.UserID,
        b.Status,
        b.BookingDate,
        b.TotalAmount,
        (
          SELECT TOP 1 StartTime
          FROM BookingDetails bd
          WHERE bd.BookingID = b.BookingID
          ORDER BY StartTime ASC
        ) AS StartTime
      FROM Bookings b
      WHERE b.BookingID = @BookingID
        AND b.UserID = @UserID
    `);
  return result.recordset[0] ?? null;
}

/**
 * Lấy payment Paid mới nhất của booking.
 * BR-36: refund phải về đúng payment gốc.
 */
export async function findPaidPaymentByBookingId(bookingId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .query(`
      SELECT TOP 1
        PaymentID,
        BookingID,
        PaymentMethod,
        Amount,
        TransactionCode,
        GatewayResponse,
        Status
      FROM Payments
      WHERE BookingID = @BookingID
        AND Status = 'Paid'
      ORDER BY PaidAt DESC
    `);
  return result.recordset[0] ?? null;
}

/**
 * Kiểm tra booking đã có refund active chưa.
 * BR idempotent: không double refund.
 * Check cả PendingManual để không bỏ sót PayOS refunds.
 */
export async function hasActiveRefund(bookingId: number): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .query(`
      SELECT TOP 1 RefundID
      FROM Refunds
      WHERE BookingID = @BookingID
        AND Status IN ('Requested', 'Approved', 'Processing', 'PendingManual')
    `);
  return !!result.recordset[0];
}

// ── Create ────────────────────────────────────────────

/**
 * Tạo refund record với đầy đủ thông tin.
 * BR-87: không hard delete — chỉ insert, không bao giờ delete.
 */
export async function createRefundRecord(input: CreateRefundInput): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("BookingID", sql.Int, input.bookingId || null)
    .input("PaymentID", sql.Int, input.paymentId || null)
    .input("RegistrationID", sql.Int, input.registrationId || null)
    .input("TournamentPaymentID", sql.Int, input.tournamentPaymentId || null)
    .input("RefundCode", sql.NVarChar(100), input.refundCode)
    .input("RefundMethod", sql.NVarChar(50), input.refundMethod)
    .input("RefundAmount", sql.Decimal(18, 2), input.refundAmount)
    .input("Reason", sql.NVarChar(500), input.reason)
    .input("CreatedBy", sql.Int, input.createdBy)
    .query(`
      INSERT INTO Refunds
        (BookingID, PaymentID, RegistrationID, TournamentPaymentID, RefundCode, RefundMethod, RefundAmount, Reason, Status, CreatedBy, RequestedAt)
      OUTPUT INSERTED.RefundID
      VALUES
        (@BookingID, @PaymentID, @RegistrationID, @TournamentPaymentID, @RefundCode, @RefundMethod, @RefundAmount, @Reason, 'Requested', @CreatedBy, GETDATE())
    `);
  return result.recordset[0].RefundID as number;
}

// ── Read ──────────────────────────────────────────────

/**
 * Lấy refund theo RefundCode (cột thật trong DB, không phải virtual).
 */
export async function getRefundByCode(refundCode: string): Promise<RefundRecord | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("RefundCode", sql.NVarChar(100), refundCode)
    .query(`
      SELECT
        r.RefundID, r.BookingID, r.PaymentID, r.RegistrationID, r.TournamentPaymentID,
        r.RefundCode, r.RefundMethod, r.RefundAmount, r.Reason,
        r.GatewayRefundId, r.GatewayResponse,
        r.Status, r.RequestedAt, r.ProcessedAt,
        r.CreatedBy, r.ProcessedBy, r.UpdatedAt,
        COALESCE(p.PaymentMethod, tp.PaymentMethod) AS PaymentMethod
      FROM Refunds r
      LEFT JOIN Payments p ON p.PaymentID = r.PaymentID
      LEFT JOIN TournamentPayments tp ON tp.TournamentPaymentID = r.TournamentPaymentID
      WHERE r.RefundCode = @RefundCode
    `);
  return result.recordset[0] ?? null;
}

/**
 * Lấy refund theo RefundID (dùng nội bộ service).
 */
export async function getRefundById(refundId: number): Promise<RefundRecord | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("RefundID", sql.Int, refundId)
    .query(`
      SELECT
        r.RefundID, r.BookingID, r.PaymentID, r.RegistrationID, r.TournamentPaymentID,
        r.RefundCode, r.RefundMethod, r.RefundAmount, r.Reason,
        r.GatewayRefundId, r.GatewayResponse,
        r.Status, r.RequestedAt, r.ProcessedAt,
        r.CreatedBy, r.ProcessedBy, r.UpdatedAt,
        COALESCE(p.PaymentMethod, tp.PaymentMethod) AS PaymentMethod
      FROM Refunds r
      LEFT JOIN Payments p ON p.PaymentID = r.PaymentID
      LEFT JOIN TournamentPayments tp ON tp.TournamentPaymentID = r.TournamentPaymentID
      WHERE r.RefundID = @RefundID
    `);
  return result.recordset[0] ?? null;
}

/**
 * Player xem danh sách refund của chính mình.
 */
export async function getMyRefunds(userId: number): Promise<RefundRecord[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT
        r.RefundID, r.BookingID, r.PaymentID, r.RegistrationID, r.TournamentPaymentID,
        r.RefundCode, r.RefundMethod, r.RefundAmount, r.Reason,
        r.GatewayRefundId, r.GatewayResponse,
        r.Status, r.RequestedAt, r.ProcessedAt,
        r.CreatedBy, r.ProcessedBy, r.UpdatedAt,
        COALESCE(p.PaymentMethod, tp.PaymentMethod) AS PaymentMethod
      FROM Refunds r
      LEFT JOIN Payments p ON p.PaymentID = r.PaymentID
      LEFT JOIN TournamentPayments tp ON tp.TournamentPaymentID = r.TournamentPaymentID
      WHERE r.CreatedBy = @UserID
      ORDER BY r.RequestedAt DESC
    `);
  return result.recordset;
}

/**
 * Manager/Admin xem tất cả refunds với thông tin customer.
 * Có filter tùy chọn.
 */
export async function getManagerRefunds(filters?: {
  status?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<RefundManagerRecord[]> {
  const pool = await getPool();
  const req = pool.request();

  const conditions: string[] = [];

  if (filters?.status) {
    req.input("Status", sql.NVarChar(30), filters.status);
    conditions.push("r.Status = @Status");
  }
  if (filters?.paymentMethod) {
    req.input("PaymentMethod", sql.NVarChar(50), filters.paymentMethod);
    conditions.push("p.PaymentMethod = @PaymentMethod");
  }
  if (filters?.dateFrom) {
    req.input("DateFrom", sql.Date, filters.dateFrom);
    conditions.push("CAST(r.RequestedAt AS DATE) >= @DateFrom");
  }
  if (filters?.dateTo) {
    req.input("DateTo", sql.Date, filters.dateTo);
    conditions.push("CAST(r.RequestedAt AS DATE) <= @DateTo");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await req.query(`
    SELECT
      r.RefundID, r.BookingID, r.PaymentID, r.RegistrationID, r.TournamentPaymentID,
      r.RefundCode, r.RefundMethod, r.RefundAmount, r.Reason,
      r.GatewayRefundId, r.GatewayResponse,
      r.Status, r.RequestedAt, r.ProcessedAt,
      r.CreatedBy, r.ProcessedBy, r.UpdatedAt,
      COALESCE(p.PaymentMethod, tp.PaymentMethod) AS PaymentMethod,
      COALESCE(b.BookingCode, 'REG-' + CAST(r.RegistrationID AS VARCHAR(10))) AS BookingCode,
      u.FullName AS PlayerName,
      u.Email AS PlayerEmail
    FROM Refunds r
    LEFT JOIN Payments p ON p.PaymentID = r.PaymentID
    LEFT JOIN Bookings b ON b.BookingID = r.BookingID
    LEFT JOIN TournamentPayments tp ON tp.TournamentPaymentID = r.TournamentPaymentID
    LEFT JOIN Users u ON u.UserID = COALESCE(b.UserID, r.CreatedBy)
    ${whereClause}
    ORDER BY r.RequestedAt DESC
  `);
  return result.recordset;
}

// ── Update ────────────────────────────────────────────

/**
 * Cập nhật trạng thái refund với các field tùy chọn.
 * Dùng cho mọi trạng thái chuyển tiếp.
 */
export async function updateRefundStatus(input: UpdateRefundStatusInput): Promise<void> {
  const pool = await getPool();
  const req = pool
    .request()
    .input("RefundID", sql.Int, input.refundId)
    .input("Status", sql.NVarChar(30), input.status);

  const setClauses: string[] = ["Status = @Status", "UpdatedAt = GETDATE()"];

  if (input.setProcessedAt) {
    setClauses.push("ProcessedAt = GETDATE()");
  }
  if (input.processedBy !== undefined) {
    req.input("ProcessedBy", sql.Int, input.processedBy);
    setClauses.push("ProcessedBy = @ProcessedBy");
  }
  if (input.gatewayRefundId !== undefined) {
    req.input("GatewayRefundId", sql.NVarChar(255), input.gatewayRefundId);
    setClauses.push("GatewayRefundId = @GatewayRefundId");
  }
  if (input.gatewayResponse !== undefined) {
    req.input("GatewayResponse", sql.NVarChar(sql.MAX), input.gatewayResponse);
    setClauses.push("GatewayResponse = @GatewayResponse");
  }

  await req.query(`
    UPDATE Refunds
    SET ${setClauses.join(", ")}
    WHERE RefundID = @RefundID
  `);
}

/**
 * Đánh dấu Payment đã được refund (khi refund 100%).
 * Chỉ gọi sau khi refund hoàn thành.
 */
export async function markPaymentRefunded(paymentId: number): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("PaymentID", sql.Int, paymentId)
    .query(`
      UPDATE Payments
      SET Status = 'Refunded'
      WHERE PaymentID = @PaymentID
    `);
}

/**
 * Đánh dấu Booking là Refunded sau khi hoàn tiền hoàn tất.
 * BR-38: Booking Refunded không tính doanh thu.
 */
export async function markBookingRefunded(bookingId: number): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .query(`
      UPDATE Bookings
      SET Status = 'Refunded', UpdatedAt = GETDATE()
      WHERE BookingID = @BookingID
    `);
}

/**
 * Cập nhật Booking sang Cancelled khi user yêu cầu refund.
 * Đồng thời giải phóng CourtSlot và CoachSchedule.
 * BR-87: không hard delete.
 */
export async function cancelBookingForRefund(bookingId: number, reason: string): Promise<void> {
  const pool = await getPool();

  // 1. Lấy SlotID và CoachScheduleID từ BookingDetails
  const bdResult = await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .query(`
      SELECT SlotID, CoachScheduleID
      FROM BookingDetails
      WHERE BookingID = @BookingID
    `);

  const bd = bdResult.recordset[0];

  // 2. Giải phóng CourtSlot
  if (bd?.SlotID) {
    await pool
      .request()
      .input("SlotID", sql.Int, bd.SlotID)
      .query(`
        UPDATE CourtSlots
        SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
        WHERE SlotID = @SlotID
      `);
  }

  // 3. Giải phóng CoachSchedule
  if (bd?.CoachScheduleID) {
    await pool
      .request()
      .input("CoachScheduleID", sql.Int, bd.CoachScheduleID)
      .query(`
        UPDATE CoachSchedules
        SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
        WHERE CoachScheduleID = @CoachScheduleID
      `);
  }

  // 4. Cập nhật Booking sang Cancelled
  await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .input("CancelReason", sql.NVarChar(255), reason)
    .query(`
      UPDATE Bookings
      SET Status = 'Cancelled',
          CancelledAt = GETDATE(),
          CancelReason = @CancelReason,
          UpdatedAt = GETDATE()
      WHERE BookingID = @BookingID
    `);
}

/**
 * Ghi AuditLog (BR-76).
 * Không throw nếu lỗi — không block flow chính.
 */
export async function createAuditLog(
  userId: number | null,
  action: string,
  tableName: string,
  entityId: number | null,
  description: string
): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("UserID", sql.Int, userId)
      .input("ActionName", sql.NVarChar(100), action)
      .input("TableName", sql.NVarChar(100), tableName)
      .input("EntityID", sql.Int, entityId)
      .input("Description", sql.NVarChar(500), description.slice(0, 500))
      .query(`
        INSERT INTO AuditLogs (UserID, ActionName, TableName, EntityID, Description, CreatedAt)
        VALUES (@UserID, @ActionName, @TableName, @EntityID, @Description, GETDATE())
      `);
  } catch (err) {
    console.error("[RefundRepo] createAuditLog failed (non-blocking):", err);
  }
}

/**
 * Đánh dấu đăng ký giải đấu là Rejected và hủy đội.
 */
export async function rejectTournamentRegistration(registrationId: number): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const regResult = await new sql.Request(transaction)
      .input("RegistrationID", sql.Int, registrationId)
      .query(`
        UPDATE TournamentRegistrations
        SET RegistrationStatus = 'Rejected', PaymentStatus = 'Failed'
        OUTPUT INSERTED.*
        WHERE RegistrationID = @RegistrationID
      `);
    
    const registration = regResult.recordset[0];
    if (registration) {
      await new sql.Request(transaction)
        .input("TeamID", sql.Int, registration.TeamID)
        .query(`
          UPDATE TournamentTeams
          SET TeamStatus = 'Withdrawn'
          WHERE TeamID = @TeamID
        `);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Đánh dấu TournamentPayment là Refunded.
 */
export async function markTournamentPaymentRefunded(paymentId: number): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("PaymentID", sql.Int, paymentId)
    .query(`
      UPDATE TournamentPayments
      SET PaymentStatus = 'Cancelled'
      WHERE TournamentPaymentID = @PaymentID
    `);
}
