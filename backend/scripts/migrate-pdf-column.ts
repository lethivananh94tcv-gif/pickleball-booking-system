import { getPool } from "../src/database/connection";

async function main() {
  const pool = await getPool();
  try {
    console.log("Checking and adding CertificatePdfUrl column to TournamentRegistrations table...");
    
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('TournamentRegistrations') 
          AND name = 'CertificatePdfUrl'
      )
      BEGIN
        ALTER TABLE TournamentRegistrations ADD CertificatePdfUrl NVARCHAR(500) NULL;
        PRINT 'Column CertificatePdfUrl added successfully!';
      END
      ELSE
      BEGIN
        PRINT 'Column CertificatePdfUrl already exists!';
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
