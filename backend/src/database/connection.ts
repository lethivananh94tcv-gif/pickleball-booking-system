import sql from "mssql";
import { databaseConfig } from "@/config/database";

// Biến lưu trữ Connection Pool (hồ bơi kết nối) để tái sử dụng
// Giúp tránh việc tạo kết nối mới liên tục mỗi khi gọi database, tăng hiệu suất.
let pool: sql.ConnectionPool | null = null;

/**
 * Hàm khởi chạy các tác vụ chạy ngầm (background jobs/cron jobs)
 * Các tác vụ này chạy định kỳ để tự động hóa một số quy trình hệ thống.
 */
function startBackgroundJobs() {
  const globalAny = global as any;
  
  // Đảm bảo cron job chỉ được khởi chạy 1 lần duy nhất trong suốt vòng đời của server
  if (globalAny.__cronRunning) return;
  globalAny.__cronRunning = true;

  console.log("[System] Bắt đầu background jobs: Tự động dọn dẹp DB...");

  // Thiết lập vòng lặp chạy mỗi 10 giây
  setInterval(async () => {
    try {
      // Dynamic import (import động) để tránh lỗi vòng lặp phụ thuộc (circular dependency)
      // do connection.ts được gọi ở rất nhiều nơi
      const { releaseExpiredBookings } = await import("@/modules/bookings/bookings.service");
      const { repoMarkCompletedExpiredCheckins } = await import("@/modules/bookings/bookings.repository");
      
      // Chạy tác vụ 1: Giải phóng các đơn đặt sân bị quá hạn giữ chỗ hoặc quá giờ chơi
      const res = await releaseExpiredBookings();
      // Chạy tác vụ 2: Tự động đánh dấu hoàn thành (Completed) cho các đơn đã Check-in nhưng hết giờ chơi
      const completed = await repoMarkCompletedExpiredCheckins();

      // Chạy tác vụ giải phóng đăng ký giải đấu hết hạn 10 phút thanh toán
      const { releaseExpiredTournamentRegistrations } = await import("@/modules/tournaments/tournaments.service");
      const releasedTournaments = await releaseExpiredTournamentRegistrations().catch(err => {
        console.error("[Cron] Lỗi chạy release tournament registrations:", err);
        return { releasedCount: 0 };
      });
      
      // Chạy tác vụ 3: Huấn luyện lại và đối soát tự động AI
      const { runAICronJob } = await import("@/modules/ai/ai-analytics.service");
      await runAICronJob().catch(err => console.error("[Cron] Lỗi chạy AI cron task:", err));

      // Chạy tác vụ 4: Tự động kích hoạt/hết hạn voucher AI
      const { runPromotionsStatusScheduler } = await import("@/modules/ai/ai-analytics.service");
      await runPromotionsStatusScheduler().catch(err => console.error("[Cron] Lỗi chạy AI promotion scheduler:", err));

      // Chỉ log ra console nếu thực sự có đơn được xử lý để tránh spam log
      if (res.releasedHoldings > 0 || res.autoCheckedIn > 0 || completed > 0 || releasedTournaments.releasedCount > 0) {
        console.log(`[Cron] Hủy ${res.releasedHoldings} đơn hết hạn, Auto Check-in ${res.autoCheckedIn}, Auto Complete ${completed}, Hủy ${releasedTournaments.releasedCount} đăng ký giải hết hạn`);
      }
    } catch (err) {
      console.error("[Cron] Lỗi chạy background task:", err);
    }
  }, 10 * 1000); // 10 giây chạy 1 lần để test cho nhanh, production có thể để 1 phút
}

/**
 * Hàm lấy Connection Pool để thực thi các câu lệnh SQL.
 * Luôn gọi hàm này trước khi query DB.
 */
export async function getPool() {
  // Pattern Singleton: Nếu đã có pool rồi thì trả về luôn, không tạo mới
  if (pool) return pool;

  // Nếu chưa có, tiến hành kết nối đến DB bằng config đã nạp từ file database.ts
  pool = await sql.connect(databaseConfig);

  // Sau khi kết nối DB thành công lần đầu tiên, khởi động background jobs
  startBackgroundJobs();

  // Self-migration (Tự động cập nhật cấu trúc DB)
  // Kiểm tra xem bảng Users đã có cột LockReason chưa, nếu chưa thì tự động thêm vào
  // Rất hữu ích khi deploy mà quên chạy script cập nhật DB
  try {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Users') AND name = 'LockReason'
      )
      BEGIN
        ALTER TABLE Users ADD LockReason NVARCHAR(255) NULL;
      END
    `);
  } catch (err) {
    console.error("Migration error (ensuring LockReason column in Users):", err);
  }

  // Self-migration for Tournaments ImageURL column
  try {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Tournaments') AND name = 'ImageURL'
      )
      BEGIN
        ALTER TABLE Tournaments ADD ImageURL NVARCHAR(500) NULL;
      END
    `);
  } catch (err) {
    console.error("Migration error (ensuring ImageURL column in Tournaments):", err);
  }

  // Self-migration for Tournaments OrganizerName column
  try {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Tournaments') AND name = 'OrganizerName'
      )
      BEGIN
        ALTER TABLE Tournaments ADD OrganizerName NVARCHAR(255) NULL;
      END
    `);
  } catch (err) {
    console.error("Migration error (ensuring OrganizerName column in Tournaments):", err);
  }

  // Self-migration for Tournaments IsHidden column
  try {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Tournaments') AND name = 'IsHidden'
      )
      BEGIN
        ALTER TABLE Tournaments ADD IsHidden BIT DEFAULT 0 NOT NULL;
      END
    `);
  } catch (err) {
    console.error("Migration error (ensuring IsHidden column in Tournaments):", err);
  }

  // Self-migration for AI Promotions columns
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Promotions') AND name = 'TargetCourtID')
      BEGIN
        ALTER TABLE Promotions ADD TargetCourtID INT NULL;
        ALTER TABLE Promotions ADD CONSTRAINT FK_Promotions_TargetCourt FOREIGN KEY (TargetCourtID) REFERENCES Courts(CourtID);
      END

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Promotions') AND name = 'TargetHourStart')
      BEGIN
        ALTER TABLE Promotions ADD TargetHourStart INT NULL;
        ALTER TABLE Promotions ADD TargetHourEnd INT NULL;
      END

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Promotions') AND name = 'TargetDate')
      BEGIN
        ALTER TABLE Promotions ADD TargetDate DATE NULL;
      END
    `);
  } catch (err) {
    console.error("Migration error (ensuring AI columns in Promotions):", err);
  }

  // Trả về pool kết nối
  return pool;
}

// Export đối tượng sql để các file khác có thể dùng các kiểu dữ liệu của mssql (ví dụ: sql.Int, sql.NVarChar)
export { sql };