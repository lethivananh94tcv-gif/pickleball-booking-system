import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";
import bcrypt from "bcryptjs";

async function resetCoachPasswords() {
  console.log("🔒 Đang kết nối Database để đặt lại mật khẩu cho tất cả Huấn luyện viên...");
  const pool = await getPool();
  try {
    // 1. Tạo BCrypt Hash cho mật khẩu mới "Coach@123"
    const newPassword = "Coach@123";
    const rounds = 10;
    const newHash = bcrypt.hashSync(newPassword, rounds);
    console.log(`🔑 Đã tạo hash thành công cho mật khẩu "${newPassword}"`);

    // 2. Lấy danh sách ID của các User có quyền Coach
    const listRes = await pool.request().query(`
      SELECT DISTINCT u.UserID, u.Email, u.FullName
      FROM Users u
      INNER JOIN UserRoles ur ON u.UserID = ur.UserID
      INNER JOIN Roles r ON ur.RoleID = r.RoleID
      WHERE r.RoleName = 'Coach'
    `);

    const coaches = listRes.recordset;
    if (coaches.length === 0) {
      console.log("⚠️ Không tìm thấy huấn luyện viên nào trong hệ thống để cập nhật!");
      process.exit(0);
    }

    console.log(`📌 Tìm thấy ${coaches.length} HLV cần đổi mật khẩu.`);

    // 3. Thực hiện cập nhật mật khẩu trong database
    const userIds = coaches.map(c => c.UserID).join(", ");
    await pool.request()
      .input("PasswordHash", sql.NVarChar, newHash)
      .query(`
        UPDATE Users 
        SET PasswordHash = @PasswordHash 
        WHERE UserID IN (${userIds})
      `);

    console.log("\n=======================================");
    console.log("✅ ĐÃ ĐẶT LẠI MẬT KHẨU THÀNH CÔNG!");
    console.log(`Tất cả ${coaches.length} HLV đã được đổi mật khẩu thành: "${newPassword}"`);
    console.log("=======================================\n");

    coaches.forEach((c, idx) => {
      console.log(`${idx + 1}. HLV: ${c.FullName} | Email: ${c.Email}`);
    });

  } catch (error) {
    console.error("❌ Lỗi đặt lại mật khẩu HLV:", error);
  } finally {
    process.exit(0);
  }
}

resetCoachPasswords();
