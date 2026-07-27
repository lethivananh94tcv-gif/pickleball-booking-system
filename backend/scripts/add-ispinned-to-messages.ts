import { getPool } from "../src/database/connection";

async function run() {
  const pool = await getPool();
  try {
    await pool.request().query(`
      IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE Name = N'IsPinned' AND Object_ID = Object_ID(N'GroupMessages')
      )
      BEGIN
          ALTER TABLE GroupMessages ADD IsPinned BIT NOT NULL DEFAULT 0;
          PRINT 'Added IsPinned column to GroupMessages';
      END
      ELSE
      BEGIN
          PRINT 'IsPinned column already exists';
      END
    `);
    console.log("Migration completed.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

run();
