import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function main() {
  const pool = await getPool();
  try {
    console.log("Adding Rules column to Tournaments table...");
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Tournaments') 
          AND name = 'Rules'
      )
      BEGIN
        ALTER TABLE Tournaments ADD Rules NVARCHAR(MAX) NULL;
        PRINT 'Column Rules added successfully!';
      END
      ELSE
      BEGIN
        PRINT 'Column Rules already exists!';
      END
    `);
    console.log("Database altered successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
