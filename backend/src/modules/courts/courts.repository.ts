import { getPool, sql } from "@/database/connection";

export async function findAllCourts(includeInactive = false) {
  const pool = await getPool();

  let query = `
    SELECT
      CourtID,
      CourtCode,
      CourtName,
      CourtType,
      Location,
      Description,
      PricePerHour,
      CourtImage,
      Status,
      CONVERT(VARCHAR(5), OpenTime, 108) AS OpenTime,
      CONVERT(VARCHAR(5), CloseTime, 108) AS CloseTime,
      CreatedAt,
      UpdatedAt
    FROM Courts
  `;

  if (!includeInactive) {
    query += ` WHERE Status <> 'Inactive'`;
  }

  query += ` ORDER BY CourtID ASC`;

  const result = await pool.request().query(query);

  return result.recordset;
}

export async function findCourtById(courtId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("CourtID", sql.Int, courtId)
    .query(`
      SELECT
        CourtID,
        CourtCode,
        CourtName,
        CourtType,
        Location,
        Description,
        PricePerHour,
        CourtImage,
        Status,
        CONVERT(VARCHAR(5), OpenTime, 108) AS OpenTime,
        CONVERT(VARCHAR(5), CloseTime, 108) AS CloseTime,
        CreatedAt,
        UpdatedAt
      FROM Courts
      WHERE CourtID = @CourtID
    `);

  return result.recordset[0] ?? null;
}

export async function findAvailableCourts(
  bookingDate: string,
  startTime?: string,
  endTime?: string
) {
  const pool = await getPool();

  const request = pool.request();
  request.input("SlotDate", sql.Date, bookingDate);

  let query = `
      SELECT
        c.CourtID,
        c.CourtCode,
        c.CourtName,
        c.CourtType,
        c.Location,
        c.Description,
        c.PricePerHour,
        c.CourtImage,
        c.Status AS CourtStatus,

        cs.SlotID,
        cs.SlotDate,
        CONVERT(VARCHAR(5), cs.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), cs.EndTime, 108) AS EndTime,
        cs.Price,
        cs.Status AS SlotStatus

      FROM CourtSlots cs
      INNER JOIN Courts c ON cs.CourtID = c.CourtID
      WHERE cs.SlotDate = @SlotDate
        AND cs.Status = 'Available'
        AND c.Status = 'Available'
        AND NOT EXISTS (
          SELECT 1 FROM TournamentCourtBlocks b
          WHERE b.CourtID = c.CourtID
            AND b.Status = 'Active'
            AND DATEADD(hour, 7, b.StartDateTime) < CAST(CAST(cs.SlotDate AS VARCHAR(10)) + ' ' + CAST(cs.EndTime AS VARCHAR(8)) AS DATETIME)
            AND DATEADD(hour, 7, b.EndDateTime) > CAST(CAST(cs.SlotDate AS VARCHAR(10)) + ' ' + CAST(cs.StartTime AS VARCHAR(8)) AS DATETIME)
        )
  `;

  if (startTime && endTime) {
    request.input("StartTime", sql.VarChar(5), startTime);
    request.input("EndTime", sql.VarChar(5), endTime);
    query += `
        AND cs.StartTime >= CAST(@StartTime AS TIME)
        AND cs.EndTime <= CAST(@EndTime AS TIME)
    `;
  }

  query += ` ORDER BY c.CourtID ASC, cs.StartTime ASC`;

  const result = await request.query(query);

  return result.recordset;
}

