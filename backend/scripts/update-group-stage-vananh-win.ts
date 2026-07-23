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
    const vanAnhTeamId = 3222; // The correct team ID
    const divisionId = 2278;

    // Fetch matches for Bảng H
    const matchesRes = await pool.request()
      .input("DivisionID", sql.Int, divisionId)
      .input("GroupName", sql.NVarChar, "Bảng H")
      .query(`
        SELECT MatchID, TeamAID, TeamBID, GroupName
        FROM TournamentMatches
        WHERE DivisionID = @DivisionID AND GroupName = @GroupName
      `);

    const matches = matchesRes.recordset;
    console.log(`📋 Found ${matches.length} matches in Group H.`);

    for (const m of matches) {
      let sets;
      if (m.TeamAID === vanAnhTeamId) {
        // van anh wins 2-0
        sets = [
          { setNo: 1, teamAScore: 11, teamBScore: 5 },
          { setNo: 2, teamAScore: 11, teamBScore: 7 }
        ];
        console.log(`🔥 Overwriting Match #${m.MatchID}: van anh (Team A) wins.`);
      } else if (m.TeamBID === vanAnhTeamId) {
        // van anh wins 2-0
        sets = [
          { setNo: 1, teamAScore: 5, teamBScore: 11 },
          { setNo: 2, teamAScore: 7, teamBScore: 11 }
        ];
        console.log(`🔥 Overwriting Match #${m.MatchID}: van anh (Team B) wins.`);
      } else {
        // Other matches, let Team A win
        sets = [
          { setNo: 1, teamAScore: 11, teamBScore: 8 },
          { setNo: 2, teamAScore: 11, teamBScore: 6 }
        ];
        console.log(`ℹ️ Overwriting Match #${m.MatchID}: Team A wins.`);
      }

      await reportMatchScore(
        m.MatchID,
        {
          sets,
          adminOverride: true,
          reason: "Fix correct van anh team group stage score"
        },
        {
          userId: 1,
          role: "Admin"
        }
      );
    }

    console.log("✅ Success! Overwrote Bảng H match scores with van anh winning.");

    // Verify standings
    const standingsRes = await pool.request()
      .input("DivisionID", sql.Int, divisionId)
      .input("GroupName", sql.NVarChar, "Bảng H")
      .query(`
        SELECT s.RankNo, t.TeamName, s.Points, s.WonCount, s.LostCount, s.PointDiff
        FROM TournamentStandings s
        INNER JOIN TournamentTeams t ON s.TeamID = t.TeamID
        WHERE s.DivisionID = @DivisionID AND s.GroupName = @GroupName
        ORDER BY s.RankNo ASC
      `);
    console.log("📊 Bảng xếp hạng Bảng H mới:");
    console.table(standingsRes.recordset);

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
