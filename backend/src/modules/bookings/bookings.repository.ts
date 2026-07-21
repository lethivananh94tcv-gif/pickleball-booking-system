import { getPool, sql } from "@/database/connection";
import { BookingType, CreatedBooking, DailyBooking } from "./bookings.type";


// ---- Find / Lookup ----

export async function findUserById(userId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT UserID, FullName, Email, PhoneNumber, Status
      FROM Users
      WHERE UserID = @UserID
    `);

  return result.recordset[0] ?? null;
}

export async function getOrCreateWalkInGuestUser() {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const result = await new sql.Request(transaction)
      .input("Email", sql.NVarChar(100), "walkin.guest@pickleclub.local")
      .input("FullName", sql.NVarChar(100), "Khach vang lai")
      .input("PhoneNumber", sql.NVarChar(20), "WALKIN_GUEST")
      .input("PasswordHash", sql.NVarChar(255), "WALKIN_GUEST_DISABLED")
      .query(`
        DECLARE @UserID INT;
        DECLARE @GuestRoleID INT;
        DECLARE @InsertedUsers TABLE (UserID INT);

        SELECT @UserID = UserID
        FROM Users WITH (UPDLOCK, HOLDLOCK)
        WHERE Email = @Email OR PhoneNumber = @PhoneNumber;

        IF @UserID IS NULL
        BEGIN
          INSERT INTO Users (FullName, Email, PhoneNumber, PasswordHash, Status)
          OUTPUT INSERTED.UserID INTO @InsertedUsers
          VALUES (@FullName, @Email, @PhoneNumber, @PasswordHash, 'Active');

          SELECT @UserID = UserID FROM @InsertedUsers;
        END;

        IF @UserID IS NULL
        BEGIN
          THROW 50010, 'Cannot resolve walk-in guest user id', 1;
        END;

        SELECT @GuestRoleID = RoleID
        FROM Roles
        WHERE RoleName = 'Guest';

        IF @GuestRoleID IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM UserRoles WHERE UserID = @UserID AND RoleID = @GuestRoleID
          )
        BEGIN
          INSERT INTO UserRoles (UserID, RoleID)
          VALUES (@UserID, @GuestRoleID);
        END;

        SELECT UserID, FullName, Email, PhoneNumber, Status
        FROM Users
        WHERE UserID = @UserID;
      `);

    await transaction.commit();
    return result.recordset[0] ?? null;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function findCourtByIdForBooking(courtId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("CourtID", sql.Int, courtId)
    .query(`
      SELECT
        CourtID,
        CourtCode,
        CourtName,
        PricePerHour,
        Status,
        OpenTime,
        CloseTime
      FROM Courts
      WHERE CourtID = @CourtID
    `);

  return result.recordset[0] ?? null;
}

export async function findCoachByIdForBooking(coachId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("CoachID", sql.Int, coachId)
    .query(`
      SELECT
        CoachID,
        UserID,
        HourlyRate,
        Status
      FROM Coaches
      WHERE CoachID = @CoachID
    `);

  return result.recordset[0] ?? null;
}

/**
 * Tim slot san kha dung, dong thoi kiem tra buffer 15 phut (BR-46 phan Court Slot).
 * Slot phai Status = 'Available', khong co slot nao Holding/Booked trong khoang buffer.
 */
export async function findAvailableCourtSlot(
  courtId: number,
  bookingDate: string,
  startTime: string,
  endTime: string
) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("CourtID", sql.Int, courtId)
    .input("SlotDate", sql.Date, bookingDate)
    .input("StartTime", sql.VarChar(5), startTime)
    .input("EndTime", sql.VarChar(5), endTime)
    .query(`
      SELECT TOP 1
        SlotID,
        CourtID,
        SlotDate,
        CONVERT(VARCHAR(5), StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), EndTime, 108) AS EndTime,
        Price,
        Status
      FROM CourtSlots
      WHERE CourtID = @CourtID
        AND SlotDate = @SlotDate
        AND StartTime = CAST(@StartTime AS TIME)
        AND EndTime = CAST(@EndTime AS TIME)
        AND Status = 'Available'
        AND NOT EXISTS (
          SELECT 1 FROM TournamentCourtBlocks b
          WHERE b.CourtID = CourtSlots.CourtID
            AND b.Status = 'Active'
            AND DATEADD(hour, 7, b.StartDateTime) < CAST(CAST(CourtSlots.SlotDate AS VARCHAR(10)) + ' ' + CAST(CourtSlots.EndTime AS VARCHAR(8)) AS DATETIME)
            AND DATEADD(hour, 7, b.EndDateTime) > CAST(CAST(CourtSlots.SlotDate AS VARCHAR(10)) + ' ' + CAST(CourtSlots.StartTime AS VARCHAR(8)) AS DATETIME)
        )
    `);

  return result.recordset[0] ?? null;
}

/**
 * Tim lich HLV kha dung, co kiem tra buffer time 15 phut (BR-46).
 * Lich phai Status = 'Available'.
 * Khong co lich nao cua HLV dang Holding/Booked trong khoang (StartTime-15min, EndTime+15min).
 */
export async function findAvailableCoachSchedule(
  coachId: number,
  bookingDate: string,
  startTime: string,
  endTime: string
) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("CoachID", sql.Int, coachId)
    .input("WorkingDate", sql.Date, bookingDate)
    .input("StartTime", sql.VarChar(5), startTime)
    .input("EndTime", sql.VarChar(5), endTime)
    .query(`
      -- BR-46: Kiem tra buffer 15 phut truoc/sau
      IF EXISTS (
        SELECT 1
        FROM CoachSchedules
        WHERE CoachID = @CoachID
          AND WorkingDate = @WorkingDate
          AND Status IN ('Holding', 'Booked')
          AND (
            -- Slot khac overlap voi khoang (start-15, end+15)
            StartTime < DATEADD(MINUTE, 15, CAST(@EndTime AS TIME))
            AND EndTime > DATEADD(MINUTE, -15, CAST(@StartTime AS TIME))
          )
      )
      BEGIN
        SELECT NULL AS CoachScheduleID, NULL AS CoachID, NULL AS WorkingDate,
               NULL AS StartTime, NULL AS EndTime, NULL AS Status
        WHERE 1 = 0; -- tra ve empty
      END
      ELSE
      BEGIN
        SELECT TOP 1
          CoachScheduleID,
          CoachID,
          WorkingDate,
          CONVERT(VARCHAR(5), StartTime, 108) AS StartTime,
          CONVERT(VARCHAR(5), EndTime, 108) AS EndTime,
          Status
        FROM CoachSchedules
        WHERE CoachID = @CoachID
          AND WorkingDate = @WorkingDate
          AND StartTime = CAST(@StartTime AS TIME)
          AND EndTime = CAST(@EndTime AS TIME)
          AND Status = 'Available';
      END
    `);

  return result.recordset[0] ?? null;
}

/**
 * Dem so booking dang o trang thai Holding cua 1 user.
 * Dung de kiem tra BR-40: toi da 3 Holding cung luc.
 */
export async function countHoldingBookingsByUserId(userId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT COUNT(*) AS HoldingCount
      FROM Bookings
      WHERE UserID = @UserID
        AND Status = 'PendingPayment'
    `);

  return (result.recordset[0]?.HoldingCount ?? 0) as number;
}