export async function findCourtSlots(courtId: number, slotDate: string) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("CourtID", sql.Int, courtId)
    .input("SlotDate", sql.Date, slotDate)
    .query(`
      SELECT
        SlotID,
        CourtID,
        SlotDate,
        CONVERT(VARCHAR(5), StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), EndTime, 108) AS EndTime,
        Price,
        CASE 
          WHEN Status = 'Available' AND EXISTS (
            SELECT 1 FROM TournamentCourtBlocks b
            WHERE b.CourtID = CourtSlots.CourtID
              AND b.Status = 'Active'
              AND DATEADD(hour, 7, b.StartDateTime) < CAST(CAST(CourtSlots.SlotDate AS VARCHAR(10)) + ' ' + CAST(CourtSlots.EndTime AS VARCHAR(8)) AS DATETIME)
              AND DATEADD(hour, 7, b.EndDateTime) > CAST(CAST(CourtSlots.SlotDate AS VARCHAR(10)) + ' ' + CAST(CourtSlots.StartTime AS VARCHAR(8)) AS DATETIME)
          ) THEN 'Blocked'
          ELSE Status
        END AS Status,
        HoldUntil,
        CreatedAt,
        UpdatedAt
      FROM CourtSlots
      WHERE CourtID = @CourtID
        AND SlotDate = @SlotDate
        AND Status <> 'Cancelled'
      ORDER BY StartTime ASC
    `);

  return result.recordset;
}

export async function createCourtSlot(data: {
  courtId: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  price: number;
}) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("CourtID", sql.Int, data.courtId)
    .input("SlotDate", sql.Date, data.slotDate)
    .input("StartTime", sql.VarChar(5), data.startTime)
    .input("EndTime", sql.VarChar(5), data.endTime)
    .input("Price", sql.Decimal(18, 2), data.price)
    .query(`
      INSERT INTO CourtSlots (
        CourtID,
        SlotDate,
        StartTime,
        EndTime,
        Price,
        Status
      )
      OUTPUT
        INSERTED.SlotID,
        INSERTED.CourtID,
        INSERTED.SlotDate,
        CONVERT(VARCHAR(5), INSERTED.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), INSERTED.EndTime, 108) AS EndTime,
        INSERTED.Price,
        INSERTED.Status
      VALUES (
        @CourtID,
        @SlotDate,
        CAST(@StartTime AS TIME),
        CAST(@EndTime AS TIME),
        @Price,
        'Available'
      )
    `);

  return result.recordset[0];
}

export async function createCourt(data: {
  courtCode: string;
  courtName: string;
  courtType: string;
  location?: string;
  description?: string;
  pricePerHour: number;
  courtImage?: string;
  status?: string;
  openTime: string;
  closeTime: string;
}) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("CourtCode", sql.NVarChar(50), data.courtCode)
    .input("CourtName", sql.NVarChar(100), data.courtName)
    .input("CourtType", sql.NVarChar(50), data.courtType)
    .input("Location", sql.NVarChar(255), data.location || null)
    .input("Description", sql.NVarChar(500), data.description || null)
    .input("PricePerHour", sql.Decimal(18, 2), data.pricePerHour)
    .input("CourtImage", sql.NVarChar(255), data.courtImage || null)
    .input("Status", sql.NVarChar(30), data.status || "Available")
    .input("OpenTime", sql.VarChar(5), data.openTime)
    .input("CloseTime", sql.VarChar(5), data.closeTime)
    .query(`
      INSERT INTO Courts (
        CourtCode, CourtName, CourtType, Location, Description,
        PricePerHour, CourtImage, Status, OpenTime, CloseTime, CreatedAt
      )
      OUTPUT
        INSERTED.CourtID, INSERTED.CourtCode, INSERTED.CourtName, INSERTED.CourtType,
        INSERTED.Location, INSERTED.Description, INSERTED.PricePerHour, INSERTED.CourtImage,
        INSERTED.Status, CONVERT(VARCHAR(5), INSERTED.OpenTime, 108) AS OpenTime,
        CONVERT(VARCHAR(5), INSERTED.CloseTime, 108) AS CloseTime, INSERTED.CreatedAt
      VALUES (
        @CourtCode, @CourtName, @CourtType, @Location, @Description,
        @PricePerHour, @CourtImage, @Status, CAST(@OpenTime AS TIME), CAST(@CloseTime AS TIME), GETDATE()
      )
    `);
  return result.recordset[0];
}

