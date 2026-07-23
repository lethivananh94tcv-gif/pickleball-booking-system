import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";
import sql from "mssql";

async function run() {
  const pool = await getPool();
  try {
    // Find User
    const userRes = await pool.request()
      .input("Name", sql.NVarChar, "%van anh%")
      .query("SELECT UserID, FullName, Email FROM Users WHERE FullName LIKE @Name");

    if (userRes.recordset.length === 0) {
      console.log("❌ No user matching 'van anh' was found.");
      process.exit(1);
    }

    // List all users found
    console.log("Found matches:");
    console.table(userRes.recordset);

    // Update all matching users to be safe or update the first one
    const user = userRes.recordset[0];
    const uid = user.UserID;
    console.log(`🔍 Selecting User: [ID: ${uid}] "${user.FullName}" (${user.Email})`);

    console.log(`🔄 Updating email to: lethivananh.94tcv@gmail.com ...`);
    await pool.request()
      .input("UserID", sql.Int, uid)
      .input("Email", sql.NVarChar, "lethivananh.94tcv@gmail.com")
      .query("UPDATE Users SET Email = @Email WHERE UserID = @UserID");

    console.log(`✅ Success! Updated email for ${user.FullName} to lethivananh.94tcv@gmail.com`);
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
