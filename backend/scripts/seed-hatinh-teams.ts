import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";
import bcrypt from "bcryptjs";

const HASHED_PASS = bcrypt.hashSync("Password123!", 10);

async function seedHaTinh() {
  console.log("🌱 Bắt đầu tìm kiếm giải đấu Hà Tĩnh...");
  const pool = await getPool();

  try {
    // 1. Tìm giải đấu Hà Tĩnh
    const tRes = await pool.request().query(`
      SELECT TournamentID, TournamentName, Status 
      FROM Tournaments 
      WHERE TournamentName LIKE N'%Hà Tĩnh%'
    `);

    if (tRes.recordset.length === 0) {
      console.error("❌ Không tìm thấy giải đấu nào chứa từ khóa 'Hà Tĩnh' trong database!");
      process.exit(1);
    }

    const tournament = tRes.recordset[0];
    const tournamentId = tournament.TournamentID;
    console.log(`✅ Đã tìm thấy giải đấu: "${tournament.TournamentName}" (ID: ${tournamentId}, Trạng thái: ${tournament.Status})`);

    // Cập nhật trạng thái giải đấu thành 'RegistrationClosed' để có thể tạo lịch thi đấu
    await pool.request().query(`
      UPDATE Tournaments 
      SET Status = 'RegistrationClosed' 
      WHERE TournamentID = ${tournamentId}
    `);
    console.log(`⚡ Đã chuyển trạng thái giải đấu sang "RegistrationClosed" (Đóng đăng ký) để hỗ trợ bốc thăm.`);

    // 2. Lấy các nội dung thi đấu (Divisions)
    const dRes = await pool.request().query(`
      SELECT DivisionID, DivisionName, BracketType, MaxTeams 
      FROM TournamentDivisions 
      WHERE TournamentID = ${tournamentId}
    `);

    if (dRes.recordset.length === 0) {
      console.error("❌ Giải đấu này chưa có nội dung thi đấu (Division) nào!");
      process.exit(1);
    }

    const divisions = dRes.recordset;
    console.log(`🔍 Tìm thấy ${divisions.length} nội dung thi đấu.`);

    // 3. Tạo 16 người chơi mẫu cho giải Hà Tĩnh để dùng đi dùng lại
    console.log("👥 Tạo danh sách 16 người chơi mẫu...");
    const playerIds: number[] = [];
    const playerEmails: string[] = [];

    // Lấy RoleID của Player
    const rRes = await pool.request().query(`SELECT RoleID FROM Roles WHERE RoleName = 'Player'`);
    const playerRoleId = rRes.recordset[0]?.RoleID || 2;

    const names = [
      "Nguyễn Văn An", "Trần Văn Bình", "Lê Văn Cường", "Phạm Văn Dũng",
      "Hoàng Văn Em", "Ngô Văn Giang", "Phan Văn Hải", "Vũ Văn Hùng",
      "Bùi Văn Hữu", "Đỗ Văn Khải", "Nguyễn Văn Lâm", "Trần Văn Nam",
      "Lê Văn Phong", "Phạm Văn Quốc", "Hoàng Văn Sơn", "Nguyễn Văn Toàn"
    ];

    for (let i = 1; i <= 16; i++) {
      const email = `hatinh.player${i.toString().padStart(2, '0')}@test.com`;
      const name = names[i - 1];
      
      // Check if user exists
      const uCheck = await pool.request()
        .input("Email", sql.NVarChar, email)
        .query(`SELECT UserID FROM Users WHERE Email = @Email`);
      
      let userId: number;
      if (uCheck.recordset.length > 0) {
        userId = uCheck.recordset[0].UserID;
      } else {
        const uInsert = await pool.request()
          .input("Email", sql.NVarChar, email)
          .input("PasswordHash", sql.NVarChar, HASHED_PASS)
          .input("FullName", sql.NVarChar, name)
          .input("PhoneNumber", sql.NVarChar, `09876543${i.toString().padStart(2, '0')}`)
          .query(`
            INSERT INTO Users (Email, PasswordHash, FullName, PhoneNumber, Gender, DateOfBirth)
            OUTPUT INSERTED.UserID
            VALUES (@Email, @PasswordHash, @FullName, @PhoneNumber, 'Male', '1995-05-15')
          `);
        userId = uInsert.recordset[0].UserID;

        await pool.request().query(`
          INSERT INTO UserRoles (UserID, RoleID) VALUES (${userId}, ${playerRoleId})
        `);
      }
      playerIds.push(userId);
      playerEmails.push(email);
    }
    console.log("✅ Danh sách 16 người chơi mẫu đã sẵn sàng.");

    // 4. Seeding cho từng nội dung thi đấu
    for (const div of divisions) {
      console.log(`\n--------------------------------------------------`);
      console.log(`⚡ Đang nạp dữ liệu cho nội dung: "${div.DivisionName}" (ID: ${div.DivisionID}, Thể thức: ${div.BracketType})`);

      // Xóa sạch dữ liệu trận đấu và đăng ký cũ của division này
      console.log(`🧹 Dọn dẹp dữ liệu cũ của nội dung này...`);
      await pool.request().query(`
        DELETE FROM TournamentRegistrationAthletes WHERE DivisionID = ${div.DivisionID};
        DELETE FROM TournamentMatchCheckins WHERE MatchID IN (SELECT MatchID FROM TournamentMatches WHERE DivisionID = ${div.DivisionID});
        DELETE FROM TournamentMatchScores WHERE MatchID IN (SELECT MatchID FROM TournamentMatches WHERE DivisionID = ${div.DivisionID});
        DELETE FROM TournamentMatches WHERE DivisionID = ${div.DivisionID};
        DELETE FROM TournamentStandings WHERE DivisionID = ${div.DivisionID};
        DELETE FROM TournamentRegistrations WHERE DivisionID = ${div.DivisionID};
        DELETE FROM TournamentTeamMembers WHERE DivisionID = ${div.DivisionID};
        DELETE FROM TournamentTeams WHERE DivisionID = ${div.DivisionID};
      `);

      // Tạo 8 đội thi đấu (mỗi đội gồm 2 người)
      console.log(`👥 Tạo 8 đôi thi đấu mới và tự động check-in...`);
      for (let tIdx = 1; tIdx <= 8; tIdx++) {
        const teamName = `Hà Tĩnh Đôi ${tIdx}`;
        
        // Cặp người chơi cho đội này
        const p1Idx = (tIdx - 1) * 2;
        const p2Idx = (tIdx - 1) * 2 + 1;
        const p1Id = playerIds[p1Idx];
        const p2Id = playerIds[p2Idx];

        // 1. Insert TournamentTeams
        const tInsert = await pool.request()
          .input("TeamName", sql.NVarChar, teamName)
          .query(`
            INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, CreatedBy, TeamStatus)
            OUTPUT INSERTED.TeamID
            VALUES (${tournamentId}, ${div.DivisionID}, @TeamName, ${p1Id}, 'Registered')
          `);
        const teamId = tInsert.recordset[0].TeamID;

        // 2. Insert TournamentTeamMembers
        await pool.request().query(`
          INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus)
          VALUES 
          (${tournamentId}, ${div.DivisionID}, ${teamId}, ${p1Id}, 'Leader', 'Accepted'),
          (${tournamentId}, ${div.DivisionID}, ${teamId}, ${p2Id}, 'Member', 'Accepted')
        `);

        // 3. Insert TournamentRegistrations (Tự động Confirmed, Paid, Duyệt CCCD và Điểm danh)
        const rInsert = await pool.request().query(`
          INSERT INTO TournamentRegistrations (TournamentID, DivisionID, TeamID, RegisteredBy, RegistrationStatus, PaymentStatus, CccdVerified, IsCheckedIn)
          OUTPUT INSERTED.RegistrationID
          VALUES (${tournamentId}, ${div.DivisionID}, ${teamId}, ${p1Id}, 'Confirmed', 'Paid', 1, 1)
        `);
        const registrationId = rInsert.recordset[0].RegistrationID;

        // 4. Insert TournamentRegistrationAthletes (Thông tin 2 vận động viên)
        const athletes = [
          { id: p1Id, name: names[p1Idx], phone: `09876543${(p1Idx + 1).toString().padStart(2, '0')}`, rating: 3.5 + (tIdx * 0.1) },
          { id: p2Id, name: names[p2Idx], phone: `09876543${(p2Idx + 1).toString().padStart(2, '0')}`, rating: 3.4 + (tIdx * 0.1) }
        ];

        for (let aNo = 1; aNo <= 2; aNo++) {
          const ath = athletes[aNo - 1];
          await pool.request()
            .input("RegID", sql.Int, registrationId)
            .input("Name", sql.NVarChar, ath.name)
            .input("Phone", sql.NVarChar, ath.phone)
            .input("Rating", sql.Float, ath.rating)
            .query(`
              INSERT INTO TournamentRegistrationAthletes (
                RegistrationID, TournamentID, DivisionID, TeamID, UserID,
                AthleteNo, FullName, PhoneNumber, Rating, Province, Gender, DateOfBirth, CreatedAt, UpdatedAt
              )
              VALUES (
                @RegID, ${tournamentId}, ${div.DivisionID}, ${teamId}, ${ath.id},
                ${aNo}, @Name, @Phone, @Rating, N'Hà Tĩnh', 'Male', '1995-05-15', GETDATE(), GETDATE()
              )
            `);
        }
      }

      // Cập nhật trạng thái Division về 'RegistrationClosed' để Admin bấm bốc thăm
      await pool.request().query(`
        UPDATE TournamentDivisions 
        SET Status = 'RegistrationClosed' 
        WHERE DivisionID = ${div.DivisionID}
      `);
      console.log(`✅ Đã nạp xong 8 đôi chơi và đổi trạng thái nội dung này sang "RegistrationClosed".`);
    }

    console.log("\n=======================================");
    console.log("🎯 NẠP DỮ LIỆU ĐÔI CHƠI CHO GIẢI HÀ TĨNH THÀNH CÔNG!");
    console.log("Trạng thái giải đấu và các nội dung đã sẵn sàng để bốc thăm ngẫu nhiên.");
    console.log("=======================================\n");

  } catch (err) {
    console.error("❌ Lỗi nạp dữ liệu giải đấu Hà Tĩnh:", err);
  } finally {
    process.exit(0);
  }
}

seedHaTinh();
