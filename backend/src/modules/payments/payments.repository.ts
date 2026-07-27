// ==========================================
// payments.repository.ts
// DB operations for Payment module (UC-16)
// Pattern: getPool + sql từ @/database/connection (giống bookings.repository.ts)
// TẤT CẢ SQL dùng parameterized query
// ==========================================

import { getPool, sql } from "@/database/connection";
import type {
  BookingForPayment,
  CreatePendingPaymentData,
  MarkPaymentPaidData,
  MarkPaymentFailedData,
  PaymentRow,
  PaymentStatusResponse,
} from "./payments.type";

// ── Find booking for payment ──────────────────────────

/**
 * Lấy booking kèm BookingDetails (SlotID, CoachScheduleID) theo bookingId VÀ userId.
 * Dùng để:
 * - Kiểm tra ownership (booking.UserID === userId).
 * - Lấy TotalAmount để insert Payments.
 * - Lấy SlotID/CoachScheduleID để update sau khi Paid.
 *
 * Không gọi booking service/repository – query riêng để tránh coupling.
 */
export async function findBookingForPayment(
  bookingId: number,
  userId: number
): Promise<BookingForPayment | null> {
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
        b.BookingType,
        b.TotalAmount,
        b.Status,
        bd.SlotID,
        bd.CoachScheduleID
      FROM Bookings b
      LEFT JOIN BookingDetails bd ON bd.BookingID = b.BookingID
      WHERE b.BookingID = @BookingID
        AND b.UserID = @UserID
    `);

  return result.recordset[0] ?? null;
}

// ── Check existing paid payment ───────────────────────

/**
 * BR-66: Mỗi booking chỉ được có tối đa 1 payment thành công.
 * Kiểm tra xem booking đã có payment Paid chưa.
 */
export async function hasPaidPayment(bookingId: number): Promise<boolean> {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .query(`
      SELECT TOP 1 PaymentID
      FROM Payments
      WHERE BookingID = @BookingID
        AND Status = 'Paid'
    `);

  return result.recordset.length > 0;
}

// ── Expire old pending payments ───────────────────────

/**
 * BR-67/BR-10: Nếu có payment Pending cũ đã quá ExpiredAt thì đánh dấu Expired.
 * Gọi trước khi tạo payment mới để dọn sạch stale records.
 * Chỉ expire payment Pending (không expire Failed/Paid/Refunded).
 */
export async function expireOldPendingPayments(
  bookingId: number
): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("BookingID", sql.Int, bookingId)
      .query(`
        -- Expire các payment Pending đã quá hạn
        UPDATE Payments
        SET Status = 'Expired',
            UpdatedAt = GETDATE()
        WHERE BookingID = @BookingID
          AND Status = 'Pending'
          AND ExpiredAt < GETDATE();

        -- Nếu tất cả payment của booking này đã Expired (không có Pending khác còn hạn),
        -- thì booking vẫn giữ nguyên PendingPayment để user có thể retry.
        -- (Booking sẽ bị Cancelled khi hết HoldUntil của slot – do booking module quản lý)
      `);

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ── Create pending payment ────────────────────────────

/**
 * Insert record Payments với Status = 'Pending'.
 * Trả về PaymentID vừa tạo.
 */
export async function createPendingPayment(
  data: CreatePendingPaymentData
): Promise<{ paymentId: number; expiredAt: Date }> {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("BookingID", sql.Int, data.bookingId)
    .input("PaymentMethod", sql.NVarChar(50), data.paymentMethod)
    .input("Amount", sql.Decimal(18, 2), data.amount)
    .input("PaymentCode", sql.NVarChar(100), data.paymentCode)
    .query(`
      INSERT INTO Payments (
        BookingID, PaymentMethod, Amount, PaymentCode,
        Status, ExpiredAt, CreatedAt
      )
      OUTPUT INSERTED.PaymentID, INSERTED.ExpiredAt
      VALUES (
        @BookingID, @PaymentMethod, @Amount, @PaymentCode,
        'Pending', DATEADD(MINUTE, 10, GETDATE()), GETDATE()
      )
    `);

  return {
    paymentId: result.recordset[0].PaymentID as number,
    expiredAt: result.recordset[0].ExpiredAt as Date,
  };
}

// ── Update gateway info after redirect/IPN ────────────

/**
 * Lưu GatewayOrderId, GatewayRequestId, GatewayResponse sau khi gọi gateway.
 * Dùng sau khi tạo MoMo payment link thành công.
 */
export async function updatePaymentGatewayInfo(
  paymentId: number,
  data: {
    gatewayOrderId?: string;
    gatewayRequestId?: string;
    gatewayResponse?: string;
  }
): Promise<void> {
  const pool = await getPool();

  await pool
    .request()
    .input("PaymentID", sql.Int, paymentId)
    .input("GatewayOrderId", sql.NVarChar(100), data.gatewayOrderId ?? null)
    .input("GatewayRequestId", sql.NVarChar(100), data.gatewayRequestId ?? null)
    .input("GatewayResponse", sql.NVarChar(sql.MAX), data.gatewayResponse ?? null)
    .query(`
      UPDATE Payments
      SET GatewayOrderId = @GatewayOrderId,
          GatewayRequestId = @GatewayRequestId,
          GatewayResponse = @GatewayResponse,
          UpdatedAt = GETDATE()
      WHERE PaymentID = @PaymentID
    `);
}

// ── Get payment by code ───────────────────────────────

/**
 * Tìm payment theo PaymentCode (vnp_TxnRef hoặc MoMo orderId).
 * Dùng trong callback/IPN handlers.
 */
export async function getPaymentByCode(
  paymentCode: string
): Promise<PaymentRow | null> {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("PaymentCode", sql.NVarChar(100), paymentCode)
    .query(`
      SELECT
        PaymentID,
        BookingID,
        PaymentMethod,
        Amount,
        PaymentCode,
        TransactionCode,
        GatewayOrderId,
        GatewayRequestId,
        GatewayResponse,
        Status,
        PaidAt,
        FailedAt,
        ExpiredAt,
        CreatedAt,
        UpdatedAt
      FROM Payments
      WHERE PaymentCode = @PaymentCode
    `);

  return result.recordset[0] ?? null;
}

// ── Get payment by GatewayOrderId (PayOS) ─────────────

/**
 * Tìm payment theo GatewayOrderId.
 * Dùng trong PayOS webhook handler (orderCode = paymentId = GatewayOrderId).
 */
export async function getPaymentByGatewayOrderId(
  gatewayOrderId: string
): Promise<PaymentRow | null> {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("GatewayOrderId", sql.NVarChar(100), gatewayOrderId)
    .query(`
      SELECT
        PaymentID,
        BookingID,
        PaymentMethod,
        Amount,
        PaymentCode,
        TransactionCode,
        GatewayOrderId,
        GatewayRequestId,
        GatewayResponse,
        Status,
        PaidAt,
        FailedAt,
        ExpiredAt,
        CreatedAt,
        UpdatedAt
      FROM Payments
      WHERE GatewayOrderId = @GatewayOrderId
    `);

  return result.recordset[0] ?? null;
}

// ── Get payment status for user ───────────────────────

/**
 * API 2: GET /api/payments/status?bookingId=...
 * Lấy trạng thái booking + payment. Chỉ trả nếu booking thuộc userId.
 */
export async function getPaymentStatus(
  bookingId: number,
  userId: number
): Promise<PaymentStatusResponse | null> {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT
        b.BookingID,
        b.BookingCode,
        b.Status AS BookingStatus,
        b.BookingType,
        p.PaymentID,
        p.Status AS PaymentStatus,
        p.PaymentMethod,
        p.PaymentCode,
        p.Amount,
        p.GatewayOrderId,
        p.ExpiredAt,
        p.PaidAt,
        p.FailedAt
      FROM Bookings b
      LEFT JOIN Payments p ON p.BookingID = b.BookingID
      WHERE b.BookingID = @BookingID
        AND b.UserID = @UserID
      ORDER BY p.CreatedAt DESC
      OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
    `);

  const row = result.recordset[0];
  if (!row) return null;

  const toUtcFromLocalDb = (date: Date | null | undefined): Date | null => {
    if (!date) return null;
    return new Date(date.getTime() - 7 * 60 * 60 * 1000);
  };

  return {
    bookingId: row.BookingID,
    bookingStatus: row.BookingStatus,
    bookingCode: row.BookingCode ?? null,
    bookingType: row.BookingType ?? null,
    paymentId: row.PaymentID ?? null,
    paymentStatus: row.PaymentStatus ?? null,
    paymentMethod: row.PaymentMethod ?? null,
    paymentCode: row.PaymentCode ?? null,
    amount: row.Amount ?? null,
    expiredAt: toUtcFromLocalDb(row.ExpiredAt),
    paidAt: toUtcFromLocalDb(row.PaidAt),
    failedAt: toUtcFromLocalDb(row.FailedAt),
    gatewayOrderId: row.GatewayOrderId ?? null,
  };
}

