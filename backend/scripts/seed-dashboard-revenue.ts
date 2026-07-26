import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";

async function main() {
  console.log("🌱 Bắt đầu nạp dữ liệu doanh thu cho dashboard...");
  const pool = await getPool();

  try {
    // 1. Lấy danh sách sân, coach và player hiện có
    const courtsRes = await pool.request().query("SELECT CourtID, PricePerHour, CourtName FROM Courts WHERE Status = 'Available'");
    const coachesRes = await pool.request().query("SELECT c.CoachID, c.HourlyRate, u.FullName FROM Coaches c JOIN Users u ON c.UserID = u.UserID WHERE c.Status = 'Approved'");
    const playersRes = await pool.request().query(`
      SELECT u.UserID, u.FullName, u.Email, u.PhoneNumber
      FROM Users u
      JOIN UserRoles ur ON u.UserID = ur.UserID
      JOIN Roles r ON ur.RoleID = r.RoleID
      WHERE r.RoleName = 'Player'
    `);

    const courts = courtsRes.recordset;
    const coaches = coachesRes.recordset;
    const players = playersRes.recordset;

    console.log(`Đã tìm thấy ${courts.length} sân hoạt động, ${coaches.length} huấn luyện viên hoạt động, và ${players.length} người chơi.`);

    if (courts.length === 0 || coaches.length === 0 || players.length === 0) {
      console.error("❌ Không đủ điều kiện nạp dữ liệu (yêu cầu ít nhất 1 sân, 1 coach, và 1 player)!");
      process.exit(1);
    }

    // 2. Dọn dẹp dữ liệu cũ được tạo bởi script này để có thể chạy lại an toàn
    console.log("🧹 Đang dọn dẹp dữ liệu cũ (SEED-REV)...");
    const oldBookings = await pool.request().query("SELECT BookingID, SlotID, CoachScheduleID FROM BookingDetails WHERE BookingID IN (SELECT BookingID FROM Bookings WHERE BookingCode LIKE 'SEED-REV-%')");
    
    const bookingIds = oldBookings.recordset.map(r => r.BookingID).filter(Boolean);
    const slotIds = oldBookings.recordset.map(r => r.SlotID).filter(Boolean);
    const coachScheduleIds = oldBookings.recordset.map(r => r.CoachScheduleID).filter(Boolean);

    if (bookingIds.length > 0) {
      await pool.request().query(`DELETE FROM Payments WHERE BookingID IN (${bookingIds.join(",")})`);
      await pool.request().query(`DELETE FROM BookingDetails WHERE BookingID IN (${bookingIds.join(",")})`);
      await pool.request().query(`DELETE FROM Bookings WHERE BookingID IN (${bookingIds.join(",")})`);
    }
    if (slotIds.length > 0) {
      await pool.request().query(`DELETE FROM CourtSlots WHERE SlotID IN (${slotIds.join(",")})`);
    }
    if (coachScheduleIds.length > 0) {
      await pool.request().query(`DELETE FROM CoachSchedules WHERE CoachScheduleID IN (${coachScheduleIds.join(",")})`);
    }
    console.log("✅ Đã dọn dẹp sạch sẽ dữ liệu cũ!");

    // 3. Tạo dữ liệu mới phân bố đều trong 30 ngày qua
    const today = new Date();
    const numDays = 30;

    let courtIndex = 0;
    let coachIndex = 0;
    let playerIndex = 0;

    const timeSlots = [
      { start: "06:00:00", end: "07:00:00" },
      { start: "07:00:00", end: "08:00:00" },
      { start: "08:00:00", end: "09:00:00" },
      { start: "09:00:00", end: "10:00:00" },
      { start: "10:00:00", end: "11:00:00" },
      { start: "14:00:00", end: "15:00:00" },
      { start: "15:00:00", end: "16:00:00" },
      { start: "16:00:00", end: "17:00:00" },
      { start: "17:00:00", end: "18:00:00" },
      { start: "18:00:00", end: "19:00:00" },
      { start: "19:00:00", end: "20:00:00" },
      { start: "20:00:00", end: "21:00:00" },
      { start: "21:00:00", end: "22:00:00" }
    ];

    const paymentMethods = ["BankTransfer", "Cash", "PayOS"];

    let totalRevenue = 0;
    let totalBookings = 0;

    for (let d = numDays; d >= 0; d--) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() - d);
      
      const dateStr = currentDate.toISOString().split("T")[0];
      
      // Tạo số lượng đặt sân ngẫu nhiên mỗi ngày từ 6 đến 10 đơn để dashboard đẹp
      const bookingsPerDay = 6 + Math.floor(Math.random() * 5);
      
      // Tránh trùng lịch trên cùng một ngày
      const busyCourts = new Set<string>(); // "courtId-startTime"
      const busyCoaches = new Set<string>(); // "coachId-startTime"

      for (let b = 0; b < bookingsPerDay; b++) {
        // Tỷ lệ phân loại: 50% chỉ thuê Sân, 40% đặt Combo (Sân + Coach), 10% chỉ thuê Coach
        const randType = Math.random();
        const bookingType = randType < 0.5 ? "Court" : randType < 0.9 ? "Combo" : "Coach";

        // Chọn slot giờ
        let timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
        let court = courts[courtIndex % courts.length];
        let coach = coaches[coachIndex % coaches.length];
        
        let attempts = 0;
        while (
          (busyCourts.has(`${court.CourtID}-${timeSlot.start}`) || 
           (bookingType !== "Court" && busyCoaches.has(`${coach.CoachID}-${timeSlot.start}`))) && 
          attempts < 50
        ) {
          timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
          court = courts[Math.floor(Math.random() * courts.length)];
          coach = coaches[Math.floor(Math.random() * coaches.length)];
          attempts++;
        }

        busyCourts.add(`${court.CourtID}-${timeSlot.start}`);
        if (bookingType !== "Court") {
          busyCoaches.add(`${coach.CoachID}-${timeSlot.start}`);
        }

        courtIndex++;
        coachIndex++;

        // Chọn người chơi
        const player = players[playerIndex % players.length];
        playerIndex++;

        // Tính phí
        const hours = 1;
        const courtFee = bookingType !== "Coach" ? Number(court.PricePerHour) * hours : 0;
        const coachFee = bookingType !== "Court" ? Number(coach.HourlyRate) * hours : 0;
        const totalAmount = courtFee + coachFee;
        
        // 3.1 Tạo Slot sân tương ứng
        let slotId: number | null = null;
        if (bookingType !== "Coach") {
          const checkSlot = await pool.request()
            .input("CourtID", sql.Int, court.CourtID)
            .input("SlotDate", sql.Date, dateStr)
            .query(`
              SELECT SlotID FROM CourtSlots 
              WHERE CourtID = @CourtID AND SlotDate = @SlotDate AND StartTime = '${timeSlot.start}' AND EndTime = '${timeSlot.end}'
            `);

          if (checkSlot.recordset.length > 0) {
            slotId = checkSlot.recordset[0].SlotID;
            await pool.request().query(`UPDATE CourtSlots SET Status = 'Booked' WHERE SlotID = ${slotId}`);
          } else {
            const slotRes = await pool.request()
              .input("CourtID", sql.Int, court.CourtID)
              .input("SlotDate", sql.Date, dateStr)
              .input("Price", sql.Decimal, courtFee)
              .query(`
                INSERT INTO CourtSlots (CourtID, SlotDate, StartTime, EndTime, Price, Status)
                OUTPUT INSERTED.SlotID
                VALUES (@CourtID, @SlotDate, '${timeSlot.start}', '${timeSlot.end}', @Price, 'Booked')
              `);
            slotId = slotRes.recordset[0].SlotID;
          }
        }

        // 3.2 Tạo lịch làm việc cho Coach
        let coachScheduleId: number | null = null;
        if (bookingType !== "Court") {
          const checkSched = await pool.request()
            .input("CoachID", sql.Int, coach.CoachID)
            .input("WorkingDate", sql.Date, dateStr)
            .query(`
              SELECT CoachScheduleID FROM CoachSchedules 
              WHERE CoachID = @CoachID AND WorkingDate = @WorkingDate AND StartTime = '${timeSlot.start}' AND EndTime = '${timeSlot.end}'
            `);

          if (checkSched.recordset.length > 0) {
            coachScheduleId = checkSched.recordset[0].CoachScheduleID;
            await pool.request().query(`UPDATE CoachSchedules SET Status = 'Booked' WHERE CoachScheduleID = ${coachScheduleId}`);
          } else {
            const schedRes = await pool.request()
              .input("CoachID", sql.Int, coach.CoachID)
              .input("WorkingDate", sql.Date, dateStr)
              .query(`
                INSERT INTO CoachSchedules (CoachID, WorkingDate, StartTime, EndTime, Status)
                OUTPUT INSERTED.CoachScheduleID
                VALUES (@CoachID, @WorkingDate, '${timeSlot.start}', '${timeSlot.end}', 'Booked')
              `);
            coachScheduleId = schedRes.recordset[0].CoachScheduleID;
          }
        }

        // 3.3 Tạo Booking
        const bookingCode = `SEED-REV-${dateStr.replace(/-/g, "")}-${court.CourtID}-${Math.floor(1000 + Math.random() * 9000)}`;
        const status = d === 0 ? "Confirmed" : "Completed"; // Ngày hôm nay là Confirmed, quá khứ là Completed
        const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        
        const createdTime = new Date(currentDate);
        createdTime.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0);

        const bookingRes = await pool.request()
          .input("BookingCode", sql.NVarChar, bookingCode)
          .input("UserID", sql.Int, player.UserID)
          .input("BookingType", sql.NVarChar, bookingType)
          .input("BookingDate", sql.Date, dateStr)
          .input("CourtFee", sql.Decimal, courtFee)
          .input("CoachFee", sql.Decimal, coachFee)
          .input("DiscountAmount", sql.Decimal, 0)
          .input("TotalAmount", sql.Decimal, totalAmount)
          .input("OriginalAmount", sql.Decimal, totalAmount)
          .input("Status", sql.NVarChar, status)
          .input("PaymentMethod", sql.NVarChar, paymentMethod)
          .input("PaymentStatus", sql.NVarChar, "Paid")
          .input("CreatedAt", sql.DateTime, createdTime)
          .query(`
            INSERT INTO Bookings (
              BookingCode, UserID, BookingType, BookingDate,
              CourtFee, CoachFee, DiscountAmount, TotalAmount, OriginalAmount, Status,
              PaymentMethod, PaymentStatus, CreatedAt
            )
            OUTPUT INSERTED.BookingID
            VALUES (
              @BookingCode, @UserID, @BookingType, @BookingDate,
              @CourtFee, @CoachFee, @DiscountAmount, @TotalAmount, @OriginalAmount, @Status,
              @PaymentMethod, @PaymentStatus, @CreatedAt
            )
          `);
        const bookingId = bookingRes.recordset[0].BookingID;

        // 3.4 Tạo Booking Detail
        await pool.request()
          .input("BookingID", sql.Int, bookingId)
          .input("SlotID", sql.Int, slotId)
          .input("CourtID", sql.Int, court.CourtID)
          .input("CoachID", sql.Int, bookingType !== "Court" ? coach.CoachID : null)
          .input("CoachScheduleID", sql.Int, coachScheduleId)
          .input("BookingDate", sql.Date, dateStr)
          .input("CourtFee", sql.Decimal, courtFee)
          .input("CoachFee", sql.Decimal, coachFee)
          .input("SubTotal", sql.Decimal, totalAmount)
          .input("CreatedAt", sql.DateTime, createdTime)
          .query(`
            INSERT INTO BookingDetails (
              BookingID, SlotID, CourtID, CoachID, CoachScheduleID,
              BookingDate, StartTime, EndTime, CourtFee, CoachFee, SubTotal, CreatedAt
            )
            VALUES (
              @BookingID, @SlotID, @CourtID, @CoachID, @CoachScheduleID,
              @BookingDate, '${timeSlot.start}', '${timeSlot.end}', @CourtFee, @CoachFee, @SubTotal, @CreatedAt
            )
          `);

        // 3.5 Tạo Payment tương ứng để ghi nhận doanh thu
        const txCode = `SEED-TX-${dateStr.replace(/-/g, "")}-${Math.floor(100000 + Math.random() * 900000)}`;
        const payCode = `PAY-${bookingId}-${dateStr.replace(/-/g, "")}-${Math.floor(100000 + Math.random() * 900000)}`;
        await pool.request()
          .input("BookingID", sql.Int, bookingId)
          .input("PaymentMethod", sql.NVarChar, paymentMethod)
          .input("Amount", sql.Decimal, totalAmount)
          .input("TransactionCode", sql.NVarChar, txCode)
          .input("PaymentCode", sql.NVarChar, payCode)
          .input("Status", sql.NVarChar, "Paid")
          .input("PaidAt", sql.DateTime, createdTime)
          .input("CreatedAt", sql.DateTime, createdTime)
          .query(`
            INSERT INTO Payments (
              BookingID, PaymentMethod, Amount, TransactionCode, PaymentCode, GatewayResponse, Status, PaidAt, CreatedAt
            )
            VALUES (
              @BookingID, @PaymentMethod, @Amount, @TransactionCode, @PaymentCode, '{"seed": true}', 'Paid', @PaidAt, @CreatedAt
            )
          `);

        totalRevenue += totalAmount;
        totalBookings++;
      }
      console.log(`Đã tạo ${bookingsPerDay} đơn đặt lịch cho ngày ${dateStr}`);
    }

    console.log("\n==========================================");
    console.log(`🎉 Thành công! Đã tạo ${totalBookings} đơn hàng đã thanh toán.`);
    console.log(`💰 Tổng doanh thu tạo ra: ${totalRevenue.toLocaleString("vi-VN")} VND`);
    console.log("==========================================");

  } catch (err) {
    console.error("❌ Lỗi khi nạp dữ liệu doanh thu:", err);
  } finally {
    process.exit(0);
  }
}

main();
