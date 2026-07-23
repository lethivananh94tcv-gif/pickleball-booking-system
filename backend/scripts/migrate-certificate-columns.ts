import { getPool } from "../src/database/connection";

async function main() {
  const pool = await getPool();
  try {
    console.log("Checking and adding certificate columns to TournamentRegistrations table...");
    
    // 1. Add IsCertificateSent column
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('TournamentRegistrations') 
          AND name = 'IsCertificateSent'
      )
      BEGIN
        ALTER TABLE TournamentRegistrations ADD IsCertificateSent BIT DEFAULT 0;
        PRINT 'Column IsCertificateSent added successfully!';
      END
      ELSE
      BEGIN
        PRINT 'Column IsCertificateSent already exists!';
      END
    `);

    // 2. Add CertificateSentAt column
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('TournamentRegistrations') 
          AND name = 'CertificateSentAt'
      )
      BEGIN
        ALTER TABLE TournamentRegistrations ADD CertificateSentAt DATETIME NULL;
        PRINT 'Column CertificateSentAt added successfully!';
      END
      ELSE
      BEGIN
        PRINT 'Column CertificateSentAt already exists!';
      END
    `);

    console.log("Database migration for certificates completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
