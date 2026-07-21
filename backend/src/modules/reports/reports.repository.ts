
import type {
  ExportReportDto,
  ReportExportHistory,
} from "./dto/export-report.dto";



import { getPool, sql } from "@/database/connection";

export async function getDashboardStatsFromDB() {
  const pool = await getPool();
  const targetDate = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

  const queries = `
    -- Today Revenue
    SELECT (
      SELECT ISNULL(SUM(TotalAmount), 0) 
      FROM Bookings 
      WHERE BookingDate = @TargetDate AND Status IN ('Confirmed', 'Completed', 'CheckedIn')
    ) + (
      SELECT ISNULL(SUM(Amount), 0) 
      FROM TournamentPayments 
      WHERE PaymentStatus = 'Paid' AND CAST(COALESCE(PaidAt, CreatedAt) AS DATE) = @TargetDate
    ) AS TodayRevenue,
    (
      SELECT ISNULL(SUM(Amount), 0) 
      FROM TournamentPayments 
      WHERE PaymentStatus = 'Paid' AND CAST(COALESCE(PaidAt, CreatedAt) AS DATE) = @TargetDate
    ) AS TodayTournamentRevenue;

    -- Today Bookings Count
    SELECT COUNT(*) AS TodayBookingsCount
    FROM Bookings
    WHERE BookingDate = @TargetDate
      AND Status != 'PendingPayment';

    -- Active Courts
    SELECT COUNT(*) AS ActiveCourts FROM Courts WHERE Status = 'Available';

    -- Total Courts
    SELECT COUNT(*) AS TotalCourts FROM Courts;

    -- Active Coaches
    SELECT COUNT(*) AS ActiveCoaches 
    FROM Coaches c
    JOIN Users u ON c.UserID = u.UserID
    WHERE c.Status = 'Approved' AND u.Status = 'Active';

    -- Active Staff
    SELECT COUNT(DISTINCT u.UserID) AS ActiveStaff 
    FROM Users u
    JOIN UserRoles ur ON u.UserID = ur.UserID
    JOIN Roles r ON ur.RoleID = r.RoleID
    WHERE r.RoleName = 'Staff' AND u.Status = 'Active';

    -- Active Combos
    SELECT COUNT(*) AS ActiveCombos 
    FROM Promotions 
    WHERE Status = 'Active';

    -- Latest Bookings (Top 5)
    SELECT TOP 5
      b.BookingCode,
      u.FullName AS PlayerName,
      u.Email AS PlayerEmail,
      u.PhoneNumber AS PlayerPhone,
      b.BookingType AS ServiceType,
      b.Status,
      b.CreatedAt,
      bd.StartTime,
      bd.EndTime,
      c.CourtName,
      coach.FullName AS CoachName
    FROM Bookings b
    LEFT JOIN Users u ON b.UserID = u.UserID
    LEFT JOIN BookingDetails bd ON b.BookingID = bd.BookingID
    LEFT JOIN Courts c ON bd.CourtID = c.CourtID
    LEFT JOIN Coaches co ON bd.CoachID = co.CoachID
    LEFT JOIN Users coach ON co.UserID = coach.UserID
    ORDER BY b.CreatedAt DESC;
  `;

  const result = await pool.request()
    .input("TargetDate", sql.Date, targetDate)
    .query(queries);
    
  const rs = result.recordsets as any[][];

  return {
    todayRevenue: rs[0][0].TodayRevenue,
    todayTournamentRevenue: rs[0][0].TodayTournamentRevenue,
    todayBookingsCount: rs[1][0].TodayBookingsCount,
    activeCourts: rs[2][0].ActiveCourts,
    totalCourts: rs[3][0].TotalCourts,
    activeCoaches: rs[4][0].ActiveCoaches,
    activeStaff: rs[5][0].ActiveStaff,
    activeCombos: rs[6][0].ActiveCombos,
    latestBookings: rs[7].map((b: any) => ({
      BookingCode: b.BookingCode,
      PlayerName: b.PlayerName,
      PlayerEmail: b.PlayerEmail,
      PlayerPhone: b.PlayerPhone,
      ServiceType: b.ServiceType,
      CourtName: b.CourtName,
      CoachName: b.CoachName,
      StartTime: b.StartTime ? new Date(b.StartTime.getTime() - b.StartTime.getTimezoneOffset() * 60000).toISOString().substring(11, 16) : null,
      EndTime: b.EndTime ? new Date(b.EndTime.getTime() - b.EndTime.getTimezoneOffset() * 60000).toISOString().substring(11, 16) : null,
      Status: b.Status,
      CreatedAt: b.CreatedAt ? b.CreatedAt.toISOString() : null,
    })),
  };
}
export type ReportDatabaseRow =
  Record<
    string,
    string | number | Date | null
  >;