/**
 * Tim booking theo ID kem thong tin payment.
 * Dung cho cancel (can TotalAmount, StartTime, BookingDate, PaymentInfo).
 */
export async function findBookingWithPaymentById(bookingId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .query(`
      SELECT
        b.BookingID,
        b.BookingCode,
        b.UserID,
        b.BookingType,
        b.BookingDate,
        b.CourtFee,
        b.CoachFee,
        b.DiscountAmount,
        b.TotalAmount,
        b.Status,
        b.CheckInTime,
        b.CancelledAt,
        b.CancelReason,
        b.CreatedAt,

        bd.BookingDetailID,
        bd.SlotID,
        bd.CourtID,
        bd.CoachID,
        bd.CoachScheduleID,
        CONVERT(VARCHAR(5), bd.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), bd.EndTime, 108) AS EndTime,

        p.PaymentID,
        p.PaymentMethod,
        p.Amount AS PaidAmount,
        p.TransactionCode,
        p.Status AS PaymentStatus,
        p.PaidAt
      FROM Bookings b
      LEFT JOIN BookingDetails bd ON bd.BookingID = b.BookingID
      LEFT JOIN Payments p ON p.BookingID = b.BookingID AND p.Status = 'Paid'
      WHERE b.BookingID = @BookingID
    `);

  return result.recordset[0] ?? null;
}

// ---- Create Bookings ----

function generateBookingCode() {
  return `BK-${Date.now()}`;
}

