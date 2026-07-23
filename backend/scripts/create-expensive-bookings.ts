import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";
import bcrypt from "bcryptjs";

const HASHED_PASS = bcrypt.hashSync("Player@123", 10);

async function createExpensiveBookings() {
  console.log("🌱 Bắt đầu tạo dữ liệu đặt sân đắt nhất hôm nay...");
  const pool = await getPool();

  try {
    // 1. Tìm 2 sân đắt nhất có trạng thái Available
    const courtsRes = await pool.request().query(`
      SELECT TOP 2 CourtID, CourtName, PricePerHour, CourtCode
      FROM Courts 
      WHERE Status = 'Available'
      ORDER BY PricePerHour DESC
    `);

    if (courtsRes.recordset.length < 2) {
      console.error("❌ Không tìm thấy đủ 2 sân hoạt động trong hệ thống!");
      process.exit(1);
    }

    const court1 = courtsRes.recordset[0];
    const court2 = courtsRes.recordset[1];
    console.log(`✅ Đã tìm thấy 2 sân đắt nhất:`);
    console.log(`   - Sân 1: ${court1.CourtName} (ID: ${court1.CourtID}, Giá: ${court1.PricePerHour.toLocaleString()}đ/h)`);
    console.log(`   - Sân 2: ${court2.CourtName} (ID: ${court2.CourtID}, Giá: ${court2.PricePerHour.toLocaleString()}đ/h)`);

    // 2. Định nghĩa ngày hôm nay và khung giờ 10:00 - 11:00
    const todayStr = "2026-07-14";
    const startTimeStr = "10:00:00";
    const endTimeStr = "11:00:00";

    // Lấy RoleID của Player
    const rRes = await pool.request().query(`SELECT RoleID FROM Roles WHERE RoleName = 'Player'`);
    const playerRoleId = rRes.recordset[0]?.RoleID || 2;

    // 3. Khởi tạo/Tìm 2 tài khoản người chơi thật (không có chữ test)
    const players = [
      { email: "bui.hoangnam@gmail.com", name: "Bùi Hoàng Nam", phone: "0912345678" },
      { email: "tran.thithuy@gmail.com", name: "Trần Thị Thủy", phone: "0987654321" }
    ];

    const playerIds: number[] = [];

    for (const p of players) {
      const uCheck = await pool.request()
        .input("Email", sql.NVarChar, p.email)
        .query(`SELECT UserID FROM Users WHERE Email = @Email`);

      let uId: number;
      if (uCheck.recordset.length > 0) {
        uId = uCheck.recordset[0].UserID;
        console.log(`👥 Đã có sẵn tài khoản: ${p.name} (${p.email}, ID: ${uId})`);
      } else {
        const uInsert = await pool.request()
          .input("Email", sql.NVarChar, p.email)
          .input("PasswordHash", sql.NVarChar, HASHED_PASS)
          .input("FullName", sql.NVarChar, p.name)
          .input("PhoneNumber", sql.NVarChar, p.phone)
          .query(`
            INSERT INTO Users (Email, PasswordHash, FullName, PhoneNumber, Gender, DateOfBirth)
            OUTPUT INSERTED.UserID
            VALUES (@Email, @PasswordHash, @FullName, @PhoneNumber, 'Male', '1992-08-20')
          `);
        uId = uInsert.recordset[0].UserID;
        await pool.request().query(`
          INSERT INTO UserRoles (UserID, RoleID) VALUES (${uId}, ${playerRoleId})
        `);
        console.log(`🆕 Tạo mới tài khoản: ${p.name} (${p.email}, ID: ${uId})`);
      }
      playerIds.push(uId);
    }

    const courts = [court1, court2];

    for (let i = 0; i < 2; i++) {
      const court = courts[i];
      const userId = playerIds[i];
      const player = players[i];

      console.log(`\n--------------------------------------------------`);
      console.log(`⚙️ Đang xử lý đặt sân cho ${court.CourtName}...`);

      // 4. Kiểm tra slot 10h hôm nay đã có trong database chưa
      let slotId: number;
      const slotCheck = await pool.request()
        .input("CourtID", sql.Int, court.CourtID)
        .input("SlotDate", sql.Date, todayStr)
        .query(`
          SELECT SlotID, Status 
          FROM CourtSlots 
          WHERE CourtID = @CourtID AND SlotDate = @SlotDate AND StartTime = '${startTimeStr}'
        `);

      if (slotCheck.recordset.length > 0) {
        slotId = slotCheck.recordset[0].SlotID;
        console.log(`👉 Đã tìm thấy Slot ID: ${slotId} (Trạng thái hiện tại: ${slotCheck.recordset[0].Status})`);
        
        // Cập nhật trạng thái slot về Booked
        await pool.request().query(`
          UPDATE CourtSlots SET Status = 'Booked' WHERE SlotID = ${slotId}
        `);
      } else {
        // Tạo mới Slot
        const slotInsert = await pool.request()
          .input("CourtID", sql.Int, court.CourtID)
          .input("SlotDate", sql.Date, todayStr)
          .input("Price", sql.Decimal, court.PricePerHour)
          .query(`
            INSERT INTO CourtSlots (CourtID, SlotDate, StartTime, EndTime, Price, Status)
            OUTPUT INSERTED.SlotID
            VALUES (@CourtID, @SlotDate, '${startTimeStr}', '${endTimeStr}', @Price, 'Booked')
          `);
        slotId = slotInsert.recordset[0].SlotID;
        console.log(`🆕 Đã tạo mới Slot ID: ${slotId} (Đặt trạng thái: Booked)`);
      }

      // Xóa các chi tiết đặt sân trùng lặp trước đó để tránh xung đột lịch
      await pool.request().query(`
        DELETE FROM BookingDetails WHERE SlotID = ${slotId};
      `);

      // 5. Tạo đơn đặt sân (Bookings) - Đã thanh toán (Paid), Chờ Check-in (Confirmed)
      const bookingCode = `BK-${Date.now()}-${court.CourtID}`;
      const fee = court.PricePerHour;

      const bookingInsert = await pool.request()
        .input("BookingCode", sql.NVarChar, bookingCode)
        .input("UserID", sql.Int, userId)
        .input("BookingDate", sql.Date, todayStr)
        .input("CourtFee", sql.Decimal, fee)
        .input("TotalAmount", sql.Decimal, fee)
        .input("OriginalAmount", sql.Decimal, fee)
        .query(`
          INSERT INTO Bookings (
            BookingCode, UserID, BookingType, BookingDate,
            CourtFee, CoachFee, DiscountAmount, TotalAmount, OriginalAmount, Status,
            PaymentMethod, PaymentStatus
          )
          OUTPUT INSERTED.BookingID
          VALUES (
            @BookingCode, @UserID, 'Court', @BookingDate,
            @CourtFee, 0, 0, @TotalAmount, @OriginalAmount, 'Confirmed',
            'Banking', 'Paid'
          )
        `);
      const bookingId = bookingInsert.recordset[0].BookingID;
      console.log(`📝 Đã tạo đơn Bookings ID: ${bookingId} (Mã code: ${bookingCode}, Trạng thái: Confirmed, Thanh toán: Paid)`);

      // 6. Tạo chi tiết đơn đặt sân (BookingDetails)
      await pool.request()
        .input("BookingID", sql.Int, bookingId)
        .input("SlotID", sql.Int, slotId)
        .input("CourtID", sql.Int, court.CourtID)
        .input("BookingDate", sql.Date, todayStr)
        .input("CourtFee", sql.Decimal, fee)
        .query(`
          INSERT INTO BookingDetails (
            BookingID, SlotID, CourtID, CoachID, CoachScheduleID,
            BookingDate, StartTime, EndTime, CourtFee, CoachFee, SubTotal
          )
          VALUES (
            @BookingID, @SlotID, @CourtID, NULL, NULL,
            @BookingDate, '${startTimeStr}', '${endTimeStr}', @CourtFee, 0, @CourtFee
          )
        `);
      console.log(`🔗 Đã liên kết BookingDetails thành công.`);
    }

    console.log("\n=======================================");
    console.log("🎯 NẠP DỮ LIỆU ĐẶT SÂN ĐẮT NHẤT HÔM NAY THÀNH CÔNG!");
    console.log("Thông tin đơn hàng đã sẵn sàng ở trạng thái: ĐÃ THANH TOÁN & CHỜ CHECK-IN");
    console.log("=======================================\n");

    players.forEach((p, idx) => {
      console.log(`${idx + 1}. Người chơi: ${p.name}`);
      console.log(`   - Email: ${p.email}`);
      console.log(`   - Mật khẩu test: Player@123`);
      console.log(`   - Điện thoại: ${p.phone}`);
      console.log(`   - Sân đặt: ${courts[idx].CourtName} (Khung giờ: 10:00 - 11:00 hôm nay)\n`);
    });

  } catch (err) {
    console.error("❌ Lỗi nạp dữ liệu đặt sân:", err);
  } finally {
    process.exit(0);
  }
}

createExpensiveBookings();
