import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function run() {
  const pool = await getPool();
  try {
    // 1. Check courts
    const courtsRes = await pool.request().query("SELECT CourtID, CourtName, Status FROM Courts");
    console.log("🏫 Courts in database:");
    console.table(courtsRes.recordset);

    // 2. Check blocks in TournamentCourtBlocks
    const blocksRes = await pool.request().query(`
      SELECT b.BlockID, b.CourtID, c.CourtName, 
             b.StartDateTime, b.EndDateTime, b.Status, b.Reason
      FROM TournamentCourtBlocks b
      INNER JOIN Courts c ON b.CourtID = c.CourtID
      ORDER BY b.StartDateTime ASC
    `);
    console.log("🔒 Active Court Blocks:");
    console.table(blocksRes.recordset);

    // 3. Check matches scheduled for Sunrise Court (ID 2 or whichever matches)
    const matchesRes = await pool.request().query(`
      SELECT m.MatchID, m.CourtID, c.CourtName, m.ScheduledStart, m.ScheduledEnd, m.MatchStatus
      FROM TournamentMatches m
      LEFT JOIN Courts c ON m.CourtID = c.CourtID
      WHERE m.ScheduledStart IS NOT NULL
      ORDER BY m.ScheduledStart ASC
    `);
    console.log("📅 Scheduled Tournament Matches:");
    console.table(matchesRes.recordset.slice(0, 10)); // preview first 10

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
