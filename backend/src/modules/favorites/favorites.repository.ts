import { getPool, sql } from "@/database/connection";

export interface UserFavoriteRecord {
  FavoriteID: number;
  UserID: number;
  TargetType: "Court" | "Coach";
  TargetID: number;
  CreatedAt: string;
}

export async function getUserFavorites(userId: number): Promise<Array<{ TargetType: string; TargetID: number }>> {
  const pool = await getPool();
  const res = await pool.request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT TargetType, TargetID 
      FROM UserFavorites 
      WHERE UserID = @UserID
    `);
  return res.recordset;
}

export async function isFavoriteExists(userId: number, targetType: string, targetId: number): Promise<boolean> {
  const pool = await getPool();
  const res = await pool.request()
    .input("UserID", sql.Int, userId)
    .input("TargetType", sql.NVarChar(20), targetType)
    .input("TargetID", sql.Int, targetId)
    .query(`
      SELECT TOP 1 FavoriteID 
      FROM UserFavorites 
      WHERE UserID = @UserID 
        AND TargetType = @TargetType 
        AND TargetID = @TargetID
    `);
  return res.recordset.length > 0;
}

export async function addFavorite(userId: number, targetType: string, targetId: number): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("UserID", sql.Int, userId)
    .input("TargetType", sql.NVarChar(20), targetType)
    .input("TargetID", sql.Int, targetId)
    .query(`
      INSERT INTO UserFavorites (UserID, TargetType, TargetID, CreatedAt)
      VALUES (@UserID, @TargetType, @TargetID, GETDATE())
    `);
}

export async function removeFavorite(userId: number, targetType: string, targetId: number): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("UserID", sql.Int, userId)
    .input("TargetType", sql.NVarChar(20), targetType)
    .input("TargetID", sql.Int, targetId)
    .query(`
      DELETE FROM UserFavorites 
      WHERE UserID = @UserID 
        AND TargetType = @TargetType 
        AND TargetID = @TargetID
    `);
}