export async function repoCreateCourtBooking(data: {
  userId: number;
  courtId: number;
  slotId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  courtFee: number;
  originalAmount?: number;
  discountAmount?: number;
  promotionId?: number | null;
  paymentMethod?: "Cash" | "BankTransfer";
  walkInNote?: string;
  bookedByStaffId?: number;
  guestName?: string;
  guestPhone?: string;
}): Promise<CreatedBooking> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const request = new sql.Request(transaction);
    const bookingCode = generateBookingCode();

    const result = await request
      .input("BookingCode", sql.NVarChar(50), bookingCode)
      .input("UserID", sql.Int, data.userId)
      .input("BookingType", sql.NVarChar(30), "Court")
      .input("BookingDate", sql.Date, data.bookingDate)
      .input("CourtFee", sql.Decimal(18, 2), data.courtFee)
      .input("CoachFee", sql.Decimal(18, 2), 0)
      .input("DiscountAmount", sql.Decimal(18, 2), data.discountAmount ?? 0)
      .input("TotalAmount", sql.Decimal(18, 2), data.courtFee)
      .input("OriginalAmount", sql.Decimal(18, 2), data.originalAmount ?? data.courtFee)
      .input("PromotionID", sql.Int, data.promotionId ?? null)
      .input("SlotID", sql.Int, data.slotId)
      .input("CourtID", sql.Int, data.courtId)
      .input("StartTime", sql.VarChar(5), data.startTime)
      .input("EndTime", sql.VarChar(5), data.endTime)
      .input("PaymentMethod", sql.NVarChar(50), data.paymentMethod ?? null)
      .input("WalkInNote", sql.NVarChar(255), data.walkInNote ?? null)
      .input("BookedByStaffID", sql.Int, data.bookedByStaffId ?? null)
      .input("GuestName", sql.NVarChar(100), data.guestName ?? null)
      .input("GuestPhone", sql.NVarChar(20), data.guestPhone ?? null)
      .input("TransactionCode", sql.NVarChar(100), data.paymentMethod ? `WALKIN-${Date.now()}` : null)
      .query(`
        -- BR-27/28: Lock slot truoc khi insert
        IF NOT EXISTS (
          SELECT 1
          FROM CourtSlots WITH (UPDLOCK, HOLDLOCK)
          WHERE SlotID = @SlotID
            AND Status = 'Available'
        )
        BEGIN
          THROW 50001, 'Court slot is not available', 1;
        END;

        DECLARE @BookingStatus NVARCHAR(30) =
          CASE WHEN @PaymentMethod IS NULL THEN 'PendingPayment' ELSE 'Confirmed' END;

        INSERT INTO Bookings (
          BookingCode, UserID, BookingType, BookingDate,
          CourtFee, CoachFee, DiscountAmount, TotalAmount, OriginalAmount, PromotionID, Status, CancelReason,
          GuestName, GuestPhone, BookedByStaffID, PaymentMethod, PaymentStatus
        )
        OUTPUT INSERTED.*
        VALUES (
          @BookingCode, @UserID, @BookingType, @BookingDate,
          @CourtFee, @CoachFee, @DiscountAmount, @TotalAmount, @OriginalAmount, @PromotionID, @BookingStatus, @WalkInNote,
          @GuestName, @GuestPhone, @BookedByStaffID, @PaymentMethod,
          CASE WHEN @PaymentMethod IS NULL THEN 'Pending' ELSE 'Paid' END
        );

        DECLARE @NewBookingID INT = SCOPE_IDENTITY();

        INSERT INTO BookingDetails (
          BookingID, SlotID, CourtID, CoachID, CoachScheduleID,
          BookingDate, StartTime, EndTime, CourtFee, CoachFee, SubTotal
        )
        VALUES (
          @NewBookingID, @SlotID, @CourtID, NULL, NULL,
          @BookingDate, CAST(@StartTime AS TIME), CAST(@EndTime AS TIME),
          @CourtFee, 0, @CourtFee
        );

        IF @PaymentMethod IS NULL
        BEGIN
          DECLARE @HoldUntil DATETIME;
          DECLARE @StartDateTime DATETIME = CAST(CAST(@BookingDate AS VARCHAR(10)) + ' ' + CAST(@StartTime AS VARCHAR(5)) AS DATETIME);
          IF DATEADD(MINUTE, 10, GETDATE()) < @StartDateTime
              SET @HoldUntil = DATEADD(MINUTE, 10, GETDATE());
          ELSE
              SET @HoldUntil = @StartDateTime;

          -- BR-25: Hold slot 10 phut hoac den gio bat dau
          UPDATE CourtSlots
          SET Status = 'Holding',
              HoldUntil = @HoldUntil,
              UpdatedAt = GETDATE()
          WHERE SlotID = @SlotID;
        END
        ELSE
        BEGIN
          INSERT INTO Payments (
            BookingID, PaymentMethod, Amount, PaymentCode, TransactionCode, Status, PaidAt, CreatedAt,
            ConfirmedByStaffID, Note
          )
          VALUES (
            @NewBookingID, @PaymentMethod, @TotalAmount, 'PAY-' + CAST(@NewBookingID AS VARCHAR) + '-' + REPLACE(REPLACE(REPLACE(CONVERT(VARCHAR(19), GETDATE(), 120), '-', ''), ':', ''), ' ', ''), @TransactionCode, 'Paid', GETDATE(), GETDATE(),
            @BookedByStaffID, @WalkInNote
          );

          UPDATE CourtSlots
          SET Status = 'Booked',
              HoldUntil = NULL,
              UpdatedAt = GETDATE()
          WHERE SlotID = @SlotID;
        END;

        SELECT
          b.BookingID, b.BookingCode, b.UserID, b.BookingType, b.BookingDate,
          b.CourtFee, b.CoachFee, b.DiscountAmount, b.TotalAmount, b.Status, b.CreatedAt,
          bd.BookingDetailID, bd.SlotID, bd.CourtID, bd.CoachID, bd.CoachScheduleID,
          CONVERT(VARCHAR(5), bd.StartTime, 108) AS StartTime,
          CONVERT(VARCHAR(5), bd.EndTime, 108) AS EndTime
        FROM Bookings b
        JOIN BookingDetails bd ON bd.BookingID = b.BookingID
        WHERE b.BookingID = @NewBookingID;
      `);

    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function repoCreateCoachBooking(data: {
  userId: number;
  coachId: number;
  coachScheduleId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  coachFee: number;
}): Promise<CreatedBooking> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const request = new sql.Request(transaction);
    const bookingCode = generateBookingCode();

    const result = await request
      .input("BookingCode", sql.NVarChar(50), bookingCode)
      .input("UserID", sql.Int, data.userId)
      .input("BookingType", sql.NVarChar(30), "Coach")
      .input("BookingDate", sql.Date, data.bookingDate)
      .input("CourtFee", sql.Decimal(18, 2), 0)
      .input("CoachFee", sql.Decimal(18, 2), data.coachFee)
      .input("DiscountAmount", sql.Decimal(18, 2), 0)
      .input("TotalAmount", sql.Decimal(18, 2), data.coachFee)
      .input("CoachID", sql.Int, data.coachId)
      .input("CoachScheduleID", sql.Int, data.coachScheduleId)
      .input("StartTime", sql.VarChar(5), data.startTime)
      .input("EndTime", sql.VarChar(5), data.endTime)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM CoachSchedules WITH (UPDLOCK, HOLDLOCK)
          WHERE CoachScheduleID = @CoachScheduleID
            AND Status = 'Available'
        )
        BEGIN
          THROW 50002, 'Coach schedule is not available', 1;
        END;

        INSERT INTO Bookings (
          BookingCode, UserID, BookingType, BookingDate,
          CourtFee, CoachFee, DiscountAmount, TotalAmount, Status
        )
        VALUES (
          @BookingCode, @UserID, @BookingType, @BookingDate,
          @CourtFee, @CoachFee, @DiscountAmount, @TotalAmount, 'PendingPayment'
        );

        DECLARE @NewBookingID INT = SCOPE_IDENTITY();

        INSERT INTO BookingDetails (
          BookingID, SlotID, CourtID, CoachID, CoachScheduleID,
          BookingDate, StartTime, EndTime, CourtFee, CoachFee, SubTotal
        )
        VALUES (
          @NewBookingID, NULL, NULL, @CoachID, @CoachScheduleID,
          @BookingDate, CAST(@StartTime AS TIME), CAST(@EndTime AS TIME),
          0, @CoachFee, @CoachFee
        );

        DECLARE @HoldUntil DATETIME;
        DECLARE @StartDateTime DATETIME = CAST(CAST(@BookingDate AS VARCHAR(10)) + ' ' + CAST(@StartTime AS VARCHAR(5)) AS DATETIME);
        IF DATEADD(MINUTE, 10, GETDATE()) < @StartDateTime
            SET @HoldUntil = DATEADD(MINUTE, 10, GETDATE());
        ELSE
            SET @HoldUntil = @StartDateTime;

        -- BR-25: Hold schedule 10 phut hoac den gio bat dau
        UPDATE CoachSchedules
        SET Status = 'Holding',
            HoldUntil = @HoldUntil,
            UpdatedAt = GETDATE()
        WHERE CoachScheduleID = @CoachScheduleID;

        SELECT
          b.BookingID, b.BookingCode, b.UserID, b.BookingType, b.BookingDate,
          b.CourtFee, b.CoachFee, b.DiscountAmount, b.TotalAmount, b.Status, b.CreatedAt,
          bd.BookingDetailID, bd.SlotID, bd.CourtID, bd.CoachID, bd.CoachScheduleID,
          CONVERT(VARCHAR(5), bd.StartTime, 108) AS StartTime,
          CONVERT(VARCHAR(5), bd.EndTime, 108) AS EndTime
        FROM Bookings b
        JOIN BookingDetails bd ON bd.BookingID = b.BookingID
        WHERE b.BookingID = @NewBookingID;
      `);

    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function repoCreateComboBooking(input: {
  userId: number;
  courtId: number;
  coachId: number;
  slotId: number;
  coachScheduleId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  courtFee: number;
  coachFee: number;
}): Promise<CreatedBooking> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  const totalAmount = input.courtFee + input.coachFee;
  const bookingCode = `CB-${Date.now()}`;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const result = await new sql.Request(transaction)
      .input("BookingCode", sql.VarChar(50), bookingCode)
      .input("UserID", sql.Int, input.userId)
      .input("BookingType", sql.VarChar(20), "Combo")
      .input("BookingDate", sql.Date, input.bookingDate)
      .input("CourtFee", sql.Decimal(18, 2), input.courtFee)
      .input("CoachFee", sql.Decimal(18, 2), input.coachFee)
      .input("DiscountAmount", sql.Decimal(18, 2), 0)
      .input("TotalAmount", sql.Decimal(18, 2), totalAmount)
      .input("SlotID", sql.Int, input.slotId)
      .input("CourtID", sql.Int, input.courtId)
      .input("CoachID", sql.Int, input.coachId)
      .input("CoachScheduleID", sql.Int, input.coachScheduleId)
      .input("StartTime", sql.VarChar(20), input.startTime)
      .input("EndTime", sql.VarChar(20), input.endTime)
      .input("SubTotal", sql.Decimal(18, 2), totalAmount)
      .query(`
        -- Lock ca slot va schedule (BR-28 atomic)
        IF NOT EXISTS (
          SELECT 1 FROM CourtSlots WITH (UPDLOCK, HOLDLOCK)
          WHERE SlotID = @SlotID AND Status = 'Available'
        )
        BEGIN
          THROW 50001, 'Court slot is not available', 1;
        END;

        IF NOT EXISTS (
          SELECT 1 FROM CoachSchedules WITH (UPDLOCK, HOLDLOCK)
          WHERE CoachScheduleID = @CoachScheduleID AND Status = 'Available'
        )
        BEGIN
          THROW 50002, 'Coach schedule is not available', 1;
        END;

        INSERT INTO Bookings (
          BookingCode, UserID, BookingType, BookingDate,
          CourtFee, CoachFee, DiscountAmount, TotalAmount, Status, CreatedAt
        )
        OUTPUT INSERTED.BookingID
        VALUES (
          @BookingCode, @UserID, @BookingType, @BookingDate,
          @CourtFee, @CoachFee, @DiscountAmount, @TotalAmount, 'PendingPayment', GETDATE()
        );

        DECLARE @NewBookingID INT = SCOPE_IDENTITY();

        INSERT INTO BookingDetails (
          BookingID, SlotID, CourtID, CoachID, CoachScheduleID,
          BookingDate, StartTime, EndTime, CourtFee, CoachFee, SubTotal
        )
        VALUES (
          @NewBookingID, @SlotID, @CourtID, @CoachID, @CoachScheduleID,
          @BookingDate, @StartTime, @EndTime, @CourtFee, @CoachFee, @SubTotal
        );

        DECLARE @HoldUntil DATETIME;
        DECLARE @StartDateTime DATETIME = CAST(CAST(@BookingDate AS VARCHAR(10)) + ' ' + CAST(@StartTime AS VARCHAR(5)) AS DATETIME);
        IF DATEADD(MINUTE, 10, GETDATE()) < @StartDateTime
            SET @HoldUntil = DATEADD(MINUTE, 10, GETDATE());
        ELSE
            SET @HoldUntil = @StartDateTime;

        -- BR-25: Hold ca slot va schedule 10 phut hoac den gio bat dau
        UPDATE CourtSlots
        SET Status = 'Holding', HoldUntil = @HoldUntil, UpdatedAt = GETDATE()
        WHERE SlotID = @SlotID;

        UPDATE CoachSchedules
        SET Status = 'Holding', HoldUntil = @HoldUntil, UpdatedAt = GETDATE()
        WHERE CoachScheduleID = @CoachScheduleID;

        SELECT
          b.BookingID, b.BookingCode, b.UserID, b.BookingType, b.BookingDate,
          b.CourtFee, b.CoachFee, b.DiscountAmount, b.TotalAmount, b.Status, b.CreatedAt,
          bd.BookingDetailID, bd.SlotID, bd.CourtID, bd.CoachID, bd.CoachScheduleID,
          CONVERT(VARCHAR(5), bd.StartTime, 108) AS StartTime,
          CONVERT(VARCHAR(5), bd.EndTime, 108) AS EndTime
        FROM Bookings b
        JOIN BookingDetails bd ON bd.BookingID = b.BookingID
        WHERE b.BookingID = @NewBookingID;
      `);

    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// ---- Cancel Booking ----

/**
 * Huy booking va release slot/schedule ve Available.
 * Thuc hien trong 1 transaction (BR-NEW-03).
 */
export async function repoCancelBookingById(
  bookingId: number,
  reason: string
): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("BookingID", sql.Int, bookingId)
      .input("Reason", sql.NVarChar(255), reason)
      .query(`
        -- Cap nhat trang thai booking
        UPDATE Bookings
        SET Status = 'Cancelled',
            CancelledAt = GETDATE(),
            CancelReason = @Reason,
            UpdatedAt = GETDATE()
        WHERE BookingID = @BookingID;

        -- Release court slot ve Available (neu co)
        UPDATE CourtSlots
        SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
        WHERE SlotID IN (
          SELECT SlotID FROM BookingDetails WHERE BookingID = @BookingID AND SlotID IS NOT NULL
        );

        -- Release coach schedule ve Available (neu co)
        UPDATE CoachSchedules
        SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
        WHERE CoachScheduleID IN (
          SELECT CoachScheduleID FROM BookingDetails WHERE BookingID = @BookingID AND CoachScheduleID IS NOT NULL
        );

        -- Release voucher dang reserved
        UPDATE PromotionUsages
        SET Status = 'Released', UpdatedAt = GETDATE()
        WHERE BookingID = @BookingID AND Status = 'Reserved';
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// ---- Check-in ----

