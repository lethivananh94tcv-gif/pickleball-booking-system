import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";

async function run() {
  const pool = await getPool();
  try {
    const slotsRes = await pool.request()
      .input("CourtID", sql.Int, 1) // Sunrise Court
      .input("SlotDate", sql.Date, "2026-07-24")
      .query(`
        SELECT SlotID, CourtID, SlotDate, 
               CONVERT(VARCHAR(5), StartTime, 108) AS StartTime,
               CONVERT(VARCHAR(5), EndTime, 108) AS EndTime,
               Status
        FROM CourtSlots
        WHERE CourtID = @CourtID AND SlotDate = @SlotDate
        ORDER BY StartTime ASC
      `);

    console.log("📅 CourtSlots on July 24th, 2026 for Sunrise Court (ID 1):");
    console.table(slotsRes.recordset);

    const blockRes = await pool.request()
      .input("CourtID", sql.Int, 1)
      .input("Date", sql.VarChar(10), "2026-07-24")
      .query(`
        SELECT * FROM TournamentCourtBlocks 
        WHERE CourtID = @CourtID 
          AND StartDateTime >= @Date + ' 00:00:00' 
          AND EndDateTime <= @Date + ' 23:59:59'
      `);
    console.log("🔒 Tournament Blocks on July 24th, 2026 for Sunrise Court (ID 1):");
    console.table(blockRes.recordset);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