export interface CreateReportExportLogInput {
  exportedBy: number;

  reportType:
    ExportReportDto["reportType"];

  format:
    ExportReportDto["format"];

  filters: {
    startDate: string;
    endDate: string;
    status?: string | null;
  };

  filename?: string;
  rowCount?: number;

  status:
    | "SUCCESS"
    | "FAILED";

  errorMessage?: string;
}

export async function getReportExportRowsFromDB(
  input: ExportReportDto
): Promise<ReportDatabaseRow[]> {
  switch (input.reportType) {
    case "revenue":
      return getRevenueReportRows(
        input
      );

    case "bookings":
      return getBookingReportRows(
        input
      );

    case "coach_income":
      return getCoachIncomeReportRows(
        input
      );

    default:
      return [];
  }
}

async function getRevenueReportRows(
  input: ExportReportDto
): Promise<ReportDatabaseRow[]> {
  const pool = await getPool();

  const request = pool
    .request()
    .input(
      "StartDate",
      sql.Date,
      input.startDate
    )
    .input(
      "EndDate",
      sql.Date,
      input.endDate
    );

  let statusCondition = `
    AND b.Status IN (
      'Confirmed',
      'Completed',
      'CheckedIn'
    )
  `;

  if (input.status) {
    request.input(
      "Status",
      sql.NVarChar(50),
      input.status
    );

    statusCondition = `
      AND b.Status = @Status
    `;
  }

  const result =
    await request.query(`
      WITH RevenueByCourt AS (
        SELECT DISTINCT
          b.BookingID,
          b.BookingDate,
          c.CourtID,
          c.CourtName,
          bd.CourtFee
        FROM Bookings b
        INNER JOIN BookingDetails bd
          ON b.BookingID =
            bd.BookingID
        INNER JOIN Courts c
          ON bd.CourtID =
            c.CourtID
        WHERE
          b.BookingDate >= @StartDate

          AND b.BookingDate <= @EndDate

          ${statusCondition}
      ),

      RevenueSummary AS (
        SELECT
          CONVERT(
            VARCHAR(10),
            BookingDate,
            23
          ) AS ReportDate,

          CourtName,

          COUNT(DISTINCT BookingID) AS BookingCount,

          CAST(
            ISNULL(
              SUM(CourtFee),
              0
            )
            AS DECIMAL(18, 2)
          ) AS TotalRevenue

        FROM RevenueByCourt

        GROUP BY
          BookingDate,
          CourtID,
          CourtName
      ),

      RevenueWithTotal AS (
        SELECT
          *,
          SUM(TotalRevenue) OVER (
            PARTITION BY ReportDate
          ) AS DailyTotalRevenue,
          SUM(TotalRevenue) OVER () AS GrandTotalRevenue
        FROM RevenueSummary
      )

      SELECT
        ReportDate,

        CourtName,

        BookingCount,

        TotalRevenue,

        DailyTotalRevenue,

        CAST(
          CASE
            WHEN BookingCount > 0
              THEN TotalRevenue / BookingCount
            ELSE 0
          END
          AS DECIMAL(18, 2)
        ) AS AvgRevenuePerBooking,

        CAST(
          CASE
            WHEN GrandTotalRevenue > 0
              THEN TotalRevenue * 100.0 / GrandTotalRevenue
            ELSE 0
          END
          AS DECIMAL(9, 2)
        ) AS RevenueSharePercent

      FROM RevenueWithTotal

      ORDER BY
        ReportDate ASC,
        CourtName ASC;
    `);

  return result.recordset.map(
    (row: any) => ({
      ReportDate:
        row.ReportDate ?? "",

      CourtName:
        row.CourtName ?? "",

      BookingCount:
        Number(
          row.BookingCount ?? 0
        ),

      TotalRevenue:
        Number(
          row.TotalRevenue ?? 0
        ),

      DailyTotalRevenue:
        Number(
          row.DailyTotalRevenue ?? 0
        ),

      AvgRevenuePerBooking:
        Number(
          row.AvgRevenuePerBooking ?? 0
        ),

      RevenueSharePercent:
        Number(
          row.RevenueSharePercent ?? 0
        ),
    })
  );
}

