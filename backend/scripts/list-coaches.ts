import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function listCoaches() {
  console.log("🔍 Đang kết nối Database để lấy danh sách Huấn luyện viên...");
  const pool = await getPool();
  try {
    const res = await pool.request().query(`
      SELECT 
        u.UserID, 
        u.Email, 
        u.FullName, 
        u.PhoneNumber, 
        c.Biography, 
        c.Specialization, 
        c.SkillLevel, 
        c.HourlyRate, 
        c.Status as CoachStatus
      FROM Users u
      INNER JOIN UserRoles ur ON u.UserID = ur.UserID
      INNER JOIN Roles r ON ur.RoleID = r.RoleID
      LEFT JOIN Coaches c ON u.UserID = c.UserID
      WHERE r.RoleName = 'Coach'
    `);

    console.log(`\n=== TÌM THẤY ${res.recordset.length} HUẤN LUYỆN VIÊN ===\n`);
    res.recordset.forEach((coach, index) => {
      console.log(`${index + 1}. HLV: ${coach.FullName} (ID: ${coach.UserID})`);
      console.log(`   - Email: ${coach.Email}`);
      console.log(`   - Điện thoại: ${coach.PhoneNumber || "Chưa cập nhật"}`);
      console.log(`   - Cấp trình độ: ${coach.SkillLevel || "Chưa thiết lập"}`);
      console.log(`   - Phí thuê: ${coach.HourlyRate ? coach.HourlyRate.toLocaleString("vi-VN") + " VNĐ/giờ" : "Chưa thiết lập"}`);
      console.log(`   - Trạng thái hoạt động: ${coach.CoachStatus || "Chưa thiết lập"}`);
      console.log(`   - Mật khẩu mặc định trong hệ thống test: Password123! hoặc 123456\n`);
    });

  } catch (error) {
    console.error("❌ Lỗi truy vấn danh sách HLV:", error);
  } finally {
    process.exit(0);
  }
}

listCoaches();
