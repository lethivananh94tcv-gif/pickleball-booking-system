import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function checkTournaments() {
  const pool = await getPool();
  try {
    // 1. Query columns
    const columnsRes = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tournaments'
    `);
    console.log("Columns of Tournaments table:");
    console.log(columnsRes.recordset);

    // 2. Query tournament records
    const recordsRes = await pool.request().query(`
      SELECT TOP 5 TournamentID, TournamentName, Status, IsHidden FROM Tournaments
    `);
    console.log("\nSome tournament records:");
    console.log(recordsRes.recordset);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    process.exit(0);
  }
}

checkTournaments();
