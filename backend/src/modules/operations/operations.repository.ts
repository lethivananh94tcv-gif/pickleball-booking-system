import { sql, getPool } from "@/database/connection";
import { OperationBooking } from "./operations.type";

function toUtcFromLocalDb(date: Date | null | undefined): Date | null {
  if (!date) return null;
  // Subtract 7 hours (7 * 3600 * 1000 ms) because SQL Server stored GETDATE() in local time (UTC+7),
  // but tedious parsed it as UTC, causing it to be shifted +7 hours in the browser.
  return new Date(date.getTime() - 7 * 60 * 60 * 1000);
}

export async function repoGetTodayOperations(targetDate: string): Promise<OperationBooking[]> {
  const pool = await getPool();

  // GROUP BY booking để tránh duplicate rows với booking combo (nhiều BookingDetails)
  // Lấy startTime sớm nhất và endTime muộn nhất trong booking
  // courtName: ưu tiên lấy sân đầu tiên (có CourtID)
  const query = `
    SELECT 
      b.BookingID as bookingId,
      b.BookingCode as bookingCode,
      COALESCE(NULLIF(b.GuestName, ''), u.FullName) as customerName,
      COALESCE(NULLIF(b.GuestPhone, ''), u.PhoneNumber) as customerPhone,
      u.Email as customerEmail,
      (
        SELECT TOP 1 c2.CourtName
        FROM BookingDetails bd2
        LEFT JOIN Courts c2 ON bd2.CourtID = c2.CourtID
        WHERE bd2.BookingID = b.BookingID AND c2.CourtName IS NOT NULL
        ORDER BY bd2.BookingDetailID ASC
      ) as courtName,
      b.BookingDate as bookingDate,
      CONVERT(VARCHAR(5), MIN(bd.StartTime), 108) as startTime,
      CONVERT(VARCHAR(5), MAX(bd.EndTime), 108) as endTime,
      b.Status as status,
      (
        SELECT TOP 1 p2.Status
        FROM Payments p2
        WHERE p2.BookingID = b.BookingID
        ORDER BY CASE WHEN p2.Status = 'Paid' THEN 1 ELSE 2 END ASC, p2.CreatedAt DESC
      ) as paymentStatus,
      b.CheckInTime as checkInTime
    FROM Bookings b
    INNER JOIN Users u ON b.UserID = u.UserID
    LEFT JOIN BookingDetails bd ON b.BookingID = bd.BookingID
    WHERE b.BookingDate = @TargetDate
      AND (
        b.Status NOT IN ('Cancelled', 'Refunded', 'PendingPayment')
        OR (
          b.Status IN ('Cancelled', 'Refunded')
          AND EXISTS (
            SELECT 1 FROM Payments p3
            WHERE p3.BookingID = b.BookingID AND p3.Status = 'Paid'
          )
        )
      )
    GROUP BY
      b.BookingID,
      b.BookingCode,
      b.GuestName,
      b.GuestPhone,
      u.FullName,
      u.PhoneNumber,
      u.Email,
      b.BookingDate,
      b.Status,
      b.CheckInTime
    ORDER BY MIN(bd.StartTime) ASC
  `;
  
  const result = await pool.request()
    .input("TargetDate", sql.Date, targetDate)
    .query(query);
    
  return result.recordset.map((row) => ({
    bookingId: row.bookingId,
    bookingCode: row.bookingCode,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    courtName: row.courtName,
    bookingDate: row.bookingDate.toISOString().split('T')[0],
    startTime: row.startTime || '',
    endTime: row.endTime || '',
    status: row.status,
    paymentStatus: row.paymentStatus,
    checkInTime: (() => {
      const utcDate = toUtcFromLocalDb(row.checkInTime);
      return utcDate ? utcDate.toISOString() : null;
    })(),
  }));
}

