import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function migrateRefundCodes() {
  const pool = await getPool();
  try {
    console.log("Fetching all existing refunds...");
    const res = await pool.request().query(`
      SELECT RefundID, BookingID, RegistrationID, RefundCode, RequestedAt 
      FROM Refunds
    `);

    const records = res.recordset;
    console.log(`Found ${records.length} refund records.`);

    let count = 0;
    for (const record of records) {
      const { RefundID, BookingID, RegistrationID, RefundCode, RequestedAt } = record;
      
      const requestedDate = new Date(RequestedAt);
      // Adjust to UTC+7 timezone
      const vnDate = new Date(requestedDate.getTime() + 7 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const yy = String(vnDate.getUTCFullYear()).slice(-2);
      const mm = pad(vnDate.getUTCMonth() + 1);
      const dd = pad(vnDate.getUTCDate());
      const dateStr = `${yy}${mm}${dd}`;

      let newCode = "";
      if (RegistrationID !== null) {
        newCode = `RF-T-${dateStr}-${RegistrationID}`;
      } else {
        newCode = `RF-${dateStr}-${BookingID}`;
      }

      if (newCode === RefundCode) {
        console.log(`[RefundID ${RefundID}] Code is already clean: ${RefundCode}`);
        continue;
      }

      console.log(`[RefundID ${RefundID}] Updating code from "${RefundCode}" to "${newCode}"...`);
      
      await pool.request()
        .input("RefundID", RefundID)
        .input("NewCode", newCode)
        .query(`
          UPDATE Refunds 
          SET RefundCode = @NewCode 
          WHERE RefundID = @RefundID
        `);
      count++;
    }

    console.log(`Successfully updated ${count} refund codes!`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrateRefundCodes();
