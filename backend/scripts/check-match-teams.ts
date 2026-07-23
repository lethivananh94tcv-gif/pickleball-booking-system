import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function run() {
  const pool = await getPool();
  try {
    const res = await pool.request()
      .query(`
        SELECT m.MatchID, m.TeamAID, m.TeamBID, 
               tA.TeamName AS TeamAName, tB.TeamName AS TeamBName, m.MatchStatus
        FROM TournamentMatches m
        LEFT JOIN TournamentTeams tA ON m.TeamAID = tA.TeamID
        LEFT JOIN TournamentTeams tB ON m.TeamBID = tB.TeamID
        WHERE m.MatchID IN (3876, 3868, 3875)
      `);
    console.log("Matches data:");
    console.table(res.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
