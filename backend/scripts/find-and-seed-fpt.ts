import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";
import bcrypt from "bcryptjs";

const HASHED_PASS = bcrypt.hashSync("Password123!", 10);

async function run() {
  console.log("🌱 Starting seed script for FPT Youth Tournament...");
  const pool = await getPool();

  try {
    // 1. Find FPT Tournament
    const tRes = await pool.request().query(
      "SELECT TournamentID, TournamentName, Status FROM Tournaments WHERE TournamentName LIKE '%FPT%' AND IsDeleted = 0"
    );

    if (tRes.recordset.length === 0) {
      console.log("❌ No tournament containing 'FPT' was found in the database.");
      process.exit(1);
    }

    const tournament = tRes.recordset[0];
    const tId = tournament.TournamentID;
    console.log(`🔍 Found Tournament: [ID: ${tId}] "${tournament.TournamentName}" (Status: ${tournament.Status})`);

    // 2. Find Divisions
    const dRes = await pool.request().input("TournamentID", sql.Int, tId).query(
      "SELECT DivisionID, DivisionName, TeamSize, MaxTeams, Status, CompetitionFormat FROM TournamentDivisions WHERE TournamentID = @TournamentID"
    );

    if (dRes.recordset.length === 0) {
      console.log(`❌ No divisions found for Tournament ID: ${tId}`);
      process.exit(1);
    }

    const division = dRes.recordset[0];
    const divId = division.DivisionID;
    const teamSize = division.TeamSize || 2;
    console.log(`🔍 Selected Division: [ID: ${divId}] "${division.DivisionName}" (TeamSize: ${teamSize}, MaxTeams: ${division.MaxTeams}, Status: ${division.Status})`);

    // 3. Set MaxTeams = 32 and status = 'Open' to ensure 31 slots can be occupied leaving exactly 1 slot
    console.log("⚙️ Setting MaxTeams = 32 and Status = 'Open' for this division...");
    await pool.request()
      .input("DivisionID", sql.Int, divId)
      .query("UPDATE TournamentDivisions SET MaxTeams = 32, Status = 'Open' WHERE DivisionID = @DivisionID");

    // Also make sure Tournament is Open/Closed to allow active registration state
    if (tournament.Status === "Draft" || tournament.Status === "Cancelled") {
      console.log("⚙️ Setting Tournament Status = 'Open' to allow active registrations...");
      await pool.request()
        .input("TournamentID", sql.Int, tId)
        .query("UPDATE Tournaments SET Status = 'Open' WHERE TournamentID = @TournamentID");
    }

    // 4. Count existing confirmed teams
    const countRes = await pool.request()
      .input("DivisionID", sql.Int, divId)
      .query("SELECT COUNT(*) AS count FROM TournamentRegistrations WHERE DivisionID = @DivisionID AND RegistrationStatus = 'Confirmed'");
    const existingCount = countRes.recordset[0].count;
    console.log(`📊 Currently has ${existingCount} confirmed teams in this division.`);

    const targetCount = 31;
    const teamsToAdd = targetCount - existingCount;

    if (teamsToAdd <= 0) {
      console.log(`... Division already has ${existingCount} confirmed teams (target was ${targetCount}). No seeding needed!`);
      process.exit(0);
    }

    console.log(`🚀 Seeding ${teamsToAdd} teams to reach exactly ${targetCount} confirmed teams...`);

    // Helper function to create or get player
    const getOrCreatePlayer = async (email: string, fullName: string) => {
      const res = await pool.request().input("Email", sql.NVarChar, email).query(`SELECT UserID FROM Users WHERE Email = @Email`);
      if (res.recordset.length > 0) {
        return res.recordset[0].UserID;
      }

      const phone = "09" + Math.floor(10000000 + Math.random() * 90000000).toString();
      const insert = await pool.request()
        .input("Email", sql.NVarChar, email)
        .input("PasswordHash", sql.NVarChar, HASHED_PASS)
        .input("FullName", sql.NVarChar, fullName)
        .input("PhoneNumber", sql.NVarChar, phone)
        .query(`
          INSERT INTO Users (Email, PasswordHash, FullName, PhoneNumber, Gender, DateOfBirth)
          OUTPUT INSERTED.UserID
          VALUES (@Email, @PasswordHash, @FullName, @PhoneNumber, 'Male', '2010-01-01')
        `);
      const userId = insert.recordset[0].UserID;

      // Assign Player role
      await pool.request().query(`
        INSERT INTO UserRoles (UserID, RoleID) 
        SELECT ${userId}, RoleID FROM Roles WHERE RoleName = 'Player'
      `);

      return userId;
    };

    // 5. Seed teams
    for (let i = 1; i <= teamsToAdd; i++) {
      const teamNumber = existingCount + i;
      const teamName = `FPT Youth Star ${teamNumber}`;
      const teamCode = `FPTY_${divId}_T${teamNumber}`;

      // Create players
      const playerIds: number[] = [];
      const athleteNames: string[] = [];
      for (let j = 1; j <= teamSize; j++) {
        const email = `fpt.player.d${divId}.t${teamNumber}.p${j}@test.com`;
        const name = `VĐV FPT ${teamNumber}.${j}`;
        const userId = await getOrCreatePlayer(email, name);
        playerIds.push(userId);
        athleteNames.push(name);
      }

      const leaderId = playerIds[0];

      // Create Team
      const tRes = await pool.request()
        .input("TournamentID", sql.Int, tId)
        .input("DivisionID", sql.Int, divId)
        .input("TeamName", sql.NVarChar, teamName)
        .input("TeamCode", sql.NVarChar, teamCode)
        .input("CreatedBy", sql.Int, leaderId)
        .query(`
          INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, TeamCode, CreatedBy, TeamStatus)
          OUTPUT INSERTED.TeamID
          VALUES (@TournamentID, @DivisionID, @TeamName, @TeamCode, @CreatedBy, 'Registered')
        `);
      const teamId = tRes.recordset[0].TeamID;

      // Add Team Members
      for (let j = 0; j < playerIds.length; j++) {
        const pid = playerIds[j];
        const role = j === 0 ? "Leader" : "Member";
        await pool.request()
          .input("TournamentID", sql.Int, tId)
          .input("DivisionID", sql.Int, divId)
          .input("TeamID", sql.Int, teamId)
          .input("UserID", sql.Int, pid)
          .input("MemberRole", sql.NVarChar, role)
          .query(`
            INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus)
            VALUES (@TournamentID, @DivisionID, @TeamID, @UserID, @MemberRole, 'Accepted')
          `);
      }

      // Create Registration
      const regRes = await pool.request()
        .input("TournamentID", sql.Int, tId)
        .input("DivisionID", sql.Int, divId)
        .input("TeamID", sql.Int, teamId)
        .input("RegisteredBy", sql.Int, leaderId)
        .query(`
          INSERT INTO TournamentRegistrations (TournamentID, DivisionID, TeamID, RegisteredBy, RegistrationStatus, PaymentStatus, ConfirmedAt)
          OUTPUT INSERTED.RegistrationID
          VALUES (@TournamentID, @DivisionID, @TeamID, @RegisteredBy, 'Confirmed', 'Paid', GETDATE())
        `);
      const regId = regRes.recordset[0].RegistrationID;

      // Add Registration Athletes snap-shots
      for (let j = 0; j < playerIds.length; j++) {
        const pid = playerIds[j];
        const athleteNo = j + 1;
        const name = athleteNames[j];
        const rating = (Math.random() * (4.2 - 3.2) + 3.2).toFixed(2); // Random DUPR from 3.2 to 4.2
        const phone = "09" + Math.floor(10000000 + Math.random() * 90000000).toString();

        await pool.request()
          .input("RegistrationID", sql.Int, regId)
          .input("TournamentID", sql.Int, tId)
          .input("DivisionID", sql.Int, divId)
          .input("TeamID", sql.Int, teamId)
          .input("UserID", sql.Int, pid)
          .input("AthleteNo", sql.Int, athleteNo)
          .input("FullName", sql.NVarChar, name)
          .input("PhoneNumber", sql.NVarChar, phone)
          .input("Rating", sql.Decimal(4, 2), rating)
          .query(`
            INSERT INTO TournamentRegistrationAthletes (RegistrationID, TournamentID, DivisionID, TeamID, UserID, AthleteNo, FullName, PhoneNumber, Rating, Province, Gender, DateOfBirth)
            VALUES (@RegistrationID, @TournamentID, @DivisionID, @TeamID, @UserID, @AthleteNo, @FullName, @PhoneNumber, @Rating, N'Hà Nội', 'Male', '2010-01-01')
          `);
      }
    }

    console.log(`✅ Success! Seeded ${teamsToAdd} teams. Total confirmed teams in division is now ${targetCount}.`);
    console.log("You have 1 empty slot remaining out of 32 for testing.");
  } catch (err) {
    console.error("❌ Error running seed:", err);
  } finally {
    process.exit(0);
  }
}

run();
