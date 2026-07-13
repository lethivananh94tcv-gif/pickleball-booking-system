import { getPool, sql } from "@/database/connection";

export type RevenueServiceType =
  | "Court"
  | "Coach"
  | "Combo";

export interface RevenueQuery {
  fromDate?: string;
  toDate?: string;
  serviceType?: RevenueServiceType;
}

export interface RevenueResponse {
  summary: {
    totalRevenue: number;
    todayRevenue: number;
    monthRevenue: number;
    paidBookings: number;
    refundAmount: number;
  };
  chart: Array<{
    date: string;
    revenue: number;
  }>;
  serviceRevenue: Array<{
    serviceName: string;
    revenue: number;
  }>;
  transactions: Array<{
    id: string;
    customerName: string;
    serviceType: RevenueServiceType;
    amount: number;
    paymentMethod: string;
    status: "Paid" | "Refunded" | "Pending" | "Failed";
    createdAt: string;
  }>;
}

const VALID_SERVICE_TYPES = [
  "Court",
  "Coach",
  "Combo",
] as const;

function isDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseRevenueQuery(
  searchParams: URLSearchParams
): RevenueQuery {
  const fromDate =
    searchParams.get("fromDate") ||
    searchParams.get("startDate") ||
    undefined;

  const toDate =
    searchParams.get("toDate") ||
    searchParams.get("endDate") ||
    undefined;

  const rawServiceType =
    searchParams.get("serviceType") ||
    undefined;

  if (
    fromDate &&
    !isDateString(fromDate)
  ) {
    throw new Error("fromDate phải có dạng YYYY-MM-DD");
  }

  if (
    toDate &&
    !isDateString(toDate)
  ) {
    throw new Error("toDate phải có dạng YYYY-MM-DD");
  }

  if (
    fromDate &&
    toDate &&
    fromDate > toDate
  ) {
    throw new Error("fromDate không được lớn hơn toDate");
  }

  if (
    rawServiceType &&
    !VALID_SERVICE_TYPES.includes(
      rawServiceType as RevenueServiceType
    )
  ) {
    throw new Error("Loại dịch vụ không hợp lệ");
  }

  return {
    fromDate,
    toDate,
    serviceType:
      rawServiceType as
        | RevenueServiceType
        | undefined,
  };
}

function applyRevenueFilters(
  request: sql.Request,
  query: RevenueQuery
) {
  request
    .input(
      "FromDate",
      sql.Date,
      query.fromDate ?? null
    )
    .input(
      "ToDate",
      sql.Date,
      query.toDate ?? null
    )
    .input(
      "ServiceType",
      sql.NVarChar(30),
      query.serviceType ?? null
    );

  const conditions = [
    "1 = 1",
  ];

  if (query.fromDate) {
    conditions.push(
      "CAST(p.CreatedAt AS DATE) >= @FromDate"
    );
  }

  if (query.toDate) {
    conditions.push(
      "CAST(p.CreatedAt AS DATE) <= @ToDate"
    );
  }

  if (query.serviceType) {
    conditions.push(
      "p.ServiceType = @ServiceType"
    );
  }

  return conditions.join(
    "\n        AND "
  );
}

