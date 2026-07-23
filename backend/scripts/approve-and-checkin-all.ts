import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";

async function run() {
  const pool = await getPool();
  try {
    // Check registrations in tournament 2206
    const countRes = await pool.request()
      .input("TournamentID", sql.Int, 2206)
      .query("SELECT COUNT(*) AS count FROM TournamentRegistrations WHERE TournamentID = @TournamentID");

    const totalCount = countRes.recordset[0].count;
    console.log(`📋 Found ${totalCount} registrations in FPT tournament (ID 2206).`);

    if (totalCount === 0) {
      console.log("❌ No registrations found to update.");
      process.exit(1);
    }

    // Update registrations
    const updateRes = await pool.request()
      .input("TournamentID", sql.Int, 2206)
      .query(`
        UPDATE TournamentRegistrations
        SET 
          RegistrationStatus = 'Confirmed',
          PaymentStatus = 'Paid',
          IsCheckedIn = 1,
          ConfirmedAt = GETDATE()
        WHERE TournamentID = @TournamentID
      `);

    console.log(`✅ Success! Updated ${updateRes.rowsAffected[0]} registrations to 'Confirmed', 'Paid' (PaymentStatus), and Checked-in (IsCheckedIn = 1).`);

    // Let's also verify registration details
    const selectRes = await pool.request()
      .input("TournamentID", sql.Int, 2206)
      .query(`
        SELECT r.RegistrationID, r.RegistrationStatus, r.PaymentStatus, r.IsCheckedIn, t.TeamName
        FROM TournamentRegistrations r
        INNER JOIN TournamentTeams t ON r.TeamID = t.TeamID
        WHERE r.TournamentID = @TournamentID
      `);
    console.log("📊 Updated Registrations List Preview (First 5):");
    console.table(selectRes.recordset.slice(0, 5));

  } catch (err) {
    console.error("❌ Error running script:", err);
  } finally {
    process.exit(0);
  }
}

run();
