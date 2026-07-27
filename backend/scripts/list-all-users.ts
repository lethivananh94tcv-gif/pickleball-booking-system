import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function listUsers() {
  const pool = await getPool();
  try {
    const res = await pool.request().query(`
      SELECT u.UserID, u.Email, u.FullName, r.RoleName
      FROM Users u
      LEFT JOIN UserRoles ur ON u.UserID = ur.UserID
      LEFT JOIN Roles r ON ur.RoleID = r.RoleID
      WHERE r.RoleName IN ('Admin', 'Manager', 'Staff')
    `);
    console.log(JSON.stringify(res.recordset, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

listUsers();