/**
 * Check-in booking: Confirmed → CheckedIn.
 * Goi sau khi da validate thoi gian o service.
 */
export async function repoCheckInBookingById(bookingId: number): Promise<void> {
  const pool = await getPool();

  await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .query(`
      UPDATE Bookings
      SET Status = 'CheckedIn',
          CheckInTime = GETDATE(),
          UpdatedAt = GETDATE()
      WHERE BookingID = @BookingID
        AND Status IN ('Confirmed', 'Paid')
    `);
}

// ---- Mock Pay ----

/**
 * Mock payment: mark booking Paid → Confirmed, tao Payment record.
 * Dev sau thay bang VNPay/Momo webhook.
 */
export async function repoMockPayBooking(
  bookingId: number,
  paymentMethod: "VNPay" | "Momo" = "VNPay"
): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("BookingID", sql.Int, bookingId)
      .input("PaymentMethod", sql.NVarChar(50), paymentMethod)
      .input("TransactionCode", sql.NVarChar(100), `MOCK-${Date.now()}`)
      .query(`
        DECLARE @TotalAmount DECIMAL(18,2);
        SELECT @TotalAmount = TotalAmount FROM Bookings WHERE BookingID = @BookingID;

        INSERT INTO Payments (BookingID, PaymentMethod, Amount, PaymentCode, TransactionCode, Status, PaidAt, CreatedAt)
        VALUES (@BookingID, @PaymentMethod, @TotalAmount, 'PAY-' + CAST(@BookingID AS VARCHAR) + '-' + REPLACE(REPLACE(REPLACE(CONVERT(VARCHAR(19), GETDATE(), 120), '-', ''), ':', ''), ' ', ''), @TransactionCode, 'Paid', GETDATE(), GETDATE());

        UPDATE Bookings
        SET Status = 'Confirmed', UpdatedAt = GETDATE()
        WHERE BookingID = @BookingID AND Status = 'PendingPayment';

        -- Mark slot/schedule la Booked (khong con la Holding)
        UPDATE CourtSlots
        SET Status = 'Booked', HoldUntil = NULL, UpdatedAt = GETDATE()
        WHERE SlotID IN (
          SELECT SlotID FROM BookingDetails WHERE BookingID = @BookingID AND SlotID IS NOT NULL
        );

        UPDATE CoachSchedules
        SET Status = 'Booked', HoldUntil = NULL, UpdatedAt = GETDATE()
        WHERE CoachScheduleID IN (
          SELECT CoachScheduleID FROM BookingDetails WHERE BookingID = @BookingID AND CoachScheduleID IS NOT NULL
        );
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// ---- Release Expired (BR-26 + BR-31 + BR-32) ----

/**
 * BR-26: Cancel cac booking PendingPayment qua HoldUntil (10 phut).
 * Release slot va schedule ve Available.
 */
export async function repoReleaseExpiredHoldings(): Promise<{ releasedCount: number, expiredBookings: { BookingID: number, BookingCode: string, Email: string }[] }> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const result = await new sql.Request(transaction).query(`
      -- Lay danh sach booking het han
      DECLARE @ExpiredIDs TABLE (BookingID INT);

      INSERT INTO @ExpiredIDs
      SELECT b.BookingID
      FROM Bookings b
      WHERE b.Status = 'PendingPayment'
        AND EXISTS (
          SELECT 1 FROM CourtSlots cs
          JOIN BookingDetails bd ON bd.SlotID = cs.SlotID
          WHERE bd.BookingID = b.BookingID
            AND cs.HoldUntil < GETDATE()
          UNION ALL
          SELECT 1 FROM CoachSchedules sch
          JOIN BookingDetails bd ON bd.CoachScheduleID = sch.CoachScheduleID
          WHERE bd.BookingID = b.BookingID
            AND sch.HoldUntil < GETDATE()
        );

      -- Cancel cac booking het han
      UPDATE Bookings
      SET Status = 'Cancelled',
          CancelledAt = GETDATE(),
          CancelReason = N'Hết hạn thanh toán',
          UpdatedAt = GETDATE()
      WHERE BookingID IN (SELECT BookingID FROM @ExpiredIDs);

      -- Release court slots
      UPDATE CourtSlots
      SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
      WHERE SlotID IN (
        SELECT SlotID FROM BookingDetails
        WHERE BookingID IN (SELECT BookingID FROM @ExpiredIDs)
          AND SlotID IS NOT NULL
      );

      -- Release coach schedules
      UPDATE CoachSchedules
      SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
      WHERE CoachScheduleID IN (
        SELECT CoachScheduleID FROM BookingDetails
        WHERE BookingID IN (SELECT BookingID FROM @ExpiredIDs)
          AND CoachScheduleID IS NOT NULL
      );

      -- Release voucher usages dang reserved
      UPDATE PromotionUsages
      SET Status = 'Released', UpdatedAt = GETDATE()
      WHERE BookingID IN (SELECT BookingID FROM @ExpiredIDs)
        AND Status = 'Reserved';


      SELECT 
        b.BookingID, 
        b.BookingCode, 
        u.Email 
      FROM @ExpiredIDs e 
      JOIN Bookings b ON e.BookingID = b.BookingID
      JOIN Users u ON b.UserID = u.UserID;
    `);

    await transaction.commit();
    return {
      releasedCount: result.recordset.length,
      expiredBookings: result.recordset
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * BR-31 (Modified): Tu dong check-in cho booking Confirmed ma khach quen check-in 
 * sau khi gio choi da ket thuc.
 */
export async function repoAutoCheckInExpired(): Promise<number> {
  const pool = await getPool();

  const result = await pool.request().query(`
    DECLARE @AutoIDs TABLE (BookingID INT);

    INSERT INTO @AutoIDs
    SELECT b.BookingID
    FROM Bookings b
    JOIN BookingDetails bd ON bd.BookingID = b.BookingID
    WHERE b.Status IN ('Confirmed', 'Paid')
      AND b.CheckInTime IS NULL
      -- Da het gio choi (EndTime da qua)
      AND CAST(CONCAT(CAST(b.BookingDate AS VARCHAR), ' ', CONVERT(VARCHAR(5), bd.EndTime, 108)) AS DATETIME)
            < GETDATE();

    UPDATE Bookings
    SET Status = 'CheckedIn',
        CheckInTime = GETDATE(),
        UpdatedAt = GETDATE()
    WHERE BookingID IN (SELECT BookingID FROM @AutoIDs);

    SELECT COUNT(*) AS AutoCount FROM @AutoIDs;
  `);

  return result.recordset[0]?.AutoCount ?? 0;
}

/**
 * BR-32: Chuyen booking tu CheckedIn sang Completed.
 * Dieu kien: da check-in (CheckInTime IS NOT NULL) VA EndTime + 30 phut da qua.
 */
export async function repoMarkCompletedExpiredCheckins(): Promise<number> {
  const pool = await getPool();

  const result = await pool.request().query(`
    DECLARE @CompleteIDs TABLE (BookingID INT);

    INSERT INTO @CompleteIDs
    SELECT b.BookingID
    FROM Bookings b
    JOIN BookingDetails bd ON bd.BookingID = b.BookingID
    WHERE b.Status = 'CheckedIn'
      AND b.CheckInTime IS NOT NULL
      -- EndTime + 30 phut da qua (BR-32)
      AND CAST(CONCAT(CAST(b.BookingDate AS VARCHAR), ' ', CONVERT(VARCHAR(5), bd.EndTime, 108)) AS DATETIME)
            < DATEADD(MINUTE, -30, GETDATE());

    UPDATE Bookings
    SET Status = 'Completed',
        UpdatedAt = GETDATE()
    WHERE BookingID IN (SELECT BookingID FROM @CompleteIDs);

    -- Mark slot/schedule ve Available sau khi hoan thanh
    UPDATE CourtSlots
    SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
    WHERE SlotID IN (
      SELECT SlotID FROM BookingDetails
      WHERE BookingID IN (SELECT BookingID FROM @CompleteIDs)
        AND SlotID IS NOT NULL
    );

    UPDATE CoachSchedules
    SET Status = 'Available', HoldUntil = NULL, UpdatedAt = GETDATE()
    WHERE CoachScheduleID IN (
      SELECT CoachScheduleID FROM BookingDetails
      WHERE BookingID IN (SELECT BookingID FROM @CompleteIDs)
        AND CoachScheduleID IS NOT NULL
    );

    SELECT COUNT(*) AS CompletedCount FROM @CompleteIDs;
  `);

  return result.recordset[0]?.CompletedCount ?? 0;
}

// ---- View Bookings ----

export async function findBookingsByUserId(userId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT
        b.BookingID,
        b.BookingCode,
        b.UserID,
        b.BookingType,
        b.BookingDate,
        b.CourtFee,
        b.CoachFee,
        b.DiscountAmount,
        b.TotalAmount,
        b.Status,
        DATEADD(HOUR, -7, b.CheckInTime) AS CheckInTime,
        b.CancelledAt,
        b.CancelReason,
        b.CreatedAt,

        mainDetail.BookingDetailID,
        mainDetail.SlotID,
        mainDetail.CourtID,
        mainDetail.CourtName,
        mainDetail.CourtCode,
        mainDetail.CourtImage,
        mainDetail.Location,

        mainDetail.CoachID,
        mainDetail.CoachName,
        mainDetail.CoachAvatar,

        mainDetail.CoachScheduleID,
        CONVERT(VARCHAR(5), timeRange.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), timeRange.EndTime, 108) AS EndTime,

        p.PaymentID,
        p.PaymentMethod,
        p.TransactionCode,
        p.Status AS PaymentStatus,
        p.PaidAt,
        
        r.Status AS RefundStatus,
        
        CAST(CASE WHEN rev.ReviewID IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS IsReviewed
      FROM Bookings b
      OUTER APPLY (
        SELECT
            MIN(bd.StartTime) AS StartTime,
            MAX(bd.EndTime) AS EndTime
        FROM BookingDetails bd
        WHERE bd.BookingID = b.BookingID
      ) timeRange
      OUTER APPLY (
        SELECT TOP 1
            bd.BookingDetailID,
            bd.SlotID,
            bd.CourtID,
            c.CourtName,
            c.CourtCode,
            c.CourtImage,
            c.Location,
            bd.CoachID,
            cu.FullName AS CoachName,
            cu.AvatarURL AS CoachAvatar,
            bd.CoachScheduleID
        FROM BookingDetails bd
        LEFT JOIN Courts c ON bd.CourtID = c.CourtID
        LEFT JOIN Coaches co ON bd.CoachID = co.CoachID
        LEFT JOIN Users cu ON co.UserID = cu.UserID
        WHERE bd.BookingID = b.BookingID
        ORDER BY bd.StartTime ASC
      ) mainDetail
      OUTER APPLY (
        SELECT TOP 1 PaymentID, PaymentMethod, TransactionCode, Status, PaidAt
        FROM Payments
        WHERE BookingID = b.BookingID
        ORDER BY 
          CASE WHEN Status = 'Paid' THEN 1 ELSE 2 END ASC, 
          CreatedAt DESC
      ) p
      OUTER APPLY (
        SELECT TOP 1 Status
        FROM Refunds
        WHERE BookingID = b.BookingID
        ORDER BY RequestedAt DESC
      ) r
      OUTER APPLY (
        SELECT TOP 1 ReviewID
        FROM Reviews
        WHERE BookingID = b.BookingID
      ) rev
      WHERE b.UserID = @UserID
      ORDER BY b.CreatedAt DESC
    `);

  return result.recordset;
}

