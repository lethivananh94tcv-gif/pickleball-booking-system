import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";
import bcrypt from "bcryptjs";

async function resetStaffPasswords() {
  console.log("🔒 Đang kết nối Database để đặt lại mật khẩu cho tất cả Nhân viên (Staff)...");
  const pool = await getPool();
  try {
    // 1. Tạo BCrypt Hash cho mật khẩu mới "Staff@123"
    const newPassword = "Staff@123";
    const rounds = 10;
    const newHash = bcrypt.hashSync(newPassword, rounds);
    console.log(`🔑 Đã tạo hash thành công cho mật khẩu "${newPassword}"`);

    // 2. Lấy danh sách ID của các User có quyền Staff
    const listRes = await pool.request().query(`
      SELECT DISTINCT u.UserID, u.Email, u.FullName, r.RoleName
      FROM Users u
      INNER JOIN UserRoles ur ON u.UserID = ur.UserID
      INNER JOIN Roles r ON ur.RoleID = r.RoleID
      WHERE r.RoleName LIKE '%Staff%'
    `);

    const staffUsers = listRes.recordset;
    if (staffUsers.length === 0) {
      console.log("⚠️ Không tìm thấy nhân viên (Staff) nào trong hệ thống để cập nhật!");
      process.exit(0);
    }

    console.log(`📌 Tìm thấy ${staffUsers.length} tài khoản Staff cần đổi mật khẩu.`);

    // 3. Thực hiện cập nhật mật khẩu trong database
    const userIds = staffUsers.map(s => s.UserID).join(", ");
    await pool.request()
      .input("PasswordHash", sql.NVarChar, newHash)
      .query(`
        UPDATE Users 
        SET PasswordHash = @PasswordHash 
        WHERE UserID IN (${userIds})
      `);

    console.log("\n=======================================");
    console.log("✅ ĐÃ ĐẶT LẠI MẬT KHẨU STAFF THÀNH CÔNG!");
    console.log(`Tất cả ${staffUsers.length} Staff đã được đổi mật khẩu thành: "${newPassword}"`);
    console.log("=======================================\n");

    staffUsers.forEach((s, idx) => {
      console.log(`${idx + 1}. Nhân viên: ${s.FullName} | Quyền: ${s.RoleName} | Email: ${s.Email}`);
    });

  } catch (error) {
    console.error("❌ Lỗi đặt lại mật khẩu Staff:", error);
  } finally {
    process.exit(0);
  }
}

resetStaffPasswords();
