const fs = require('fs');
const path = require('path');
const mssql = require('mssql');
require('dotenv').config();

async function run() {
  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
    requestTimeout: 60000,
  };

  try {
    console.log('Connecting to database...');
    const pool = await mssql.connect(config);
    console.log('Connected. Running migration script (Dry Run mode defaults to 1)...');

    const sqlScript = fs.readFileSync(path.join(__dirname, 'migrate-coach-schedules.sql'), 'utf8');

    // We can't just pool.query(sqlScript) if it has GO statements.
    // We should split by GO and execute in batches if necessary, or execute as one big script if no GO.
    // Let's check if there are GO statements.
    const batches = sqlScript.split(/^\s*GO\s*$/im);
    for(const batch of batches) {
      if(batch.trim()) {
        const result = await pool.request().query(batch);
        if (result.recordsets) {
           result.recordsets.forEach((rs, i) => {
             console.log(`\n--- Recordset ${i + 1} ---`);
             console.table(rs);
           });
        }
      }
    }

    console.log('Migration script executed.');
    process.exit(0);
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  }
}

run();
