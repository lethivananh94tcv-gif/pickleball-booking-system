import { getPool } from "../src/database/connection";

async function main() {
  const pool = await getPool();
  try {
    console.log("Adding RoundScheduleConfig column to TournamentDivisions table...");
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('TournamentDivisions') 
          AND name = 'RoundScheduleConfig'
      )
      BEGIN
        ALTER TABLE TournamentDivisions ADD RoundScheduleConfig NVARCHAR(MAX) NULL;
        PRINT 'Column RoundScheduleConfig added successfully!';
      END
      ELSE
      BEGIN
        PRINT 'Column RoundScheduleConfig already exists!';
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