// ── Mark Payment Paid (TRANSACTION - IDEMPOTENT) ──────

/**
 * BR-68: Chỉ update Paid sau khi verify webhook/IPN hợp lệ.
 * BR-66: Chỉ có 1 payment Paid mỗi booking.
 * Idempotent: nếu đã Paid thì không lỗi, return sớm.
 *
 * Dùng SERIALIZABLE transaction để:
 * 1. Update Payments.Status = 'Paid'
 * 2. Update Bookings.Status = 'Confirmed'
 * 3. Update CourtSlots.Status = 'Booked' (nếu có SlotID)
 * 4. Update CoachSchedules.Status = 'Booked' (nếu có CoachScheduleID)
 * 5. Ghi AuditLog (BR-76)
 */
export async function markPaymentPaid(data: MarkPaymentPaidData): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const req = new sql.Request(transaction);

    // Kiểm tra idempotent: nếu payment đã Paid thì bỏ qua
    const checkResult = await req
      .input("PaymentID", sql.Int, data.paymentId)
      .query(`
        SELECT Status FROM Payments
        WHERE PaymentID = @PaymentID
      `);

    const currentStatus = checkResult.recordset[0]?.Status;

    if (currentStatus === "Paid") {
      // Đã xử lý trước đó – idempotent return
      await transaction.commit();
      return;
    }

    // Không cho phép chuyển từ Refunded sang Paid (Failed/Expired được phép để xử lý webhook trễ)
    if (["Refunded"].includes(currentStatus)) {
      await transaction.rollback();
      throw Object.assign(
        new Error(`Không thể chuyển payment từ ${currentStatus} sang Paid`),
        { statusCode: 409 }
      );
    }

    // BR-66: Kiểm tra booking chưa có payment Paid khác
    const req2 = new sql.Request(transaction);
    const dupCheck = await req2
      .input("BookingID_dup", sql.Int, data.bookingId)
      .input("PaymentID_dup", sql.Int, data.paymentId)
      .query(`
        SELECT TOP 1 PaymentID
        FROM Payments
        WHERE BookingID = @BookingID_dup
          AND Status = 'Paid'
          AND PaymentID != @PaymentID_dup
      `);

    if (dupCheck.recordset.length > 0) {
      await transaction.rollback();
      throw Object.assign(
        new Error("Booking đã có payment Paid khác (BR-66)"),
        { statusCode: 409 }
      );
    }

    // 1. Update Payments
    const req3 = new sql.Request(transaction);
    await req3
      .input("PaymentID_upd", sql.Int, data.paymentId)
      .input("TransactionCode", sql.NVarChar(100), data.transactionCode)
      .input("GatewayResponse", sql.NVarChar(sql.MAX), data.gatewayResponse)
      .query(`
        UPDATE Payments
        SET Status = 'Paid',
            TransactionCode = @TransactionCode,
            GatewayResponse = @GatewayResponse,
            PaidAt = GETDATE(),
            UpdatedAt = GETDATE()
        WHERE PaymentID = @PaymentID_upd
      `);

    // 2. Update Bookings: PendingPayment → Confirmed (giữ nguyên tên status theo booking module)
    const req4 = new sql.Request(transaction);
    await req4
      .input("BookingID_bk", sql.Int, data.bookingId)
      .query(`
        UPDATE Bookings
        SET Status = 'Confirmed',
            UpdatedAt = GETDATE()
        WHERE BookingID = @BookingID_bk
          AND Status = 'PendingPayment'
      `);

    // 3. Update CourtSlots nếu có SlotID
    if (data.slotId !== null && data.slotId !== undefined) {
      const req5 = new sql.Request(transaction);
      await req5
        .input("SlotID", sql.Int, data.slotId)
        .query(`
          UPDATE CourtSlots
          SET Status = 'Booked',
              HoldUntil = NULL,
              UpdatedAt = GETDATE()
          WHERE SlotID = @SlotID
        `);
    }

    // 4. Update CoachSchedules nếu có CoachScheduleID
    if (data.coachScheduleId !== null && data.coachScheduleId !== undefined) {
      const req6 = new sql.Request(transaction);
      await req6
        .input("CoachScheduleID", sql.Int, data.coachScheduleId)
        .query(`
          UPDATE CoachSchedules
          SET Status = 'Booked',
              HoldUntil = NULL,
              UpdatedAt = GETDATE()
          WHERE CoachScheduleID = @CoachScheduleID
        `);
    }

    // 5. BR-76: Ghi AuditLog (dùng try-catch để không block payment nếu AuditLog bảng chưa sẵn sàng)
    try {
      const req7 = new sql.Request(transaction);
      await req7
        .input("TableName", sql.NVarChar(100), "Payments")
        .input("RecordID", sql.Int, data.paymentId)
        .input("Action", sql.NVarChar(50), "UPDATE")
        .input("NewValue", sql.NVarChar(sql.MAX), JSON.stringify({
          status: "Paid",
          transactionCode: data.transactionCode,
          bookingId: data.bookingId,
        }))
        .query(`
          INSERT INTO AuditLogs (TableName, RecordID, Action, NewValue, ChangedAt)
          VALUES (@TableName, @RecordID, @Action, @NewValue, GETDATE())
        `);
    } catch {
      // AuditLog table có thể chưa tồn tại – không block payment
      console.warn("[Payment] AuditLog insert skipped – table may not exist");
    }

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      // Ignore rollback error
    }
    throw err;
  }
}