export async function updateCourt(
  courtId: number,
  data: {
    courtCode: string;
    courtName: string;
    courtType: string;
    location?: string;
    description?: string;
    pricePerHour: number;
    courtImage?: string;
    status?: string;
    openTime: string;
    closeTime: string;
  }
) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("CourtID", sql.Int, courtId)
    .input("CourtCode", sql.NVarChar(50), data.courtCode)
    .input("CourtName", sql.NVarChar(100), data.courtName)
    .input("CourtType", sql.NVarChar(50), data.courtType)
    .input("Location", sql.NVarChar(255), data.location || null)
    .input("Description", sql.NVarChar(500), data.description || null)
    .input("PricePerHour", sql.Decimal(18, 2), data.pricePerHour)
    .input("CourtImage", sql.NVarChar(255), data.courtImage || null)
    .input("Status", sql.NVarChar(30), data.status || "Available")
    .input("OpenTime", sql.VarChar(5), data.openTime)
    .input("CloseTime", sql.VarChar(5), data.closeTime)
    .query(`
      UPDATE Courts
      SET CourtCode = @CourtCode,
          CourtName = @CourtName,
          CourtType = @CourtType,
          Location = @Location,
          Description = @Description,
          PricePerHour = @PricePerHour,
          CourtImage = @CourtImage,
          Status = @Status,
          OpenTime = CAST(@OpenTime AS TIME),
          CloseTime = CAST(@CloseTime AS TIME),
          UpdatedAt = GETDATE()
      OUTPUT
        INSERTED.CourtID, INSERTED.CourtCode, INSERTED.CourtName, INSERTED.CourtType,
        INSERTED.Location, INSERTED.Description, INSERTED.PricePerHour, INSERTED.CourtImage,
        INSERTED.Status, CONVERT(VARCHAR(5), INSERTED.OpenTime, 108) AS OpenTime,
        CONVERT(VARCHAR(5), INSERTED.CloseTime, 108) AS CloseTime, INSERTED.UpdatedAt
      WHERE CourtID = @CourtID
    `);
  return result.recordset[0] ?? null;
}

export async function softDeleteCourt(courtId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("CourtID", sql.Int, courtId)
    .query(`
      UPDATE Courts
      SET Status = 'Inactive',
          UpdatedAt = GETDATE()
      OUTPUT
        INSERTED.CourtID,
        INSERTED.CourtCode,
        INSERTED.CourtName,
        INSERTED.Status
      WHERE CourtID = @CourtID
        AND (Status IS NULL OR Status <> 'Inactive')
    `);
  return result.recordset[0] ?? null;
}

export async function findCourtSlotById(slotId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("SlotID", sql.Int, slotId)
    .query(`
      SELECT
        SlotID, CourtID, SlotDate,
        CONVERT(VARCHAR(5), StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), EndTime, 108) AS EndTime,
        Price, Status, CreatedAt, UpdatedAt
      FROM CourtSlots
      WHERE SlotID = @SlotID
    `);
  return result.recordset[0] ?? null;
}

export async function updateCourtSlotStatus(slotId: number, status: string) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("SlotID", sql.Int, slotId)
    .input("Status", sql.NVarChar(30), status)
    .query(`
      UPDATE CourtSlots
      SET Status = @Status,
          UpdatedAt = GETDATE()
      OUTPUT
        INSERTED.SlotID,
        INSERTED.CourtID,
        INSERTED.SlotDate,
        CONVERT(VARCHAR(5), INSERTED.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), INSERTED.EndTime, 108) AS EndTime,
        INSERTED.Price,
        INSERTED.Status
      WHERE SlotID = @SlotID
    `);
  return result.recordset[0] ?? null;
}

