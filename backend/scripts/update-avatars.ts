import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function updateAvatars() {
  const pool = await getPool();
  try {
    // Update Quynh Anh (ID 15)
    await pool.request()
      .input("AvatarURL", "/images/coaches/hlv2.jpg")
      .input("UserID", 15)
      .query("UPDATE Users SET AvatarURL = @AvatarURL WHERE UserID = @UserID");
    console.log("Updated Quynh Anh (ID 15) successfully.");

    // Update Tran Bao Tram (ID 17)
    await pool.request()
      .input("AvatarURL", "/images/coaches/hlv4.jpg")
      .input("UserID", 17)
      .query("UPDATE Users SET AvatarURL = @AvatarURL WHERE UserID = @UserID");
    console.log("Updated Tran Bao Tram (ID 17) successfully.");

  } catch (err) {
    console.error("Error updating database avatars:", err);
  } finally {
    process.exit(0);
  }
}

updateAvatars();
