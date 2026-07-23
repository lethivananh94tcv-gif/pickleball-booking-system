import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";

async function run() {
  const pool = await getPool();
  try {
    // Find User
    const userRes = await pool.request()
      .input("Name", sql.NVarChar, "%van anh le%")
      .query("SELECT UserID, FullName, Email FROM Users WHERE FullName LIKE @Name");

    if (userRes.recordset.length === 0) {
      console.log("❌ No user matching 'van anh le' was found.");
      process.exit(1);
    }

    const user = userRes.recordset[0];
    const uid = user.UserID;
    console.log(`🔍 Found User: [ID: ${uid}] "${user.FullName}" (${user.Email})`);

    // Check Player Profile
    const profileRes = await pool.request()
      .input("UserID", sql.Int, uid)
      .query("SELECT * FROM PlayerProfiles WHERE UserID = @UserID");

    if (profileRes.recordset.length === 0) {
      console.log("⚠️ Player profile does not exist. Creating one with Rating 3.8...");
      await pool.request()
        .input("UserID", sql.Int, uid)
        .query(`
          INSERT INTO PlayerProfiles (UserID, PlayingRole, ExperienceYears, SkillLevel, PlayStyle, Goal, Rating, MatchingStatus, AvailableStartTime, AvailableEndTime)
          VALUES (@UserID, 'All-rounder', 2, 'Intermediate', 'Control', 'Ranking', 3.8, 'Available', '08:00:00', '22:00:00')
        `);
    } else {
      console.log(`📊 Current DUPR Rating in DB: ${profileRes.recordset[0].Rating}`);
      console.log("🔄 Updating DUPR Rating to 3.8...");
      await pool.request()
        .input("UserID", sql.Int, uid)
        .query("UPDATE PlayerProfiles SET Rating = 3.8 WHERE UserID = @UserID");
    }

    console.log("✅ Success! Updated van anh le's DUPR rating to 3.8 in the database.");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