export async function findBookingsByCoachUserId(userId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT
        b.BookingID,
        b.BookingCode,
        b.UserID AS PlayerID,
        pu.FullName AS PlayerName,
        pu.AvatarURL AS PlayerAvatar,
        b.BookingType,
        b.BookingDate,
        b.CoachFee,
        b.TotalAmount,
        b.Status,
        b.CheckInTime,
        b.CancelledAt,
        b.CancelReason,
        b.CreatedAt,

        mainDetail.BookingDetailID,
        mainDetail.CourtID,
        mainDetail.CourtName,
        mainDetail.Location,

        mainDetail.CoachScheduleID,
        CONVERT(VARCHAR(5), timeRange.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), timeRange.EndTime, 108) AS EndTime,

        p.PaymentMethod,
        p.Status AS PaymentStatus,
        p.PaidAt
      FROM Bookings b
      JOIN Users pu ON pu.UserID = b.UserID
      OUTER APPLY (
        SELECT
            MIN(bd.StartTime) AS StartTime,
            MAX(bd.EndTime) AS EndTime
        FROM BookingDetails bd
        WHERE bd.BookingID = b.BookingID
      ) timeRange
      OUTER APPLY (
        SELECT TOP 1
            bd.BookingDetailID,
            bd.CourtID,
            c.CourtName,
            c.Location,
            bd.CoachScheduleID
        FROM BookingDetails bd
        LEFT JOIN Courts c ON c.CourtID = bd.CourtID
        WHERE bd.BookingID = b.BookingID
        ORDER BY bd.StartTime ASC
      ) mainDetail
      OUTER APPLY (
        SELECT TOP 1 PaymentMethod, Status, PaidAt
        FROM Payments
        WHERE BookingID = b.BookingID
        ORDER BY CASE WHEN Status = 'Paid' THEN 1 ELSE 2 END ASC, CreatedAt DESC
      ) p
      WHERE EXISTS (
        SELECT 1 FROM BookingDetails bd2
        JOIN Coaches co2 ON bd2.CoachID = co2.CoachID
        WHERE bd2.BookingID = b.BookingID AND co2.UserID = @UserID
      )
      ORDER BY b.BookingDate DESC, timeRange.StartTime DESC
    `);

  return result.recordset;
}

export async function findBookingById(bookingId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("BookingID", sql.Int, bookingId)
    .query(`
      SELECT
        b.BookingID,
        b.BookingCode,
        b.UserID,
        b.BookingType,
        b.BookingDate,
        b.CourtFee,
        b.CoachFee,
        b.DiscountAmount,
        b.TotalAmount,
        b.Status,
        DATEADD(HOUR, -7, b.CheckInTime) AS CheckInTime,
        b.CancelledAt,
        b.CancelReason,
        b.CreatedAt,

        mainDetail.BookingDetailID,
        mainDetail.SlotID,
        mainDetail.CourtID,
        mainDetail.CourtName,
        mainDetail.CourtCode,
        mainDetail.CourtImage,
        mainDetail.Location,

        mainDetail.CoachID,
        mainDetail.CoachName,
        mainDetail.CoachAvatar,

        mainDetail.CoachScheduleID,
        CONVERT(VARCHAR(5), timeRange.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), timeRange.EndTime, 108) AS EndTime,

        p.PaymentID,
        p.PaymentMethod,
        p.TransactionCode,
        p.Status AS PaymentStatus,
        p.PaidAt
      FROM Bookings b
      OUTER APPLY (
        SELECT
            MIN(bd.StartTime) AS StartTime,
            MAX(bd.EndTime) AS EndTime
        FROM BookingDetails bd
        WHERE bd.BookingID = b.BookingID
      ) timeRange
      OUTER APPLY (
        SELECT TOP 1
            bd.BookingDetailID,
            bd.SlotID,
            bd.CourtID,
            c.CourtName,
            c.CourtCode,
            c.CourtImage,
            c.Location,
            bd.CoachID,
            cu.FullName AS CoachName,
            cu.AvatarURL AS CoachAvatar,
            bd.CoachScheduleID
        FROM BookingDetails bd
        LEFT JOIN Courts c ON bd.CourtID = c.CourtID
        LEFT JOIN Coaches co ON bd.CoachID = co.CoachID
        LEFT JOIN Users cu ON co.UserID = cu.UserID
        WHERE bd.BookingID = b.BookingID
        ORDER BY bd.StartTime ASC
      ) mainDetail
      OUTER APPLY (
        SELECT TOP 1 PaymentID, PaymentMethod, TransactionCode, Status, PaidAt
        FROM Payments
        WHERE BookingID = b.BookingID
        ORDER BY CASE WHEN Status = 'Paid' THEN 1 ELSE 2 END ASC, CreatedAt DESC
      ) p
      WHERE b.BookingID = @BookingID
    `);

  return result.recordset[0] ?? null;
}

/**
 * UC-49: Staff xem booking trong ngay.
 * Co the loc theo ngay cu the (mac dinh la hom nay).
 * Sap xep: moi nhat len dau (CreatedAt DESC).
 */
export async function findDailyBookingsForStaff(
  date?: string
): Promise<DailyBooking[]> {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("TargetDate", sql.Date, date ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }))
    .query(`
      SELECT
        b.BookingID,
        b.BookingCode,
        b.BookingType,
        b.BookingDate,
        CONVERT(VARCHAR(5), timeRange.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), timeRange.EndTime, 108) AS EndTime,
        b.TotalAmount,
        b.Status,
        -- Fix timezone: SQL Server GETDATE() is VN local time but driver reads it as UTC
        -- Subtract 7 hours to get real UTC so JS Date shows correct VN time
        DATEADD(HOUR, -7, b.CheckInTime) AS CheckInTime,
        b.CreatedAt,

        COALESCE(NULLIF(b.GuestName, ''), u.FullName) AS PlayerName,
        u.Email AS PlayerEmail,
        COALESCE(NULLIF(b.GuestPhone, ''), u.PhoneNumber) AS PlayerPhone,

        mainDetail.CourtName,
        mainDetail.CoachName,

        p.PaymentMethod,
        p.Status AS PaymentStatus,

        r.RefundCode
      FROM Bookings b
      JOIN Users u ON u.UserID = b.UserID
      OUTER APPLY (
        SELECT
            MIN(bd.StartTime) AS StartTime,
            MAX(bd.EndTime) AS EndTime
        FROM BookingDetails bd
        WHERE bd.BookingID = b.BookingID
      ) timeRange
      OUTER APPLY (
        SELECT TOP 1
            c.CourtName,
            cu.FullName AS CoachName
        FROM BookingDetails bd
        LEFT JOIN Courts c ON bd.CourtID = c.CourtID
        LEFT JOIN Coaches co ON bd.CoachID = co.CoachID
        LEFT JOIN Users cu ON co.UserID = cu.UserID
        WHERE bd.BookingID = b.BookingID
        ORDER BY bd.StartTime ASC
      ) mainDetail
      OUTER APPLY (
        SELECT TOP 1 PaymentMethod, Status
        FROM Payments
        WHERE BookingID = b.BookingID
        ORDER BY CASE WHEN Status = 'Paid' THEN 1 ELSE 2 END ASC, CreatedAt DESC
      ) p
      LEFT JOIN Refunds r ON r.BookingID = b.BookingID
      WHERE b.BookingDate = @TargetDate
      ORDER BY b.CreatedAt DESC
    `);

  return result.recordset;
}

// ---- Team Booking (UC-36) ----

/**
 * UC-36: Tao Team Booking sau khi nhom duoc ghep thanh cong.
 * BookingCode prefix 'TM-' de phan biet voi booking thuong.
 */
export async function repoCreateTeamBooking(data: {
  userId: number;
  groupId: number;
  courtId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
}): Promise<CreatedBooking> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const request = new sql.Request(transaction);
    const bookingCode = `TM-${Date.now()}`;
    const groupNote = `[TeamBooking][GroupID:${data.groupId}]`;

    const result = await request
      .input("BookingCode", sql.NVarChar(50), bookingCode)
      .input("UserID", sql.Int, data.userId)
      .input("BookingType", sql.NVarChar(30), "Court")
      .input("BookingDate", sql.Date, data.bookingDate)
      .input("CourtID", sql.Int, data.courtId)
      .input("StartTime", sql.VarChar(5), data.startTime)
      .input("EndTime", sql.VarChar(5), data.endTime)
      .input("GroupNote", sql.NVarChar(200), groupNote)
      .query(`
        -- 1. App Lock de tranh double click
        DECLARE @LockResource NVARCHAR(255) = 'TeamBooking_' + CAST(@UserID AS VARCHAR) + '_' + CAST(@CourtID AS VARCHAR) + '_' + REPLACE(CAST(@BookingDate AS VARCHAR), '-', '') + REPLACE(CAST(@StartTime AS VARCHAR), ':', '') + REPLACE(CAST(@EndTime AS VARCHAR), ':', '');
        DECLARE @LockResult INT;
        EXEC @LockResult = sp_getapplock @Resource = @LockResource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 0;

        IF @LockResult < 0
        BEGIN
            THROW 50002, 'Hệ thống đang xử lý giao dịch của bạn. Vui lòng chờ.', 1;
        END;

        -- 2. Check Idempotency thong qua Booking hien tai (bao gom ca expired < 10phut neu dung HoldUntil o CourtSlots thi chi check o day)
        IF EXISTS (
            SELECT b.BookingID
            FROM Bookings b
            JOIN BookingDetails bd ON bd.BookingID = b.BookingID
            WHERE b.UserID = @UserID AND b.Status = 'PendingPayment'
              AND b.BookingDate = @BookingDate
              AND DATEDIFF(MINUTE, b.CreatedAt, GETDATE()) <= 10
              AND bd.CourtID = @CourtID
            GROUP BY b.BookingID
            HAVING MIN(bd.StartTime) = CAST(@StartTime AS TIME)
               AND MAX(bd.EndTime) = CAST(@EndTime AS TIME)
        )
        BEGIN
            THROW 50003, 'Bạn đang có một giao dịch chưa thanh toán trùng khớp với yêu cầu này.', 1;
        END;

        -- 3. Lock Slots vat ly theo CourtID va thoi gian (cat dung vao khoang can thiet)
        DECLARE @LockedSlots TABLE (
            SlotID INT,
            StartTime TIME,
            EndTime TIME,
            Price DECIMAL(18,2)
        );

        INSERT INTO @LockedSlots (SlotID, StartTime, EndTime, Price)
        SELECT SlotID, StartTime, EndTime, Price
        FROM CourtSlots WITH (UPDLOCK, HOLDLOCK)
        WHERE CourtID = @CourtID
          AND SlotDate = @BookingDate
          AND Status = 'Available'
          AND StartTime >= CAST(@StartTime AS TIME)
          AND EndTime <= CAST(@EndTime AS TIME);

        DECLARE @TotalSlots INT = (SELECT COUNT(*) FROM @LockedSlots);

        IF @TotalSlots = 0
        BEGIN
            THROW 50001, 'Sân không trống trong khoảng thời gian này.', 1;
        END;

        -- 4. Kiem tra tinh lien tuc bang LAG (Window Function) va do phu
        DECLARE @HasGapOrOverlap BIT = 0;
        DECLARE @ActualStart TIME = NULL;
        DECLARE @ActualEnd TIME = NULL;

        WITH CheckedSlots AS (
            SELECT
                StartTime,
                EndTime,
                LAG(EndTime) OVER (ORDER BY StartTime ASC, EndTime ASC) AS PrevEndTime
            FROM @LockedSlots
        )
        SELECT
            @ActualStart = MIN(StartTime),
            @ActualEnd = MAX(EndTime),
            @HasGapOrOverlap = MAX(CASE WHEN PrevEndTime IS NOT NULL AND StartTime <> PrevEndTime THEN 1 ELSE 0 END)
        FROM CheckedSlots;

        IF @HasGapOrOverlap = 1 OR @ActualStart <> CAST(@StartTime AS TIME) OR @ActualEnd <> CAST(@EndTime AS TIME)
        BEGIN
            THROW 50001, 'Sân không trống liên tục, bị chồng lấn, hoặc yêu cầu không khớp trọn vẹn slot vật lý.', 1;
        END;

        -- 5. Tinh toan tien te cho tung slot
        DECLARE @SlotDetails TABLE (
            RowNum INT, SlotID INT, StartTime TIME, EndTime TIME, SubTotal DECIMAL(18,2)
        );

        INSERT INTO @SlotDetails (RowNum, SlotID, StartTime, EndTime, SubTotal)
        SELECT
            ROW_NUMBER() OVER (ORDER BY StartTime ASC),
            SlotID, StartTime, EndTime,
            CAST((Price * CAST(DATEDIFF(MINUTE, StartTime, EndTime) AS DECIMAL(18,2)) / 60.0) AS DECIMAL(18,2))
        FROM @LockedSlots;

        DECLARE @TotalAmount DECIMAL(18,2) = ISNULL((SELECT SUM(SubTotal) FROM @SlotDetails), 0);

        -- 6. Insert Bookings
        INSERT INTO Bookings (
          BookingCode, UserID, BookingType, BookingDate,
          CourtFee, CoachFee, DiscountAmount, TotalAmount, Status, CancelReason
        )
        VALUES (
          @BookingCode, @UserID, @BookingType, @BookingDate,
          @TotalAmount, 0, 0, @TotalAmount, 'PendingPayment',
          @GroupNote
        );

        DECLARE @NewBookingID INT = SCOPE_IDENTITY();

        -- 7. Insert BookingDetails cho tat ca slot
        INSERT INTO BookingDetails (
          BookingID, SlotID, CourtID, CoachID, CoachScheduleID,
          BookingDate, StartTime, EndTime, CourtFee, CoachFee, SubTotal
        )
        SELECT
          @NewBookingID, SlotID, @CourtID, NULL, NULL,
          @BookingDate, StartTime, EndTime,
          SubTotal, 0, SubTotal
        FROM @SlotDetails;

        -- 8. Chuyen doi trang thai CourtSlots
        UPDATE CourtSlots
        SET Status = 'Holding',
            HoldUntil = DATEADD(MINUTE, 10, GETDATE()),
            UpdatedAt = GETDATE()
        WHERE SlotID IN (SELECT SlotID FROM @LockedSlots);

        -- 9. Tra ve ket qua 1 dong duy nhat voi thoi gian bat dau/ket thuc gom
        SELECT TOP 1
          b.BookingID, b.BookingCode, b.UserID, b.BookingType, b.BookingDate,
          b.CourtFee, b.CoachFee, b.DiscountAmount, b.TotalAmount, b.Status, b.CreatedAt,
          bd.BookingDetailID, bd.SlotID, bd.CourtID, bd.CoachID, bd.CoachScheduleID,
          CONVERT(VARCHAR(5), @ActualStart, 108) AS StartTime,
          CONVERT(VARCHAR(5), @ActualEnd, 108) AS EndTime
        FROM Bookings b
        JOIN BookingDetails bd ON bd.BookingID = b.BookingID
        WHERE b.BookingID = @NewBookingID;
      `);

    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
