import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";
import { reportMatchScore } from "../src/modules/tournaments/tournaments.service";

async function run() {
  const pool = await getPool();
  try {
    // 1. Find the target team for van anh
    const teamRes = await pool.request()
      .input("Name", sql.NVarChar, "%van anh%")
      .query("SELECT TeamID, TeamName FROM TournamentTeams WHERE TeamName LIKE @Name");

    if (teamRes.recordset.length === 0) {
      console.error("❌ Target team 'van anh le - Ngọc đẹp gái' not found!");
      process.exit(1);
    }

    const vanAnhTeam = teamRes.recordset[0];
    const vanAnhTeamId = vanAnhTeam.TeamID;
    console.log(`🎯 Found Target Team: [ID: ${vanAnhTeamId}] "${vanAnhTeam.TeamName}"`);

    // 2. Fetch all group stage matches in division 2278
    const matchesRes = await pool.request()
      .input("DivisionID", sql.Int, 2278)
      .query(`
        SELECT MatchID, TeamAID, TeamBID, GroupName, MatchStatus
        FROM TournamentMatches
        WHERE DivisionID = @DivisionID AND (GroupName LIKE N'Bảng%' OR GroupName IS NULL OR GroupName != 'Knockout')
      `);

    const matches = matchesRes.recordset;
    console.log(`📋 Found ${matches.length} group stage matches in Division 2278.`);

    let completedCount = 0;
    for (const m of matches) {
      if (!m.TeamAID || !m.TeamBID) {
        console.log(`⚠️ Match #${m.MatchID} is missing team(s). Skipping.`);
        continue;
      }

      // Check if match is already completed
      if (m.MatchStatus === "Completed") {
        console.log(`ℹ️ Match #${m.MatchID} is already Completed. Skipping.`);
        continue;
      }

      // Determine sets
      let sets;
      if (m.TeamAID === vanAnhTeamId) {
        // Make van anh win
        sets = [
          { setNo: 1, teamAScore: 11, teamBScore: 5 },
          { setNo: 2, teamAScore: 11, teamBScore: 7 }
        ];
        console.log(`🔥 Match #${m.MatchID} (${m.GroupName}): Team A "${vanAnhTeam.TeamName}" wins.`);
      } else if (m.TeamBID === vanAnhTeamId) {
        // Make van anh win
        sets = [
          { setNo: 1, teamAScore: 6, teamBScore: 11 },
          { setNo: 2, teamAScore: 8, teamBScore: 11 }
        ];
        console.log(`🔥 Match #${m.MatchID} (${m.GroupName}): Team B "${vanAnhTeam.TeamName}" wins.`);
      } else {
        // Standard random winner (Team A wins)
        sets = [
          { setNo: 1, teamAScore: 11, teamBScore: 8 },
          { setNo: 2, teamAScore: 11, teamBScore: 6 }
        ];
      }

      // Report score using service function
      await reportMatchScore(
        m.MatchID,
        {
          sets,
          adminOverride: true,
          reason: "Simulate tournament group stage scores"
        },
        {
          userId: 1, // Admin User
          role: "Admin"
        }
      );
      completedCount++;
    }

    console.log(`✅ Success! Simulated and submitted scores for ${completedCount} matches.`);

    // Check division status
    const divRes = await pool.request()
      .input("DivisionID", sql.Int, 2278)
      .query("SELECT Status FROM TournamentDivisions WHERE DivisionID = @DivisionID");
    console.log(`📊 Division Status is now: ${divRes.recordset[0].Status}`);

  } catch (err) {
    console.error("❌ Error simulating scores:", err);
  } finally {
    process.exit(0);
  }
}

run();
