import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";

async function run() {
  const pool = await getPool();
  try {
    const teamsRes = await pool.request()
      .input("DivisionID", sql.Int, 2278)
      .query("SELECT TeamID, TeamName FROM TournamentTeams WHERE DivisionID = @DivisionID");
    
    console.log("List of teams in division 2278:");
    console.table(teamsRes.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