async function getBookingReportRows(
  input: ExportReportDto
): Promise<ReportDatabaseRow[]> {
  const pool = await getPool();

  const request = pool
    .request()
    .input(
      "StartDate",
      sql.Date,
      input.startDate
    )
    .input(
      "EndDate",
      sql.Date,
      input.endDate
    );

  let statusCondition = "";

  if (input.status) {
    request.input(
      "Status",
      sql.NVarChar(50),
      input.status
    );

    statusCondition = `
      AND b.Status = @Status
    `;
  }

  const result =
    await request.query(`
      SELECT
        b.BookingID,

        b.BookingCode,

        CONVERT(
          VARCHAR(10),
          b.BookingDate,
          23
        ) AS BookingDate,

        b.BookingType,

        b.Status,

        CAST(
          ISNULL(
            b.TotalAmount,
            0
          )
          AS DECIMAL(18, 2)
        ) AS TotalAmount,

        CONVERT(
          VARCHAR(19),
          b.CreatedAt,
          120
        ) AS CreatedAt,

        player.FullName
          AS PlayerName,

        player.Email
          AS PlayerEmail,

        player.PhoneNumber
          AS PlayerPhone,

        c.CourtName,

        coach.FullName
          AS CoachName,

        CONVERT(
          VARCHAR(5),
          bd.StartTime,
          108
        ) AS StartTime,

        CONVERT(
          VARCHAR(5),
          bd.EndTime,
          108
        ) AS EndTime

      FROM Bookings b

      LEFT JOIN Users player
        ON b.UserID =
          player.UserID

      LEFT JOIN BookingDetails bd
        ON b.BookingID =
          bd.BookingID

      LEFT JOIN Courts c
        ON bd.CourtID =
          c.CourtID

      LEFT JOIN Coaches co
        ON bd.CoachID =
          co.CoachID

      LEFT JOIN Users coach
        ON co.UserID =
          coach.UserID

      WHERE
        b.BookingDate >= @StartDate

        AND b.BookingDate <= @EndDate

        ${statusCondition}

      ORDER BY
        b.BookingDate DESC,
        bd.StartTime ASC;
    `);

  return result.recordset.map(
    (row: any) => ({
      BookingCode:
        row.BookingCode ?? "",

      BookingDate:
        row.BookingDate ?? "",

      PlayerName:
        row.PlayerName ?? "",

      PlayerEmail:
        row.PlayerEmail ?? "",

      PlayerPhone:
        row.PlayerPhone ?? "",

      BookingType:
        row.BookingType ?? "",

      CourtName:
        row.CourtName ?? "",

      CoachName:
        row.CoachName ?? "",

      StartTime:
        row.StartTime ?? "",

      EndTime:
        row.EndTime ?? "",

      Status:
        row.Status ?? "",

      TotalAmount:
        Number(
          row.TotalAmount ?? 0
        ),

      CreatedAt:
        row.CreatedAt ?? "",
    })
  );
}

async function getCoachIncomeReportRows(
  input: ExportReportDto
): Promise<ReportDatabaseRow[]> {
  const pool = await getPool();

  const request = pool
    .request()
    .input(
      "StartDate",
      sql.Date,
      input.startDate
    )
    .input(
      "EndDate",
      sql.Date,
      input.endDate
    );

  let statusCondition = `
    AND b.Status IN (
      'Confirmed',
      'Completed',
      'CheckedIn'
    )
  `;

  if (input.status) {
    request.input(
      "Status",
      sql.NVarChar(50),
      input.status
    );

    statusCondition = `
      AND b.Status = @Status
    `;
  }

  /*
   * Mỗi booking chỉ được tính một lần
   * cho một huấn luyện viên.
   *
   * TotalIncome hiện lấy TotalAmount
   * của booking có huấn luyện viên.
   *
   * Nếu BookingDetails có cột CoachFee,
   * hãy đổi TotalAmount thành CoachFee.
   */
  const result =
    await request.query(`
      WITH CoachBookings AS (
        SELECT DISTINCT
          bd.CoachID,

          b.BookingID,

          CAST(
            ISNULL(
              b.TotalAmount,
              0
            )
            AS DECIMAL(18, 2)
          ) AS IncomeAmount

        FROM BookingDetails bd

        INNER JOIN Bookings b
          ON bd.BookingID =
            b.BookingID

        WHERE
          bd.CoachID IS NOT NULL

          AND b.BookingDate >=
            @StartDate

          AND b.BookingDate <=
            @EndDate

          ${statusCondition}
      )

      SELECT
        co.CoachID,

        coach.FullName
          AS CoachName,

        coach.Email
          AS CoachEmail,

        COUNT(
          cb.BookingID
        ) AS SessionCount,

        CAST(
          ISNULL(
            SUM(
              cb.IncomeAmount
            ),
            0
          )
          AS DECIMAL(18, 2)
        ) AS TotalIncome

      FROM CoachBookings cb

      INNER JOIN Coaches co
        ON cb.CoachID =
          co.CoachID

      INNER JOIN Users coach
        ON co.UserID =
          coach.UserID

      GROUP BY
        co.CoachID,
        coach.FullName,
        coach.Email

      ORDER BY
        TotalIncome DESC;
    `);

  return result.recordset.map(
    (row: any) => ({
      CoachID:
        Number(
          row.CoachID
        ),

      CoachName:
        row.CoachName ?? "",

      CoachEmail:
        row.CoachEmail ?? "",

      SessionCount:
        Number(
          row.SessionCount ?? 0
        ),

      TotalIncome:
        Number(
          row.TotalIncome ?? 0
        ),
    })
  );
}

