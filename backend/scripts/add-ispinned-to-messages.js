const sql = require("mssql");
const dotenv = require("dotenv");
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  server: process.env.DB_SERVER || "localhost",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function run() {
  try {
    const pool = await sql.connect(config);
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
