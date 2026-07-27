import * as favRepo from "./favorites.repository";
import { getPool, sql } from "@/database/connection";

export async function getFavorites(userId: number) {
  return favRepo.getUserFavorites(userId);
}

export async function toggleFavorite(userId: number, targetType: "Court" | "Coach", targetId: number): Promise<boolean> {
  const pool = await getPool();
  
  // Validate target exists
  if (targetType === "Court") {
    const res = await pool.request()
      .input("ID", sql.Int, targetId)
      .query("SELECT TOP 1 CourtID FROM Courts WHERE CourtID = @ID");
    if (res.recordset.length === 0) {
      throw new Error("Không tìm thấy sân được yêu cầu");
    }
  } else if (targetType === "Coach") {
    const res = await pool.request()
      .input("ID", sql.Int, targetId)
      .query("SELECT TOP 1 CoachID FROM Coaches WHERE CoachID = @ID");
    if (res.recordset.length === 0) {
      throw new Error("Không tìm thấy huấn luyện viên được yêu cầu");
    }
  } else {
    throw new Error("Loại đối tượng yêu thích không hợp lệ");
  }

  const exists = await favRepo.isFavoriteExists(userId, targetType, targetId);
  if (exists) {
    await favRepo.removeFavorite(userId, targetType, targetId);
    return false; // No longer favorite
  } else {
    await favRepo.addFavorite(userId, targetType, targetId);
    return true; // Now favorite
  }
}
