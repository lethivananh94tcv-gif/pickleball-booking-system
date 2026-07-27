import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function main() {
  const pool = await getPool();
  try {
    console.log("Creating UserFavorites table if not exists...");
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.tables WHERE name = 'UserFavorites'
      )
      BEGIN
        CREATE TABLE UserFavorites (
          FavoriteID INT IDENTITY(1,1) PRIMARY KEY,
          UserID INT NOT NULL,
          TargetType NVARCHAR(20) NOT NULL CHECK (TargetType IN ('Court', 'Coach')),
          TargetID INT NOT NULL,
          CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
          FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
          CONSTRAINT UQ_UserFavorites_Target UNIQUE (UserID, TargetType, TargetID)
        );
        PRINT 'Table UserFavorites created successfully!';
      END
      ELSE
      BEGIN
        PRINT 'Table UserFavorites already exists!';
      END
    `);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