// ── Mark Payment Failed ───────────────────────────────

/**
 * Update Payments.Status = 'Failed'.
 * Không cancel booking – user có thể retry trong thời gian hold.
 * Idempotent: nếu đã Failed thì bỏ qua.
 */
export async function markPaymentFailed(
  data: MarkPaymentFailedData
): Promise<void> {
  const pool = await getPool();

  await pool
    .request()
    .input("PaymentID", sql.Int, data.paymentId)
    .input("GatewayResponse", sql.NVarChar(sql.MAX), data.gatewayResponse)
    .query(`
      UPDATE Payments
      SET Status = 'Failed',
          GatewayResponse = @GatewayResponse,
          FailedAt = GETDATE(),
          UpdatedAt = GETDATE()
      WHERE PaymentID = @PaymentID
        AND Status NOT IN ('Paid', 'Failed', 'Refunded')
    `);
}

// ── Expire payment + release slot/schedule ────────────

/**
 * expirePayment: dùng khi payment Pending quá ExpiredAt.
 * - Payment → Expired.
 * - Booking → Cancelled.
 * - CourtSlots Holding → Available.
 * - CoachSchedules Holding → Available.
 * Dùng transaction.
 *
 * Note: hàm này được gọi từ bên ngoài (cron job hoặc khi tạo payment mới).
 * Khác với expireOldPendingPayments (chỉ expire payment, không cancel booking).
 */
