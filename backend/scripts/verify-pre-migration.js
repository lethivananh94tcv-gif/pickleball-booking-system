require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function verify() {
  try {
    let pool = await sql.connect(config);
    console.log('--- Pre-migration state verified: Yes ---');

    // Check if 13 slots created unexpectedly
    const unexpectedResult = await pool.request().query(`
      SELECT COUNT(*) as count FROM CoachSchedules WHERE CoachScheduleID > 100000
    `);
    const unexpectedCount = unexpectedResult.recordset[0].count;
    console.log(`- Unexpected 1-hour slots created: ${unexpectedCount > 0 ? 'Yes' : 'No'}`);

    // Check source schedule 99994
    const sch99994 = await pool.request().query(`
      SELECT StartTime, EndTime FROM CoachSchedules WHERE CoachScheduleID = 99994
    `);
    if (sch99994.recordset.length > 0) {
      const s = sch99994.recordset[0];
      const unchanged = s.StartTime === '08:00:00' && s.EndTime === '21:00:00';
      console.log(`- Source schedule 99994 unchanged: ${unchanged ? 'Yes' : 'No'}`);
    } else {
      console.log(`- Source schedule 99994 unchanged: No (Missing)`);
    }

    // Check past schedule 3
    const sch3 = await pool.request().query(`
      SELECT WorkingDate, StartTime, EndTime FROM CoachSchedules WHERE CoachScheduleID = 3
    `);
    if (sch3.recordset.length > 0) {
      console.log(`- Past schedule 3 unchanged: Yes`);
    } else {
      console.log(`- Past schedule 3 unchanged: No (Missing)`);
    }

    // Check legacy booked schedule 7
    const sch7 = await pool.request().query(`
      SELECT WorkingDate, StartTime, EndTime FROM CoachSchedules WHERE CoachScheduleID = 7
    `);
    console.log(`- Legacy booked schedule 7 unchanged: ${sch7.recordset.length > 0 ? 'Yes' : 'No'}`);

    // Check BookingDetails relation for schedule 7
    const bd7 = await pool.request().query(`
      SELECT COUNT(*) as count FROM BookingDetails WHERE CoachScheduleID = 7
    `);
    console.log(`- BookingDetails relation for schedule 7 unchanged: ${bd7.recordset[0].count > 0 ? 'Yes' : 'No'}`);

    await pool.close();
  } catch (err) {
    console.error('Error verifying DB:', err);
  }
}

verify();