export async function createReportExportLogInDB(
  input: CreateReportExportLogInput
): Promise<number> {
  const pool = await getPool();

  const result = await pool
    .request()
    .input(
      "ExportedBy",
      sql.Int,
      input.exportedBy
    )
    .input(
      "ReportType",
      sql.NVarChar(50),
      input.reportType
    )
    .input(
      "Format",
      sql.NVarChar(10),
      input.format
    )
    .input(
      "Filters",
      sql.NVarChar(sql.MAX),
      JSON.stringify(
        input.filters
      )
    )
    .input(
      "FileName",
      sql.NVarChar(255),
      input.filename ?? null
    )
    .input(
      "RowCount",
      sql.Int,
      input.rowCount ?? 0
    )
    .input(
      "Status",
      sql.NVarChar(20),
      input.status
    )
    .input(
      "ErrorMessage",
      sql.NVarChar(sql.MAX),
      input.errorMessage
        ? input.errorMessage.slice(
            0,
            4000
          )
        : null
    )
    .query(`
      INSERT INTO ReportExportLogs (
        ExportedBy,
        ReportType,
        [Format],
        Filters,
        [FileName],
        [RowCount],
        [Status],
        ErrorMessage,
        CreatedAt
      )
      VALUES (
        @ExportedBy,
        @ReportType,
        @Format,
        @Filters,
        @FileName,
        @RowCount,
        @Status,
        @ErrorMessage,
        SYSUTCDATETIME()
      );

      SELECT
        CAST(
          SCOPE_IDENTITY()
          AS INT
        ) AS ReportExportLogID;
    `);

  return Number(
    result.recordset[0]
      .ReportExportLogID
  );
}

export async function getReportExportHistoryFromDB(
  limit = 50
): Promise<
  ReportExportHistory[]
> {
  const pool = await getPool();

  const safeLimit = Math.min(
    Math.max(
      Math.trunc(limit),
      1
    ),
    100
  );

  const result = await pool
    .request()
    .input(
      "Limit",
      sql.Int,
      safeLimit
    )
    .query(`
      SELECT TOP (@Limit)
        log.ReportExportLogID,

        log.ExportedBy,

        log.ReportType,

        log.[Format],

        log.Filters,

        log.[FileName],

        log.[RowCount],

        log.[Status],

        log.ErrorMessage,

        log.CreatedAt,

        u.FullName
          AS ExporterName

      FROM ReportExportLogs log

      LEFT JOIN Users u
        ON log.ExportedBy =
          u.UserID

      ORDER BY
        log.CreatedAt DESC;
    `);

  return result.recordset.map(
    (row: any) => ({
      id:
        Number(
          row.ReportExportLogID
        ),

      exportedBy:
        Number(
          row.ExportedBy
        ),

      exporterName:
        row.ExporterName ?? null,

      reportType:
        row.ReportType,

      format:
        row.Format,

      filters:
        parseReportFilters(
          row.Filters
        ),

      filename:
        row.FileName ?? null,

      rowCount:
        Number(
          row.RowCount ?? 0
        ),

      status:
        row.Status,

      errorMessage:
        row.ErrorMessage ?? null,

      createdAt:
        row.CreatedAt
          ? new Date(
              row.CreatedAt
            ).toISOString()
          : "",
    })
  );
}

function parseReportFilters(
  value: unknown
): ReportExportHistory["filters"] {
  if (
    typeof value === "object" &&
    value !== null
  ) {
    return value as ReportExportHistory["filters"];
  }

  if (typeof value !== "string") {
    return {};
  }

  try {
    return JSON.parse(
      value
    ) as ReportExportHistory["filters"];
  } catch {
    return {};
  }
}