export async function expirePaymentAndCancelBooking(
  paymentId: number,
  bookingId: number
): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Expire payment
    const req1 = new sql.Request(transaction);
    await req1
      .input("PaymentID", sql.Int, paymentId)
      .query(`
        UPDATE Payments
        SET Status = 'Expired',
            UpdatedAt = GETDATE()
        WHERE PaymentID = @PaymentID
          AND Status = 'Pending'
          AND ExpiredAt < GETDATE()
      `);

    // 2. Cancel booking
    const req2 = new sql.Request(transaction);
    await req2
      .input("BookingID_bk", sql.Int, bookingId)
      .query(`
        UPDATE Bookings
        SET Status = 'Cancelled',
            CancelledAt = GETDATE(),
            CancelReason = N'Hết thời gian thanh toán (BR-67)',
            UpdatedAt = GETDATE()
        WHERE BookingID = @BookingID_bk
          AND Status = 'PendingPayment'
      `);

    // 3. Release CourtSlots → Available
    const req3 = new sql.Request(transaction);
    await req3
      .input("BookingID_slot", sql.Int, bookingId)
      .query(`
        UPDATE CourtSlots
        SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
        WHERE SlotID IN (
          SELECT SlotID FROM BookingDetails
          WHERE BookingID = @BookingID_slot AND SlotID IS NOT NULL
        )
      `);

    // 4. Release CoachSchedules → Available
    const req4 = new sql.Request(transaction);
    await req4
      .input("BookingID_coach", sql.Int, bookingId)
      .query(`
        UPDATE CoachSchedules
        SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
        WHERE CoachScheduleID IN (
          SELECT CoachScheduleID FROM BookingDetails
          WHERE BookingID = @BookingID_coach AND CoachScheduleID IS NOT NULL
        )
      `);

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
    }
    throw err;
  }
}