export async function repoUpdateBookingStatus(
  bookingId: number, 
  status: string, 
  note?: string,
  setCheckInTime: boolean = false
): Promise<void> {
  const pool = await getPool();
  let query = `UPDATE Bookings SET Status = @Status, UpdatedAt = GETDATE()`;
  
  if (setCheckInTime) {
    query += `, CheckInTime = GETDATE()`;
  }
  
  if (note && status === 'NoShow') {
    query += `, CancelReason = @Note`;
  }
  
  query += ` WHERE BookingID = @BookingID`;

  const request = pool.request()
    .input("Status", sql.NVarChar, status)
    .input("BookingID", sql.Int, bookingId);
    
  if (note && status === 'NoShow') {
    request.input("Note", sql.NVarChar, note);
  }

  await request.query(query);
}

export async function repoGetBookingStatus(bookingId: number): Promise<{ Status: string, BookingCode: string, BookingDate: Date, StartTime: Date | null, EndTime: Date | null } | null> {
  const pool = await getPool();
  // Dùng aggregate để tránh duplicate khi booking có nhiều BookingDetails (combo)
  const query = `
    SELECT 
      b.Status, 
      b.BookingCode,
      b.BookingDate,
      MIN(bd.StartTime) as StartTime,
      MAX(bd.EndTime) as EndTime
    FROM Bookings b
    LEFT JOIN BookingDetails bd ON b.BookingID = bd.BookingID
    WHERE b.BookingID = @BookingID
    GROUP BY b.Status, b.BookingCode, b.BookingDate
  `;
  const result = await pool.request()
    .input("BookingID", sql.Int, bookingId)
    .query(query);
    
  if (result.recordset.length === 0) return null;
  return result.recordset[0];
}

export async function repoGetBookingLogs(bookingId: number) {
  const pool = await getPool();
  const query = `
    SELECT 
      al.AuditLogID as logId,
      al.ActionName as action,
      al.Description as note,
      al.CreatedAt as createdAt,
      u.FullName as actorName
    FROM AuditLogs al
    LEFT JOIN Users u ON al.UserID = u.UserID
    WHERE al.TableName = 'Bookings' AND al.EntityID = @BookingID
    ORDER BY al.CreatedAt DESC
  `;
  const result = await pool.request()
    .input("BookingID", sql.Int, bookingId)
    .query(query);
    
    return result.recordset.map(row => ({
    logId: row.logId,
    action: row.action,
    note: row.note,
    createdAt: (() => {
      const utcDate = toUtcFromLocalDb(row.createdAt);
      return utcDate ? utcDate.toISOString() : "";
    })(),
    actorName: row.actorName || "System"
  }));
}

export async function repoGetExpiredConfirmedBookings(targetDate: string): Promise<{ BookingID: number, BookingCode: string, UserID: number, CoachID: number | null, BookingDate: Date, StartTime: Date | null, EndTime: Date | null }[]> {
  const pool = await getPool();
  const query = `
    SELECT 
      b.BookingID, 
      b.BookingCode,
      b.UserID,
      coachDetail.CoachID AS CoachID,
      b.BookingDate,
      MIN(bd.StartTime) as StartTime,
      MAX(bd.EndTime) as EndTime
    FROM Bookings b
    LEFT JOIN BookingDetails bd ON b.BookingID = bd.BookingID
    OUTER APPLY (
        SELECT TOP 1 inner_bd.CoachID
        FROM BookingDetails inner_bd
        WHERE inner_bd.BookingID = b.BookingID
          AND inner_bd.CoachID IS NOT NULL
    ) coachDetail
    WHERE b.BookingDate = @TargetDate AND b.Status IN ('Confirmed', 'Paid')
    GROUP BY
      b.BookingID,
      b.BookingCode,
      b.UserID,
      coachDetail.CoachID,
      b.BookingDate
  `;
  const result = await pool.request()
    .input("TargetDate", sql.Date, targetDate)
    .query(query);
    
  return result.recordset;
}
