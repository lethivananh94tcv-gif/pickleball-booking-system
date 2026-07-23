import { getPool, sql } from "../src/database/connection";
import * as dotenv from "dotenv";

dotenv.config();

const maleAvatars = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&h=150&q=80"
];

const femaleAvatars = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80"
];

const provinces = ["Đà Nẵng", "Hà Nội", "TP. Hồ Chí Minh", "Quảng Nam", "Huế"];

async function main() {
  console.log("Connecting to database...");
  const pool = await getPool();

  console.log("Cleaning old TournamentRegistrationAthletes records...");
  await pool.request().query("DELETE FROM TournamentRegistrationAthletes");

  console.log("Fetching registrations and their team names...");
  const queryResult = await pool.request().query(`
    SELECT 
      r.RegistrationID,
      r.TournamentID,
      r.DivisionID,
      r.TeamID,
      t.TeamName
    FROM TournamentRegistrations r
    INNER JOIN TournamentTeams t ON r.TeamID = t.TeamID
    WHERE r.RegistrationStatus IN ('Confirmed', 'Paid')
  `);

  const registrations = queryResult.recordset;
  console.log(`Found ${registrations.length} registrations. Populating athlete profiles...`);

  let count = 0;
  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i];
    const teamName = reg.TeamName || `Đội ${reg.TeamID}`;

    // Split team name if it represents doubles partners (e.g. "Nguyen / Tran" or "Nguyen - Tran" or "Nguyen & Tran")
    let playerNames = [teamName];
    if (teamName.includes(" / ")) {
      playerNames = teamName.split(" / ");
    } else if (teamName.includes(" - ")) {
      playerNames = teamName.split(" - ");
    } else if (teamName.includes(" & ")) {
      playerNames = teamName.split(" & ");
    }

    for (let pIdx = 0; pIdx < playerNames.length; pIdx++) {
      const name = playerNames[pIdx].trim();
      if (!name || name === "TBD" || name === "Bye") continue;

      let gender = "Male";
      const lowerName = name.toLowerCase();
      if (
        lowerName.includes("thị") || 
        lowerName.includes("nữ") || 
        lowerName.includes("hương") || 
        lowerName.includes("trang") || 
        lowerName.includes("lan") || 
        lowerName.includes("nhi") || 
        lowerName.includes("mai") || 
        lowerName.includes("vân") || 
        lowerName.includes("huyền") ||
        lowerName.includes("vy")
      ) {
        gender = "Female";
      }

      const rating = 3.4 + ((i + pIdx) % 6) * 0.2 + Math.random() * 0.15;
      const province = provinces[(i + pIdx) % provinces.length];
      
      const avatarList = gender === "Female" ? femaleAvatars : maleAvatars;
      const photoUrl = avatarList[(i + pIdx) % avatarList.length];
      const phone = "09" + Math.floor(10000000 + Math.random() * 90000000).toString();

      await pool.request()
        .input("RegistrationID", sql.Int, reg.RegistrationID)
        .input("TournamentID", sql.Int, reg.TournamentID)
        .input("DivisionID", sql.Int, reg.DivisionID)
        .input("TeamID", sql.Int, reg.TeamID)
        .input("AthleteNo", sql.Int, pIdx + 1)
        .input("FullName", sql.NVarChar(255), name)
        .input("PhoneNumber", sql.VarChar(50), phone)
        .input("Rating", sql.Float, rating)
        .input("Province", sql.NVarChar(100), province)
        .input("Gender", sql.NVarChar(20), gender)
        .input("PhotoURL", sql.NVarChar(sql.MAX), photoUrl)
        .query(`
          INSERT INTO TournamentRegistrationAthletes (
            RegistrationID, TournamentID, DivisionID, TeamID, UserID,
            AthleteNo, FullName, PhoneNumber, Rating, Province, Gender, DateOfBirth, CreatedAt, UpdatedAt, PhotoURL
          )
          VALUES (
            @RegistrationID, @TournamentID, @DivisionID, @TeamID, NULL,
            @AthleteNo, @FullName, @PhoneNumber, @Rating, @Province, @Gender, '1995-05-15', GETDATE(), GETDATE(), @PhotoURL
          )
        `);

      count++;
    }
  }

  console.log(`Successfully populated ${count} athlete profiles derived from TeamNames for testing!`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