// ── Get Coach/Combo Email Data ──────────────────────────

/**
 * Lấy toàn bộ data cần thiết để gửi email cho Player và Coach (cho Coach/Combo booking).
 */
export async function getCoachOrComboPaymentSuccessEmailData(
  bookingId: number
): Promise<any | null> {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .query(`
      SELECT
        u.UserID AS playerUserId,
        u.FullName AS playerName,
        u.Email AS playerEmail,
        u.PhoneNumber AS playerPhone,

        co.UserID AS coachUserId,
        cu.FullName AS coachName,
        cu.Email AS coachEmail,
        co.SkillLevel AS coachSkillLevel,
        co.Specialization AS coachSpecialization,

        b.BookingID AS bookingId,
        b.BookingCode AS bookingCode,
        b.BookingType AS bookingType,
        CONVERT(VARCHAR(10), bd.BookingDate, 120) AS bookingDate, -- YYYY-MM-DD
        CONVERT(VARCHAR(5), bd.StartTime, 108) AS startTime,
        CONVERT(VARCHAR(5), bd.EndTime, 108) AS endTime,

        c.CourtName AS courtName,
        c.CourtCode AS courtCode,
        c.Location AS courtLocation,

        -- Coalesce fee để tránh null
        ISNULL(bd.CourtFee, 0) AS courtFee,
        ISNULL(bd.CoachFee, 0) AS coachFee,
        ISNULL(bd.SubTotal, ISNULL(b.TotalAmount, 0)) AS originalAmount,
        ISNULL(b.DiscountAmount, 0) AS discountAmount,
        ISNULL(p.Amount, b.TotalAmount) AS paidAmount,

        p.PaymentMethod AS paymentMethod,
        p.PaymentCode AS paymentCode,
        p.TransactionCode AS transactionCode
      FROM Bookings b
      JOIN Users u ON b.UserID = u.UserID
      LEFT JOIN BookingDetails bd ON bd.BookingID = b.BookingID
      LEFT JOIN Courts c ON bd.CourtID = c.CourtID
      LEFT JOIN Coaches co ON bd.CoachID = co.CoachID
      LEFT JOIN Users cu ON co.UserID = cu.UserID
      LEFT JOIN Payments p ON p.BookingID = b.BookingID AND p.Status = 'Paid'
      WHERE b.BookingID = @BookingID
    `);

  return result.recordset[0] ?? null;
}
