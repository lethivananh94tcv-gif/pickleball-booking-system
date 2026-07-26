import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool, sql } from "../src/database/connection";
import { allocateDivisionSchedule, createTournament, createDivision, publishTournament, closeRegistration } from "../src/modules/bookings/../../modules/tournaments/tournaments.service";

async function runConstraintsTest() {
  console.log("=============================================================");
  console.log("🧪 BẮT ĐẦU KIỂM THỬ CÁC RÀNG BUỘC & AN TOÀN GIẢI ĐẤU NÂNG CAO");
  console.log("=============================================================");

  const pool = await getPool();
  const adminRes = await pool.request().query("SELECT TOP 1 UserID FROM Users");
  const adminId = adminRes.recordset[0]?.UserID || 1;
  const testUserId = 2; // Vận động viên test Trần Bảo Châu
  const partnerUserId = 3; // Vận động viên đối tác Lê Quốc Huy

  let createdTourneyId: number | null = null;
  let divId1: number | null = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: KIỂM TRA DATABASE UNIQUE CONSTRAINT CHỐNG ĐĂNG KÝ TRÙNG
    // -------------------------------------------------------------
    console.log("\n---------------------------------------------------");
    console.log("TEST 1: Ràng buộc UNIQUE chống một VĐV vào 2 đội cùng nội dung");
    console.log("---------------------------------------------------");
    
    // Tạo giải test mới trong tương lai
    const code = "TC_CONCUR_" + Date.now();
    const tourney = await createTournament({
      tournamentCode: code,
      tournamentName: "Test Concurrency " + code,
      registrationStart: "2026-08-01",
      registrationEnd: "2026-08-10",
      tournamentStart: "2026-08-15",
      tournamentEnd: "2026-08-20",
    }, adminId);
    createdTourneyId = tourney.TournamentID;

    const div = await createDivision(tourney.TournamentID, {
      divisionName: "Nội dung đôi nam",
      competitionFormat: "MenDoubles",
      ageGroup: "Open",
      maxTeams: 8,
      registrationFee: 0,
      bracketType: "RoundRobin",
    }, adminId);
    divId1 = div.DivisionID;

    // Đội thứ nhất: User 2 và User 3 gia nhập thành công
    console.log("-> Tạo đội 1 và thêm 2 thành viên...");
    const team1Res = await pool.request().query(`
      INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, CreatedBy, TeamStatus, CreatedAt)
      OUTPUT INSERTED.TeamID VALUES (${createdTourneyId}, ${divId1}, 'Team 1', ${adminId}, 'Registered', GETDATE())
    `);
    const team1Id = team1Res.recordset[0].TeamID;
    
    await pool.request().query(`
      INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus, JoinedAt)
      VALUES (${createdTourneyId}, ${divId1}, ${team1Id}, ${testUserId}, 'Leader', 'Accepted', GETDATE()),
             (${createdTourneyId}, ${divId1}, ${team1Id}, ${partnerUserId}, 'Member', 'Accepted', GETDATE())
    `);
    console.log("   ✅ Đội 1 tạo thành công!");

    // Đội thứ hai: Cố tình thêm lại User 2 (Trần Bảo Châu) vào đội này
    console.log("-> Tạo đội 2 và cố tình thêm lại Trần Bảo Châu (User 2) ở cùng nội dung...");
    const team2Res = await pool.request().query(`
      INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, CreatedBy, TeamStatus, CreatedAt)
      OUTPUT INSERTED.TeamID VALUES (${createdTourneyId}, ${divId1}, 'Team 2', ${adminId}, 'Registered', GETDATE())
    `);
    const team2Id = team2Res.recordset[0].TeamID;

    try {
      await pool.request().query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus, JoinedAt)
        VALUES (${createdTourneyId}, ${divId1}, ${team2Id}, ${testUserId}, 'Leader', 'Accepted', GETDATE())
      `);
      console.error("❌ THẤT BẠI: DB không chặn trùng đăng ký!");
    } catch (err: any) {
      console.log("   ✅ THÀNH CÔNG: Database đã từ chối ghi và ném lỗi vi phạm UNIQUE Constraint!");
      console.log(`      * Chi tiết lỗi DB: ${err.message}`);
    }

    // -------------------------------------------------------------
    // TEST 2: KIỂM TRA CHỐNG HAI ADMIN XẾP LỊCH CÙNG LÚC (SCHEDULING LOCK)
    // -------------------------------------------------------------
    console.log("\n---------------------------------------------------");
    console.log("TEST 2: Khóa tiến trình xếp lịch song song (Scheduling Lock)");
    console.log("---------------------------------------------------");
    
    // Đăng ký đủ đội cho nội dung 1 để xếp lịch
    // Tạo 4 đội hoàn chỉnh
    for (let i = 2; i <= 4; i++) {
      const mockTeamRes = await pool.request().query(`
        INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, CreatedBy, TeamStatus, CreatedAt)
        OUTPUT INSERTED.TeamID VALUES (${createdTourneyId}, ${divId1}, 'Mock Team ${i}', ${adminId}, 'Registered', GETDATE())
      `);
      const mockTeamId = mockTeamRes.recordset[0].TeamID;
      await pool.request().query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus, JoinedAt)
        VALUES (${createdTourneyId}, ${divId1}, ${mockTeamId}, ${10 + i}, 'Leader', 'Accepted', GETDATE())
      `);
      await pool.request().query(`
        INSERT INTO TournamentRegistrations (TournamentID, DivisionID, TeamID, RegisteredBy, RegistrationStatus, PaymentStatus, RegisteredAt)
        VALUES (${createdTourneyId}, ${divId1}, ${mockTeamId}, ${adminId}, 'Confirmed', 'Paid', GETDATE())
      `);
    }
    // Xác nhận đội 1 đã thanh toán
    await pool.request().query(`
      INSERT INTO TournamentRegistrations (TournamentID, DivisionID, TeamID, RegisteredBy, RegistrationStatus, PaymentStatus, RegisteredAt)
      VALUES (${createdTourneyId}, ${divId1}, ${team1Id}, ${adminId}, 'Confirmed', 'Paid', GETDATE())
    `);

    await publishTournament(createdTourneyId, adminId);
    await closeRegistration(createdTourneyId, adminId);

    // Kích hoạt bốc thăm tạo trận đấu
    const teamList = await pool.request().query(`SELECT TeamID FROM TournamentTeams WHERE DivisionID = ${divId1}`);
    const teams = teamList.recordset.map(t => t.TeamID);
    
    // Tạo trận đấu vòng tròn thủ công cho test
    await pool.request().query(`
      INSERT INTO TournamentMatches (TournamentID, DivisionID, RoundNo, MatchNo, TeamAID, TeamBID, MatchStatus, CreatedAt)
      VALUES (${createdTourneyId}, ${divId1}, 1, 1, ${teams[0]}, ${teams[1]}, 'Scheduled', GETDATE()),
             (${createdTourneyId}, ${divId1}, 1, 2, ${teams[2]}, ${teams[3]}, 'Scheduled', GETDATE())
    `);

    // Đặt trạng thái division thành DrawGenerated để được xếp lịch
    await pool.request().query(`UPDATE TournamentDivisions SET Status = 'DrawGenerated' WHERE DivisionID = ${divId1}`);

    console.log("-> Kích hoạt 2 tiến trình xếp lịch tự động chạy song song...");
    const schedulerPromise1 = allocateDivisionSchedule(createdTourneyId, divId1, {
      courtIds: [1, 2],
      startDateTime: "2026-08-16T08:00:00",
      matchDurationMinutes: 60,
      breakMinutes: 10
    }, adminId);

    const schedulerPromise2 = allocateDivisionSchedule(createdTourneyId, divId1, {
      courtIds: [1, 2],
      startDateTime: "2026-08-16T08:00:00",
      matchDurationMinutes: 60,
      breakMinutes: 10
    }, adminId);

    try {
      await Promise.all([schedulerPromise1, schedulerPromise2]);
      console.error("❌ THẤT BẠI: Hai tiến trình chạy song song không bị khóa chéo!");
    } catch (err: any) {
      console.log("   ✅ THÀNH CÔNG: Hệ thống đã chặn tiến trình thứ hai!");
      console.log(`      * Chi tiết lỗi khóa: ${err.message}`);
    }

    // Đợi xếp lịch 1 kết thúc để làm sạch DB trạng thái
    try { await schedulerPromise1; } catch {}
    try { await schedulerPromise2; } catch {}

    // -------------------------------------------------------------
    // TEST 3: KIỂM TRA GIỚI HẠN THỜI GIAN TOURNAMENT END
    // -------------------------------------------------------------
    console.log("\n---------------------------------------------------");
    console.log("TEST 3: Kiểm tra giới hạn thời gian kết thúc giải đấu (TournamentEnd)");
    console.log("---------------------------------------------------");
    
    // Đặt thời gian bắt đầu sát ngày kết thúc (TournamentEnd = 2026-08-20)
    console.log("-> Cố tình xếp lịch bắt đầu vào ngày 2026-08-20 lúc 23:30 (Trận đấu dài 60 phút sẽ vượt quá ngày 20)...");
    try {
      // Đổi lại status của division về DRAW_GENERATED để cho phép chạy lại scheduler
      await pool.request().query(`UPDATE TournamentDivisions SET Status = 'DrawGenerated' WHERE DivisionID = ${divId1}`);
      await allocateDivisionSchedule(createdTourneyId, divId1, {
        courtIds: [1],
        startDateTime: "2026-08-20T23:30:00",
        matchDurationMinutes: 60,
        breakMinutes: 10
      }, adminId);
      console.error("❌ THẤT BẠI: Xếp lịch vượt quá ngày kết thúc giải mà không báo lỗi!");
    } catch (err: any) {
      console.log("   ✅ THÀNH CÔNG: Hệ thống đã chặn đứng và ném lỗi vượt quá TournamentEnd!");
      console.log(`      * Chi tiết lỗi chặn: ${err.message}`);
    }

  } catch (error) {
    console.error("❌ LỖI KHÔNG MONG ĐỢI TRONG TEST CONCURRENCY:", error);
  } finally {
    // Dọn dẹp dữ liệu test
    if (createdTourneyId) {
      console.log("\n🧹 Dọn dẹp dữ liệu test khỏi database...");
      try {
        if (divId1) {
          await pool.request().query(`
            DELETE FROM TournamentCourtBlocks WHERE DivisionID = ${divId1};
            DELETE FROM TournamentMatches WHERE DivisionID = ${divId1};
            DELETE FROM TournamentRegistrations WHERE DivisionID = ${divId1};
            DELETE FROM TournamentTeamMembers WHERE DivisionID = ${divId1};
            DELETE FROM TournamentTeams WHERE DivisionID = ${divId1};
          `);
        }
        await pool.request().query(`
          DELETE FROM TournamentDivisions WHERE TournamentID = ${createdTourneyId};
          DELETE FROM Tournaments WHERE TournamentID = ${createdTourneyId};
        `);
        console.log("✅ Dọn dẹp cơ sở dữ liệu sạch sẽ!");
      } catch (cleanErr) {
        console.error("❌ Lỗi dọn dẹp:", cleanErr);
      }
    }
  }

  process.exit(0);
}

runConstraintsTest();
