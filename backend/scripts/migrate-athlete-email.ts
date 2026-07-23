import { getPool } from "../src/database/connection";

async function main() {
  const pool = await getPool();
  try {
    console.log("Checking and adding Email column to TournamentRegistrationAthletes table...");
    
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('TournamentRegistrationAthletes') 
          AND name = 'Email'
      )
      BEGIN
        ALTER TABLE TournamentRegistrationAthletes ADD Email NVARCHAR(255) NULL;
        PRINT 'Column Email added successfully!';
      END
      ELSE
      BEGIN
        PRINT 'Column Email already exists!';
      END
    `);

    console.log("Database migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