export async function getAdminRevenue(
  query: RevenueQuery
): Promise<RevenueResponse> {
  const pool =
    await getPool();

  const request =
    pool.request();

  const filters =
    applyRevenueFilters(
      request,
      query
    );

  const result =
    await request.query(`
      WITH UnifiedPayments AS (
        SELECT 
          p.PaymentID AS ID,
          COALESCE(u.FullName, b.GuestName, 'Khách vãng lai') AS CustomerName,
          b.BookingType AS ServiceType,
          p.Amount,
          p.PaymentMethod,
          p.Status,
          COALESCE(p.PaidAt, p.CreatedAt) AS CreatedAt
        FROM Payments p
        INNER JOIN Bookings b ON p.BookingID = b.BookingID
        LEFT JOIN Users u ON b.UserID = u.UserID
        
        UNION ALL
        
        SELECT
          tp.TournamentPaymentID AS ID,
          u.FullName AS CustomerName,
          'Tournament' AS ServiceType,
          tp.Amount,
          tp.PaymentMethod,
          CASE WHEN tp.PaymentStatus = 'Paid' THEN 'Paid' WHEN tp.PaymentStatus = 'Refunded' OR tp.PaymentStatus = 'Cancelled' THEN 'Refunded' ELSE 'Failed' END AS Status,
          COALESCE(tp.PaidAt, tp.CreatedAt) AS CreatedAt
        FROM TournamentPayments tp
        INNER JOIN TournamentRegistrations tr ON tp.RegistrationID = tr.RegistrationID
        INNER JOIN Users u ON tr.RegisteredBy = u.UserID
      )
      SELECT
        ISNULL(
          SUM(
            CASE
              WHEN p.Status = 'Paid'
                THEN p.Amount
              ELSE 0
            END
          ),
          0
        ) AS TotalRevenue,

        ISNULL(
          SUM(
            CASE
              WHEN p.Status = 'Paid'
                AND CAST(p.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                THEN p.Amount
              ELSE 0
            END
          ),
          0
        ) AS TodayRevenue,

        ISNULL(
          SUM(
            CASE
              WHEN p.Status = 'Paid'
                AND YEAR(p.CreatedAt) = YEAR(GETDATE())
                AND MONTH(p.CreatedAt) = MONTH(GETDATE())
                THEN p.Amount
              ELSE 0
            END
          ),
          0
        ) AS MonthRevenue,

        COUNT(
          DISTINCT CASE
            WHEN p.Status = 'Paid'
              THEN p.ID
          END
        ) AS PaidBookings,

        ISNULL(
          (
            SELECT SUM(r.RefundAmount)
            FROM Refunds r
            LEFT JOIN Bookings rb ON r.BookingID = rb.BookingID
            WHERE r.Status = 'Completed'
              AND (
                @FromDate IS NULL
                OR CAST(COALESCE(r.ProcessedAt, r.RequestedAt) AS DATE) >= @FromDate
              )
              AND (
                @ToDate IS NULL
                OR CAST(COALESCE(r.ProcessedAt, r.RequestedAt) AS DATE) <= @ToDate
              )
              AND (
                @ServiceType IS NULL
                OR (@ServiceType = 'Tournament' AND r.RegistrationID IS NOT NULL)
                OR (rb.BookingType = @ServiceType)
              )
          ),
          0
        ) AS RefundAmount

      FROM UnifiedPayments p
      WHERE
        ${filters};

      WITH UnifiedPayments AS (
        SELECT 
          p.Amount,
          p.Status,
          COALESCE(p.PaidAt, p.CreatedAt) AS CreatedAt,
          b.BookingType AS ServiceType
        FROM Payments p
        INNER JOIN Bookings b ON p.BookingID = b.BookingID
        
        UNION ALL
        
        SELECT
          tp.Amount,
          CASE WHEN tp.PaymentStatus = 'Paid' THEN 'Paid' ELSE 'Failed' END AS Status,
          COALESCE(tp.PaidAt, tp.CreatedAt) AS CreatedAt,
          'Tournament' AS ServiceType
        FROM TournamentPayments tp
      )
      SELECT
        CONVERT(
          VARCHAR(10),
          CAST(p.CreatedAt AS DATE),
          23
        ) AS RevenueDate,

        ISNULL(SUM(p.Amount), 0) AS Revenue

      FROM UnifiedPayments p
      WHERE
        ${filters}
        AND p.Status = 'Paid'
      GROUP BY
        CAST(p.CreatedAt AS DATE)
      ORDER BY
        RevenueDate ASC;

      WITH UnifiedPayments AS (
        SELECT 
          p.Amount,
          p.Status,
          COALESCE(p.PaidAt, p.CreatedAt) AS CreatedAt,
          b.BookingType AS ServiceType
        FROM Payments p
        INNER JOIN Bookings b ON p.BookingID = b.BookingID
        
        UNION ALL
        
        SELECT
          tp.Amount,
          CASE WHEN tp.PaymentStatus = 'Paid' THEN 'Paid' ELSE 'Failed' END AS Status,
          COALESCE(tp.PaidAt, tp.CreatedAt) AS CreatedAt,
          'Tournament' AS ServiceType
        FROM TournamentPayments tp
      )
      SELECT
        p.ServiceType AS BookingType,
        ISNULL(SUM(p.Amount), 0) AS Revenue
      FROM UnifiedPayments p
      WHERE
        ${filters}
        AND p.Status = 'Paid'
      GROUP BY
        p.ServiceType
      ORDER BY
        Revenue DESC;

      WITH UnifiedPayments AS (
        SELECT 
          p.PaymentID AS ID,
          COALESCE(u.FullName, b.GuestName, 'Khách vãng lai') AS CustomerName,
          b.BookingType AS ServiceType,
          p.Amount,
          p.PaymentMethod,
          p.Status,
          COALESCE(p.PaidAt, p.CreatedAt) AS CreatedAt
        FROM Payments p
        INNER JOIN Bookings b ON p.BookingID = b.BookingID
        LEFT JOIN Users u ON b.UserID = u.UserID
        
        UNION ALL
        
        SELECT
          tp.TournamentPaymentID AS ID,
          u.FullName AS CustomerName,
          'Tournament' AS ServiceType,
          tp.Amount,
          tp.PaymentMethod,
          CASE WHEN tp.PaymentStatus = 'Paid' THEN 'Paid' WHEN tp.PaymentStatus = 'Refunded' OR tp.PaymentStatus = 'Cancelled' THEN 'Refunded' ELSE 'Failed' END AS Status,
          COALESCE(tp.PaidAt, tp.CreatedAt) AS CreatedAt
        FROM TournamentPayments tp
        INNER JOIN TournamentRegistrations tr ON tp.RegistrationID = tr.RegistrationID
        INNER JOIN Users u ON tr.RegisteredBy = u.UserID
      )
      SELECT TOP 20
        p.ID AS PaymentID,
        p.CustomerName,
        p.ServiceType AS BookingType,
        p.Amount,
        p.PaymentMethod,
        p.Status,
        p.CreatedAt
      FROM UnifiedPayments p
      WHERE
        ${filters}
      ORDER BY
        p.CreatedAt DESC,
        p.ID DESC;
    `);

  const recordsets =
    result.recordsets as any[][];

  const summary =
    recordsets[0]?.[0] ?? {};

  return {
    summary: {
      totalRevenue:
        Number(summary.TotalRevenue ?? 0),
      todayRevenue:
        Number(summary.TodayRevenue ?? 0),
      monthRevenue:
        Number(summary.MonthRevenue ?? 0),
      paidBookings:
        Number(summary.PaidBookings ?? 0),
      refundAmount:
        Number(summary.RefundAmount ?? 0),
    },

    chart:
      recordsets[1]?.map((row) => ({
        date:
          row.RevenueDate ?? "",
        revenue:
          Number(row.Revenue ?? 0),
      })) ?? [],

    serviceRevenue:
      recordsets[2]?.map((row) => ({
        serviceName:
          row.BookingType ?? "",
        revenue:
          Number(row.Revenue ?? 0),
      })) ?? [],

    transactions:
      recordsets[3]?.map((row) => ({
        id:
          String(row.PaymentID),
        customerName:
          row.CustomerName ?? "Khách vãng lai",
        serviceType:
          row.BookingType,
        amount:
          Number(row.Amount ?? 0),
        paymentMethod:
          row.PaymentMethod ?? "",
        status:
          row.Status,
        createdAt:
          row.CreatedAt
            ? new Date(row.CreatedAt).toISOString()
            : "",
      })) ?? [],
  };
}
