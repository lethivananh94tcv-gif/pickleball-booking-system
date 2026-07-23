import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";
import * as tournamentService from "../src/modules/tournaments/tournaments.service";

async function run() {
  const pool = await getPool();
  try {
    console.log("Searching for registration matching athlete 'van anh le' (User ID: 36)...");
    
    // Find registrations associated with User ID 36
    const regRes = await pool.request()
      .input("UserID", sql.Int, 36)
      .query(`
        SELECT DISTINCT r.RegistrationID, r.RegistrationStatus, t.TeamName, r.DivisionID, d.DivisionName
        FROM TournamentRegistrations r
        INNER JOIN TournamentTeams t ON r.TeamID = t.TeamID
        INNER JOIN TournamentTeamMembers tm ON t.TeamID = tm.TeamID
        INNER JOIN TournamentDivisions d ON r.DivisionID = d.DivisionID
        WHERE tm.UserID = @UserID AND tm.JoinStatus = 'Accepted'
      `);

    if (regRes.recordset.length === 0) {
      console.log("❌ No registrations found for 'van anh le'.");
      process.exit(1);
    }

    console.log("Found registrations:");
    console.table(regRes.recordset);

    const reg = regRes.recordset[0];
    const registrationId = reg.RegistrationID;

    // Ensure status is Confirmed for testing
    if (reg.RegistrationStatus !== "Confirmed") {
      console.log(`🔄 Updating registration status from '${reg.RegistrationStatus}' to 'Confirmed' to make it eligible...`);
      await pool.request()
        .input("RegID", sql.Int, registrationId)
        .query("UPDATE TournamentRegistrations SET RegistrationStatus = 'Confirmed' WHERE RegistrationID = @RegID");
    }

    // Set a mock PDF URL to test PDF attachment integration
    const mockPdfUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    console.log(`🔄 Setting mock PDF URL: ${mockPdfUrl} ...`);
    await pool.request()
      .input("RegID", sql.Int, registrationId)
      .input("PdfUrl", sql.NVarChar, mockPdfUrl)
      .query("UPDATE TournamentRegistrations SET CertificatePdfUrl = @PdfUrl WHERE RegistrationID = @RegID");

    console.log(`🚀 Executing sendCertificateEmail service for Registration ID: ${registrationId} with rank override '1' (Champion)...`);
    
    // Call the service method (using a mock admin userId = 1)
    const result = await tournamentService.sendCertificateEmail(registrationId, "1", 1);
    
    console.log("🎉 Service result:", result);

    // Verify DB update
    const verifyRes = await pool.request()
      .input("RegID", sql.Int, registrationId)
      .query("SELECT IsCertificateSent, CertificateSentAt, CertificatePdfUrl FROM TournamentRegistrations WHERE RegistrationID = @RegID");
    
    console.log("📊 Updated database record:");
    console.table(verifyRes.recordset);

    console.log("✅ Flow test finished successfully!");
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    process.exit(0);
  }
}

run();
