import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";
import bcrypt from "bcryptjs";

const HASHED_PASS = bcrypt.hashSync("Player@123", 10);

async function seedDaNang() {
  console.log("🌱 Bắt đầu tìm kiếm giải đấu Đà Nẵng...");
  const pool = await getPool();

  try {
    // 1. Tìm giải đấu Đà Nẵng
    const tRes = await pool.request().query(`
      SELECT TournamentID, TournamentName, Status 
      FROM Tournaments 
      WHERE TournamentName LIKE N'%Đà Nẵng%'
    `);

    if (tRes.recordset.length === 0) {
      console.error("❌ Không tìm thấy giải đấu nào chứa từ khóa 'Đà Nẵng' trong database!");
      process.exit(1);
    }

    const tournament = tRes.recordset[0];
    const tournamentId = tournament.TournamentID;
    console.log(`✅ Đã tìm thấy giải đấu: "${tournament.TournamentName}" (ID: ${tournamentId}, Trạng thái: ${tournament.Status})`);

    // 2. Lấy danh sách nội dung thi đấu (Divisions)
    const dRes = await pool.request().query(`
      SELECT DivisionID, DivisionName, BracketType, MaxTeams, RegistrationFee
      FROM TournamentDivisions 
      WHERE TournamentID = ${tournamentId}
    `);

    const divisions = dRes.recordset;
    if (divisions.length === 0) {
      console.error("❌ Giải đấu này chưa có nội dung thi đấu nào!");
      process.exit(1);
    }

    // Phân loại Đơn Nam & Đơn Nữ
    const divWomen = divisions.find(d => d.DivisionName.includes("Nữ"));
    const divMen = divisions.find(d => d.DivisionName.includes("Nam"));

    if (!divWomen || !divMen) {
      console.error("❌ Không tìm thấy đủ hai nội dung Đơn Nam và Đơn Nữ của giải Đà Nẵng!");
      process.exit(1);
    }

    console.log(`✅ Tìm thấy các nội dung:`);
    console.log(`   - Đơn Nữ: ID ${divWomen.DivisionID} (Max: ${divWomen.MaxTeams || 8} đội, Lệ phí: ${divWomen.RegistrationFee.toLocaleString()}đ)`);
    console.log(`   - Đơn Nam: ID ${divMen.DivisionID} (Max: ${divMen.MaxTeams || 8} đội, Lệ phí: ${divMen.RegistrationFee.toLocaleString()}đ)`);

    // Lấy RoleID của Player
    const rRes = await pool.request().query(`SELECT RoleID FROM Roles WHERE RoleName = 'Player'`);
    const playerRoleId = rRes.recordset[0]?.RoleID || 2;

    // 3. Xử lý nạp dữ liệu Đơn Nữ (Full người đăng ký, Đã thanh toán)
    const womenMax = divWomen.MaxTeams || 8;
    console.log(`\n--------------------------------------------------`);
    console.log(`⚡ Nạp dữ liệu ĐƠN NỮ (Full ${womenMax} slots)...`);
    
    // Dọn dẹp cũ
    await pool.request().query(`
      DELETE FROM TournamentPayments WHERE RegistrationID IN (SELECT RegistrationID FROM TournamentRegistrations WHERE DivisionID = ${divWomen.DivisionID});
      DELETE FROM TournamentRegistrationAthletes WHERE DivisionID = ${divWomen.DivisionID};
      DELETE FROM TournamentMatchCheckins WHERE MatchID IN (SELECT MatchID FROM TournamentMatches WHERE DivisionID = ${divWomen.DivisionID});
      DELETE FROM TournamentMatchScores WHERE MatchID IN (SELECT MatchID FROM TournamentMatches WHERE DivisionID = ${divWomen.DivisionID});
      DELETE FROM TournamentMatches WHERE DivisionID = ${divWomen.DivisionID};
      DELETE FROM TournamentStandings WHERE DivisionID = ${divWomen.DivisionID};
      DELETE FROM TournamentRegistrations WHERE DivisionID = ${divWomen.DivisionID};
      DELETE FROM TournamentTeamMembers WHERE DivisionID = ${divWomen.DivisionID};
      DELETE FROM TournamentTeams WHERE DivisionID = ${divWomen.DivisionID};
    `);

    const femaleNames = [
      "Nguyễn Thị Lan", "Lê Thị Mai", "Phan Thị Hoa", "Trần Thị Cúc",
      "Vũ Thị Đào", "Bùi Thị Hồng", "Phạm Thị Huệ", "Đỗ Thị Kim",
      "Hoàng Thị Vy", "Ngô Thị Yến", "Đặng Thị Nga", "Lý Thị Trinh",
      "Dương Thị Tuyền", "Tống Thị Hạnh", "Võ Thị Quỳnh", "Mai Thị Phương"
    ];

    for (let i = 1; i <= womenMax; i++) {
      const email = `danang.women.${i.toString().padStart(2, '0')}@test.com`;
      const name = femaleNames[(i - 1) % femaleNames.length];
      
      // 1. Tạo/Tìm user
      let userId: number;
      const uCheck = await pool.request().input("Email", sql.NVarChar, email).query(`SELECT UserID FROM Users WHERE Email = @Email`);
      if (uCheck.recordset.length > 0) {
        userId = uCheck.recordset[0].UserID;
      } else {
        const uInsert = await pool.request()
          .input("Email", sql.NVarChar, email)
          .input("PasswordHash", sql.NVarChar, HASHED_PASS)
          .input("FullName", sql.NVarChar, name)
          .input("PhoneNumber", sql.NVarChar, `0906333${i.toString().padStart(3, '0')}`)
          .query(`
            INSERT INTO Users (Email, PasswordHash, FullName, PhoneNumber, Gender, DateOfBirth)
            OUTPUT INSERTED.UserID
            VALUES (@Email, @PasswordHash, @FullName, @PhoneNumber, 'Female', '1997-04-12')
          `);
        userId = uInsert.recordset[0].UserID;
        await pool.request().query(`INSERT INTO UserRoles (UserID, RoleID) VALUES (${userId}, ${playerRoleId})`);
      }

      // 2. Tạo team
      const tInsert = await pool.request()
        .input("TeamName", sql.NVarChar, name)
        .query(`
          INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, CreatedBy, TeamStatus)
          OUTPUT INSERTED.TeamID
          VALUES (${tournamentId}, ${divWomen.DivisionID}, @TeamName, ${userId}, 'Registered')
        `);
      const teamId = tInsert.recordset[0].TeamID;

      // 3. Tạo team member
      await pool.request().query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus)
        VALUES (${tournamentId}, ${divWomen.DivisionID}, ${teamId}, ${userId}, 'Leader', 'Accepted')
      `);

      // 4. Tạo registration
      const rInsert = await pool.request().query(`
        INSERT INTO TournamentRegistrations (TournamentID, DivisionID, TeamID, RegisteredBy, RegistrationStatus, PaymentStatus, CccdVerified, IsCheckedIn)
        OUTPUT INSERTED.RegistrationID
        VALUES (${tournamentId}, ${divWomen.DivisionID}, ${teamId}, ${userId}, 'Confirmed', 'Paid', 1, 1)
      `);
      const registrationId = rInsert.recordset[0].RegistrationID;

      // 5. Tạo athlete
      await pool.request()
        .input("Name", sql.NVarChar, name)
        .query(`
          INSERT INTO TournamentRegistrationAthletes (
            RegistrationID, TournamentID, DivisionID, TeamID, UserID,
            AthleteNo, FullName, PhoneNumber, Rating, Province, Gender, DateOfBirth, CreatedAt, UpdatedAt
          )
          VALUES (
            ${registrationId}, ${tournamentId}, ${divWomen.DivisionID}, ${teamId}, ${userId},
            1, @Name, '0906333222', 3.5, N'Đà Nẵng', 'Female', '1997-04-12', GETDATE(), GETDATE()
          )
        `);

      // 6. Tạo TournamentPayments (Đồng bộ doanh thu Admin - dùng BankTransfer để qua Check constraint)
      await pool.request()
        .input("Amount", sql.Decimal, divWomen.RegistrationFee)
        .query(`
          INSERT INTO TournamentPayments (RegistrationID, Amount, PaymentMethod, PaymentStatus, CreatedAt, PaidAt)
          VALUES (${registrationId}, @Amount, 'BankTransfer', 'Paid', GETDATE(), GETDATE())
        `);
    }
    console.log(`✅ Đã nạp thành công Đơn Nữ: ${womenMax}/${womenMax} đăng ký.`);

    // 4. Xử lý nạp dữ liệu Đơn Nam (Trừa lại 1 slot cho user)
    const menMax = divMen.MaxTeams || 8;
    const menTarget = menMax - 1;
    console.log(`\n--------------------------------------------------`);
    console.log(`⚡ Nạp dữ liệu ĐƠN NAM (Chừa lại 1 slot: ${menTarget}/${menMax} slots)...`);

    // Dọn dẹp cũ
    await pool.request().query(`
      DELETE FROM TournamentPayments WHERE RegistrationID IN (SELECT RegistrationID FROM TournamentRegistrations WHERE DivisionID = ${divMen.DivisionID});
      DELETE FROM TournamentRegistrationAthletes WHERE DivisionID = ${divMen.DivisionID};
      DELETE FROM TournamentMatchCheckins WHERE MatchID IN (SELECT MatchID FROM TournamentMatches WHERE DivisionID = ${divMen.DivisionID});
      DELETE FROM TournamentMatchScores WHERE MatchID IN (SELECT MatchID FROM TournamentMatches WHERE DivisionID = ${divMen.DivisionID});
      DELETE FROM TournamentMatches WHERE DivisionID = ${divMen.DivisionID};
      DELETE FROM TournamentStandings WHERE DivisionID = ${divMen.DivisionID};
      DELETE FROM TournamentRegistrations WHERE DivisionID = ${divMen.DivisionID};
      DELETE FROM TournamentTeamMembers WHERE DivisionID = ${divMen.DivisionID};
      DELETE FROM TournamentTeams WHERE DivisionID = ${divMen.DivisionID};
    `);

    const maleNames = [
      "Nguyễn Văn Hùng", "Lê Văn Hải", "Trần Văn Bình", "Phạm Văn Dũng",
      "Hoàng Văn Em", "Ngô Văn Giang", "Phan Văn Hữu", "Bùi Văn Nam",
      "Đỗ Văn Tiến", "Vũ Văn Khánh", "Lê Văn Thịnh", "Nguyễn Văn Đức",
      "Trần Văn Sơn", "Phạm Văn Bảo", "Hoàng Văn Tuấn", "Ngô Văn Long"
    ];

    for (let i = 1; i <= menTarget; i++) {
      const email = `danang.men.${i.toString().padStart(2, '0')}@test.com`;
      const name = maleNames[(i - 1) % maleNames.length];
      
      // 1. Tạo/Tìm user
      let userId: number;
      const uCheck = await pool.request().input("Email", sql.NVarChar, email).query(`SELECT UserID FROM Users WHERE Email = @Email`);
      if (uCheck.recordset.length > 0) {
        userId = uCheck.recordset[0].UserID;
      } else {
        const uInsert = await pool.request()
          .input("Email", sql.NVarChar, email)
          .input("PasswordHash", sql.NVarChar, HASHED_PASS)
          .input("FullName", sql.NVarChar, name)
          .input("PhoneNumber", sql.NVarChar, `0905444${i.toString().padStart(3, '0')}`)
          .query(`
            INSERT INTO Users (Email, PasswordHash, FullName, PhoneNumber, Gender, DateOfBirth)
            OUTPUT INSERTED.UserID
            VALUES (@Email, @PasswordHash, @FullName, @PhoneNumber, 'Male', '1996-11-23')
          `);
        userId = uInsert.recordset[0].UserID;
        await pool.request().query(`INSERT INTO UserRoles (UserID, RoleID) VALUES (${userId}, ${playerRoleId})`);
      }

      // 2. Tạo team
      const tInsert = await pool.request()
        .input("TeamName", sql.NVarChar, name)
        .query(`
          INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, CreatedBy, TeamStatus)
          OUTPUT INSERTED.TeamID
          VALUES (${tournamentId}, ${divMen.DivisionID}, @TeamName, ${userId}, 'Registered')
        `);
      const teamId = tInsert.recordset[0].TeamID;

      // 3. Tạo team member
      await pool.request().query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus)
        VALUES (${tournamentId}, ${divMen.DivisionID}, ${teamId}, ${userId}, 'Leader', 'Accepted')
      `);

      // 4. Tạo registration
      const rInsert = await pool.request().query(`
        INSERT INTO TournamentRegistrations (TournamentID, DivisionID, TeamID, RegisteredBy, RegistrationStatus, PaymentStatus, CccdVerified, IsCheckedIn)
        OUTPUT INSERTED.RegistrationID
        VALUES (${tournamentId}, ${divMen.DivisionID}, ${teamId}, ${userId}, 'Confirmed', 'Paid', 1, 1)
      `);
      const registrationId = rInsert.recordset[0].RegistrationID;

      // 5. Tạo athlete
      await pool.request()
        .input("Name", sql.NVarChar, name)
        .query(`
          INSERT INTO TournamentRegistrationAthletes (
            RegistrationID, TournamentID, DivisionID, TeamID, UserID,
            AthleteNo, FullName, PhoneNumber, Rating, Province, Gender, DateOfBirth, CreatedAt, UpdatedAt
          )
          VALUES (
            ${registrationId}, ${tournamentId}, ${divMen.DivisionID}, ${teamId}, ${userId},
            1, @Name, '0905444333', 3.6, N'Đà Nẵng', 'Male', '1996-11-23', GETDATE(), GETDATE()
          )
        `);

      // 6. Tạo TournamentPayments (Đồng bộ doanh thu Admin - dùng BankTransfer để qua Check constraint)
      await pool.request()
        .input("Amount", sql.Decimal, divMen.RegistrationFee)
        .query(`
          INSERT INTO TournamentPayments (RegistrationID, Amount, PaymentMethod, PaymentStatus, CreatedAt, PaidAt)
          VALUES (${registrationId}, @Amount, 'BankTransfer', 'Paid', GETDATE(), GETDATE())
        `);
    }
    console.log(`✅ Đã nạp thành công Đơn Nam: ${menTarget}/${menMax} đăng ký (Còn dư đúng 1 slot).`);

    // Reset các trạng thái nội dung đấu về RegistrationClosed hoặc Open tùy thuộc vào trạng thái giải đấu
    await pool.request().query(`
      UPDATE TournamentDivisions 
      SET Status = 'RegistrationClosed' 
      WHERE DivisionID = ${divWomen.DivisionID}
    `);
    
    // Đơn nam vẫn mở đăng ký vì còn dư 1 slot
    await pool.request().query(`
      UPDATE TournamentDivisions 
      SET Status = 'Open' 
      WHERE DivisionID = ${divMen.DivisionID}
    `);

    // Cập nhật trạng thái giải đấu sang Open để cho phép đăng ký slot cuối cùng
    await pool.request().query(`
      UPDATE Tournaments 
      SET Status = 'Open' 
      WHERE TournamentID = ${tournamentId}
    `);

    console.log("\n=======================================");
    console.log("🎯 NẠP DỮ LIỆU ĐĂNG KÝ VÀ DOANH THU ĐÀ NẴNG THÀNH CÔNG!");
    console.log(`Tổng doanh thu được ghi nhận thêm: ${(womenMax * divWomen.RegistrationFee + menTarget * divMen.RegistrationFee).toLocaleString()}đ`);
    console.log("=======================================\n");

  } catch (err) {
    console.error("❌ Lỗi nạp dữ liệu giải đấu Đà Nẵng:", err);
  } finally {
    process.exit(0);
  }
}

seedDaNang();
