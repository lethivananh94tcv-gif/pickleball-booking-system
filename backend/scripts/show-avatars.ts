import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function showAvatars() {
  const pool = await getPool();
  try {
    const res = await pool.request().query(`
      SELECT UserID, FullName, AvatarURL 
      FROM Users 
      WHERE UserID IN (15, 17)
    `);
    console.log("AVATARS:", res.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

showAvatars();