export async function getSaaSDashboardStatsFromDB(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string
) {
  const pool = await getPool();

  const query = `
    -- 1. Current Revenue
    SELECT (
      SELECT ISNULL(SUM(TotalAmount), 0)
      FROM Bookings
      WHERE BookingDate BETWEEN @StartDate AND @EndDate
        AND Status IN ('Confirmed', 'Completed', 'CheckedIn', 'Paid')
    ) + (
      SELECT ISNULL(SUM(Amount), 0)
      FROM TournamentPayments
      WHERE PaymentStatus = 'Paid'
        AND CAST(COALESCE(PaidAt, CreatedAt) AS DATE) BETWEEN @StartDate AND @EndDate
    ) AS Revenue,
    (
      SELECT ISNULL(SUM(Amount), 0)
      FROM TournamentPayments
      WHERE PaymentStatus = 'Paid'
        AND CAST(COALESCE(PaidAt, CreatedAt) AS DATE) BETWEEN @StartDate AND @EndDate
    ) AS TournamentRevenue,
    (
      SELECT (
        SELECT ISNULL(SUM(TotalAmount), 0)
        FROM Bookings
        WHERE YEAR(BookingDate) = YEAR(GETDATE()) AND MONTH(BookingDate) = MONTH(GETDATE())
          AND Status IN ('Confirmed', 'Completed', 'CheckedIn', 'Paid')
      ) + (
        SELECT ISNULL(SUM(Amount), 0)
        FROM TournamentPayments
        WHERE PaymentStatus = 'Paid'
          AND YEAR(COALESCE(PaidAt, CreatedAt)) = YEAR(GETDATE()) AND MONTH(COALESCE(PaidAt, CreatedAt)) = MONTH(GETDATE())
      )
    ) AS MonthRevenue;

    -- 2. Previous Revenue
    SELECT (
      SELECT ISNULL(SUM(TotalAmount), 0)
      FROM Bookings
      WHERE BookingDate BETWEEN @PrevStartDate AND @PrevEndDate
        AND Status IN ('Confirmed', 'Completed', 'CheckedIn', 'Paid')
    ) + (
      SELECT ISNULL(SUM(Amount), 0)
      FROM TournamentPayments
      WHERE PaymentStatus = 'Paid'
        AND CAST(COALESCE(PaidAt, CreatedAt) AS DATE) BETWEEN @PrevStartDate AND @PrevEndDate
    ) AS PrevRevenue,
    (
      SELECT ISNULL(SUM(Amount), 0)
      FROM TournamentPayments
      WHERE PaymentStatus = 'Paid'
        AND CAST(COALESCE(PaidAt, CreatedAt) AS DATE) BETWEEN @PrevStartDate AND @PrevEndDate
    ) AS PrevTournamentRevenue;

    -- 3. Current Bookings
    SELECT COUNT(*) AS BookingsCount
    FROM Bookings
    WHERE BookingDate BETWEEN @StartDate AND @EndDate
      AND Status != 'PendingPayment';

    -- 4. Previous Bookings
    SELECT COUNT(*) AS PrevBookingsCount
    FROM Bookings
    WHERE BookingDate BETWEEN @PrevStartDate AND @PrevEndDate
      AND Status != 'PendingPayment';

    -- 5. System Stats
    SELECT COUNT(*) AS TotalCourts FROM Courts;
    SELECT COUNT(*) AS ActiveCourts FROM Courts WHERE Status = 'Available';
    
    SELECT COUNT(*) AS ActiveCoaches 
    FROM Coaches c
    JOIN Users u ON c.UserID = u.UserID
    WHERE c.Status = 'Approved' AND u.Status = 'Active';

    SELECT COUNT(DISTINCT u.UserID) AS ActiveStaff 
    FROM Users u
    JOIN UserRoles ur ON u.UserID = ur.UserID
    JOIN Roles r ON ur.RoleID = r.RoleID
    WHERE r.RoleName = 'Staff' AND u.Status = 'Active';

    SELECT COUNT(*) AS ActiveCombos 
    FROM Promotions 
    WHERE Status = 'Active';

    -- 6. Daily Revenue Trend
    WITH UnifiedDailyRevenue AS (
      SELECT 
        CAST(BookingDate AS DATE) AS RevenueDate,
        TotalAmount AS Amount,
        1 AS BookingVal
      FROM Bookings
      WHERE BookingDate BETWEEN @StartDate AND @EndDate
        AND Status IN ('Confirmed', 'Completed', 'CheckedIn', 'Paid')
      UNION ALL
      SELECT
        CAST(COALESCE(PaidAt, CreatedAt) AS DATE) AS RevenueDate,
        Amount,
        0 AS BookingVal
      FROM TournamentPayments
      WHERE PaymentStatus = 'Paid'
        AND CAST(COALESCE(PaidAt, CreatedAt) AS DATE) BETWEEN @StartDate AND @EndDate
    )
    SELECT 
      CONVERT(VARCHAR(10), RevenueDate, 23) AS DateStr,
      ISNULL(SUM(Amount), 0) AS Revenue,
      SUM(BookingVal) AS BookingsCount
    FROM UnifiedDailyRevenue
    GROUP BY RevenueDate
    ORDER BY RevenueDate ASC;

    -- 7. Hourly Booking Trend
    SELECT 
      DATEPART(HOUR, bd.StartTime) AS HourOfDay,
      COUNT(DISTINCT b.BookingID) AS BookingsCount
    FROM Bookings b
    JOIN BookingDetails bd ON b.BookingID = bd.BookingID
    WHERE b.BookingDate BETWEEN @StartDate AND @EndDate
      AND b.Status != 'PendingPayment'
    GROUP BY DATEPART(HOUR, bd.StartTime)
    ORDER BY HourOfDay ASC;

    -- 8. Booking Status Breakdown
    SELECT Status, COUNT(*) AS Count
    FROM Bookings
    WHERE BookingDate BETWEEN @StartDate AND @EndDate
      AND Status != 'PendingPayment'
    GROUP BY Status;

    -- 9. Top Courts
    SELECT TOP 5
      c.CourtID,
      c.CourtName,
      COUNT(DISTINCT b.BookingID) AS BookingsCount,
      ISNULL(SUM(b.TotalAmount), 0) AS TotalRevenue
    FROM Bookings b
    JOIN BookingDetails bd ON b.BookingID = bd.BookingID
    JOIN Courts c ON bd.CourtID = c.CourtID
    WHERE b.BookingDate BETWEEN @StartDate AND @EndDate
      AND b.Status IN ('Confirmed', 'Completed', 'CheckedIn', 'Paid')
    GROUP BY c.CourtID, c.CourtName
    ORDER BY BookingsCount DESC, TotalRevenue DESC;

    -- 10. Top Coaches
    SELECT TOP 5
      co.CoachID,
      u.FullName AS CoachName,
      COUNT(DISTINCT b.BookingID) AS BookingsCount,
      ISNULL(SUM(b.TotalAmount), 0) AS TotalRevenue
    FROM Bookings b
    JOIN BookingDetails bd ON b.BookingID = bd.BookingID
    JOIN Coaches co ON bd.CoachID = co.CoachID
    JOIN Users u ON co.UserID = u.UserID
    WHERE b.BookingDate BETWEEN @StartDate AND @EndDate
      AND b.Status IN ('Confirmed', 'Completed', 'CheckedIn', 'Paid')
    GROUP BY co.CoachID, u.FullName
    ORDER BY BookingsCount DESC, TotalRevenue DESC;

    -- 11. Top Combos
    SELECT TOP 5
      p.PromotionID,
      p.PromotionCode,
      p.PromotionName,
      COUNT(b.BookingID) AS UsageCount
    FROM Bookings b
    JOIN Promotions p ON b.PromotionID = p.PromotionID
    WHERE b.BookingDate BETWEEN @StartDate AND @EndDate
      AND b.Status IN ('Confirmed', 'Completed', 'CheckedIn', 'Paid')
    GROUP BY p.PromotionID, p.PromotionCode, p.PromotionName
    ORDER BY UsageCount DESC;

    -- 12. Payment Method Analytics
    WITH UnifiedPaidPayments AS (
      SELECT PaymentMethod, Amount, CreatedAt FROM Payments WHERE Status = 'Paid'
      UNION ALL
      SELECT PaymentMethod, Amount, CreatedAt FROM TournamentPayments WHERE PaymentStatus = 'Paid'
    )
    SELECT 
      CASE 
        WHEN PaymentMethod IN ('Cash', 'Tiền mặt') THEN N'Tiền mặt (Khách vãng lai)'
        ELSE N'VietQR'
      END AS PaymentMethod,
      COUNT(*) AS Count,
      ISNULL(SUM(Amount), 0) AS TotalAmount
    FROM UnifiedPaidPayments
    WHERE CreatedAt BETWEEN CAST(@StartDate AS DATETIME) AND DATEADD(DAY, 1, CAST(@EndDate AS DATETIME))
    GROUP BY 
      CASE 
        WHEN PaymentMethod IN ('Cash', 'Tiền mặt') THEN N'Tiền mặt (Khách vãng lai)'
        ELSE N'VietQR'
      END;

    -- 13. New Users
    SELECT COUNT(*) AS NewUsersCount
    FROM Users
    WHERE CreatedAt BETWEEN CAST(@StartDate AS DATETIME) AND DATEADD(DAY, 1, CAST(@EndDate AS DATETIME));

    -- 14. Active Users
    SELECT COUNT(DISTINCT UserID) AS ActiveUsersCount
    FROM Bookings
    WHERE BookingDate BETWEEN @StartDate AND @EndDate;

    -- 15. Returning Users
    SELECT COUNT(*) AS ReturningUsersCount
    FROM (
      SELECT UserID
      FROM Bookings
      GROUP BY UserID
      HAVING COUNT(BookingID) >= 2
    ) AS Sub;

    -- 16. Recent Activities
    SELECT TOP 10 * FROM (
      SELECT 
        'Booking' AS ActivityType,
        b.CreatedAt,
        u.FullName AS ActorName,
        b.BookingCode AS EventCode,
        N'Đơn hàng mới ' + b.BookingCode + N' (' + b.BookingType + N')' AS Description,
        b.TotalAmount AS AmountValue
      FROM Bookings b
      JOIN Users u ON b.UserID = u.UserID
      WHERE b.CreatedAt BETWEEN CAST(@StartDate AS DATETIME) AND DATEADD(DAY, 1, CAST(@EndDate AS DATETIME))

      UNION ALL

      SELECT 
        'Payment' AS ActivityType,
        p.CreatedAt,
        u.FullName AS ActorName,
        p.TransactionCode AS EventCode,
        N'Thanh toán qua ' + p.PaymentMethod,
        p.Amount AS AmountValue
      FROM Payments p
      JOIN Bookings b ON p.BookingID = b.BookingID
      JOIN Users u ON b.UserID = u.UserID
      WHERE p.Status = 'Paid'
        AND p.CreatedAt BETWEEN CAST(@StartDate AS DATETIME) AND DATEADD(DAY, 1, CAST(@EndDate AS DATETIME))

      UNION ALL

      SELECT 
        'TournamentPayment' AS ActivityType,
        tp.CreatedAt,
        u.FullName AS ActorName,
        tp.TransactionCode AS EventCode,
        N'Đăng ký giải đấu: ' + t.TournamentName AS Description,
        tp.Amount AS AmountValue
      FROM TournamentPayments tp
      INNER JOIN TournamentRegistrations tr ON tp.RegistrationID = tr.RegistrationID
      INNER JOIN Tournaments t ON tr.TournamentID = t.TournamentID
      INNER JOIN Users u ON tr.RegisteredBy = u.UserID
      WHERE tp.PaymentStatus = 'Paid'
        AND tp.CreatedAt BETWEEN CAST(@StartDate AS DATETIME) AND DATEADD(DAY, 1, CAST(@EndDate AS DATETIME))

      UNION ALL

      SELECT 
        'Refund' AS ActivityType,
        r.RequestedAt AS CreatedAt,
        u.FullName AS ActorName,
        b.BookingCode AS EventCode,
        N'Hoàn tiền: ' + r.Reason AS Description,
        r.RefundAmount AS AmountValue
      FROM Refunds r
      JOIN Bookings b ON r.BookingID = b.BookingID
      JOIN Users u ON b.UserID = u.UserID
      WHERE r.RequestedAt BETWEEN CAST(@StartDate AS DATETIME) AND DATEADD(DAY, 1, CAST(@EndDate AS DATETIME))

      UNION ALL

      SELECT 
        'TournamentRefund' AS ActivityType,
        r.RequestedAt AS CreatedAt,
        u.FullName AS ActorName,
        r.RefundCode AS EventCode,
        N'Hoàn tiền giải đấu: ' + r.Reason AS Description,
        r.RefundAmount AS AmountValue
      FROM Refunds r
      INNER JOIN TournamentRegistrations tr ON r.RegistrationID = tr.RegistrationID
      INNER JOIN Users u ON tr.RegisteredBy = u.UserID
      WHERE r.RequestedAt BETWEEN CAST(@StartDate AS DATETIME) AND DATEADD(DAY, 1, CAST(@EndDate AS DATETIME))

      UNION ALL

      SELECT 
        'User' AS ActivityType,
        u.CreatedAt,
        u.FullName AS ActorName,
        u.Email AS EventCode,
        N'Người chơi đăng ký tài khoản mới' AS Description,
        NULL AS AmountValue
      FROM Users u
      JOIN UserRoles ur ON u.UserID = ur.UserID
      JOIN Roles r ON ur.RoleID = r.RoleID
      WHERE r.RoleName = 'Player'
        AND u.CreatedAt BETWEEN CAST(@StartDate AS DATETIME) AND DATEADD(DAY, 1, CAST(@EndDate AS DATETIME))

      UNION ALL

      SELECT 
        'Promotion' AS ActivityType,
        p.CreatedAt,
        N'Admin' AS ActorName,
        p.PromotionCode AS EventCode,
        N'Tạo chương trình khuyến mãi: ' + p.PromotionName AS Description,
        NULL AS AmountValue
      FROM Promotions p
      WHERE p.CreatedAt BETWEEN CAST(@StartDate AS DATETIME) AND DATEADD(DAY, 1, CAST(@EndDate AS DATETIME))
    ) AS Activities
    ORDER BY CreatedAt DESC;
  `;

  const result = await pool.request()
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate)
    .input("PrevStartDate", sql.Date, prevStartDate)
    .input("PrevEndDate", sql.Date, prevEndDate)
    .query(query);

  const rs = result.recordsets as any[][];

  return {
    revenue: Number(rs[0][0]?.Revenue || 0),
    tournamentRevenue: Number(rs[0][0]?.TournamentRevenue || 0),
    monthRevenue: Number(rs[0][0]?.MonthRevenue || 0),
    prevRevenue: Number(rs[1][0]?.PrevRevenue || 0),
    prevTournamentRevenue: Number(rs[1][0]?.PrevTournamentRevenue || 0),
    bookingsCount: Number(rs[2][0]?.BookingsCount || 0),
    prevBookingsCount: Number(rs[3][0]?.PrevBookingsCount || 0),
    totalCourts: Number(rs[4][0]?.TotalCourts || 0),
    activeCourts: Number(rs[5][0]?.ActiveCourts || 0),
    activeCoaches: Number(rs[6][0]?.ActiveCoaches || 0),
    activeStaff: Number(rs[7][0]?.ActiveStaff || 0),
    activeCombos: Number(rs[8][0]?.ActiveCombos || 0),
    dailyRevenueTrend: rs[9].map((row) => ({
      date: row.DateStr,
      revenue: Number(row.Revenue),
      bookingsCount: Number(row.BookingsCount),
    })),
    hourlyBookingTrend: rs[10].map((row) => ({
      hour: Number(row.HourOfDay),
      bookingsCount: Number(row.BookingsCount),
    })),
    bookingStatusBreakdown: rs[11].map((row) => ({
      status: row.Status,
      count: Number(row.Count),
    })),
    topCourts: rs[12].map((row) => ({
      courtId: Number(row.CourtID),
      courtName: row.CourtName,
      bookingsCount: Number(row.BookingsCount),
      totalRevenue: Number(row.TotalRevenue),
    })),
    topCoaches: rs[13].map((row) => ({
      coachId: Number(row.CoachID),
      coachName: row.CoachName,
      bookingsCount: Number(row.BookingsCount),
      totalRevenue: Number(row.TotalRevenue),
    })),
    topCombos: rs[14].map((row) => ({
      promotionId: Number(row.PromotionID),
      promotionCode: row.PromotionCode,
      promotionName: row.PromotionName,
      usageCount: Number(row.UsageCount),
    })),
    paymentMethodAnalytics: rs[15].map((row) => ({
      paymentMethod: row.PaymentMethod,
      count: Number(row.Count),
      totalAmount: Number(row.TotalAmount),
    })),
    newUsersCount: Number(rs[16][0]?.NewUsersCount || 0),
    activeUsersCount: Number(rs[17][0]?.ActiveUsersCount || 0),
    returningUsersCount: Number(rs[18][0]?.ReturningUsersCount || 0),
    recentActivities: rs[19].map((row) => ({
      activityType: row.ActivityType,
      createdAt: row.CreatedAt ? row.CreatedAt.toISOString() : null,
      actorName: row.ActorName,
      eventCode: row.EventCode,
      description: row.Description,
      amountValue: row.AmountValue ? Number(row.AmountValue) : null,
    })),
  };
}