export async function updateCourtSlotPrice(slotId: number, price: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("SlotID", sql.Int, slotId)
    .input("Price", sql.Decimal(18, 2), price)
    .query(`
      UPDATE CourtSlots
      SET Price = @Price,
          UpdatedAt = GETDATE()
      OUTPUT
        INSERTED.SlotID,
        INSERTED.CourtID,
        INSERTED.SlotDate,
        CONVERT(VARCHAR(5), INSERTED.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), INSERTED.EndTime, 108) AS EndTime,
        INSERTED.Price,
        INSERTED.Status
      WHERE SlotID = @SlotID
    `);
  return result.recordset[0] ?? null;
}

/**
 * @deprecated Không dùng trực tiếp — sử dụng softDeleteCourtSlot để tránh lỗi foreign key
 */
export async function deleteCourtSlot(slotId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("SlotID", sql.Int, slotId)
    .query(`
      DELETE FROM CourtSlots
      WHERE SlotID = @SlotID
    `);
  return result.rowsAffected[0] > 0;
}

/**
 * Soft Delete slot: đổi Status → 'Cancelled' thay vì xóa cứng.
 * Tuân thủ quy định: KHÔNG dùng lệnh DELETE để tránh lỗi khóa ngoại.
 */
export async function softDeleteCourtSlot(slotId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("SlotID", sql.Int, slotId)
    .query(`
      UPDATE CourtSlots
      SET Status    = 'Cancelled',
          UpdatedAt = GETDATE()
      OUTPUT
        INSERTED.SlotID,
        INSERTED.CourtID,
        INSERTED.SlotDate,
        CONVERT(VARCHAR(5), INSERTED.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), INSERTED.EndTime,   108) AS EndTime,
        INSERTED.Price,
        INSERTED.Status
      WHERE SlotID = @SlotID
        AND (Status IS NULL OR Status NOT IN ('Booked', 'Holding'))
    `);
  return result.recordset[0] ?? null;
}

/**
 * Lấy danh sách StartTime (HH:mm) của các slot chưa bị Cancelled trong ngày,
 * dùng để kiểm tra trùng giờ trước khi sinh slot hàng loạt.
 */
export async function findExistingSlotStartTimes(
  courtId: number,
  slotDate: string
): Promise<string[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("CourtID", sql.Int, courtId)
    .input("SlotDate", sql.Date, slotDate)
    .query(`
      SELECT CONVERT(VARCHAR(5), StartTime, 108) AS StartTime
      FROM CourtSlots
      WHERE CourtID = @CourtID
        AND SlotDate = @SlotDate
        AND Status <> 'Cancelled'
    `);
  return result.recordset.map((r: { StartTime: string }) => r.StartTime);
}

/**
 * Tạo nhiều slot cùng lúc (bulk insert).
 * Mỗi slot được insert tuần tự để tránh lỗi transaction phức tạp.
 * Trả về số slot đã tạo thành công.
 */
export async function createCourtSlotsMany(
  slots: {
    courtId: number;
    slotDate: string;
    startTime: string;
    endTime: string;
    price: number;
  }[]
): Promise<number> {
  if (slots.length === 0) return 0;
  const pool = await getPool();
  let created = 0;
  for (const slot of slots) {
    try {
      await pool
        .request()
        .input("CourtID",  sql.Int,            slot.courtId)
        .input("SlotDate", sql.Date,            slot.slotDate)
        .input("StartTime",sql.VarChar(5),      slot.startTime)
        .input("EndTime",  sql.VarChar(5),      slot.endTime)
        .input("Price",    sql.Decimal(18, 2),  slot.price)
        .query(`
          INSERT INTO CourtSlots (CourtID, SlotDate, StartTime, EndTime, Price, Status)
          VALUES (
            @CourtID,
            @SlotDate,
            CAST(@StartTime AS TIME),
            CAST(@EndTime   AS TIME),
            @Price,
            'Available'
          )
        `);
      created++;
    } catch {
      // Bỏ qua slot bị trùng hoặc lỗi, tiếp tục với slot kế tiếp
    }
  }
  return created;
}
