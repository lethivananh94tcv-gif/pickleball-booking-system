import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function run() {
  const pool = await getPool();
  try {
    const res = await pool.request().query(
      "SELECT COUNT(*) AS count FROM TournamentMatches WHERE DivisionID = 2278"
    );
    console.log(`Matches in division 2278: ${res.recordset[0].count}`);

    const divRes = await pool.request().query(
      "SELECT RoundScheduleConfig FROM TournamentDivisions WHERE DivisionID = 2278"
    );
    console.log("RoundScheduleConfig:", divRes.recordset[0]?.RoundScheduleConfig);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
