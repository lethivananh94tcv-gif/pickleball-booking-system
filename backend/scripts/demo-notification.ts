import { getPool, sql } from "../src/database/connection";
import { createNotification } from "../src/modules/notifications/notifications.service";

async function main() {
  try {
    const pool = await getPool();
    
    // 1. Find the group "Team sang & Thanh Hải Trần"
    const groupRes = await pool.request()
      .query(`SELECT GroupID, GroupName, CreatedBy FROM PlayingGroups WHERE GroupName LIKE N'%Team sang & Thanh Hải Trần%'`);
      
    if (groupRes.recordset.length === 0) {
      console.log("Group not found.");
      process.exit(1);
    }
    
    const targetGroup = groupRes.recordset[0];
    const receiverId = targetGroup.CreatedBy;
    console.log(`Found group: ${targetGroup.GroupName}, Leader ID: ${receiverId}`);

    // Create notification
    await createNotification({
      userId: receiverId,
      title: "Đối thủ đã đặt sân",
      message: `Đội của đối thủ đã đặt sân thành công cho trận giao hữu ngày 2026-07-15 từ 18:00 đến 20:00.`,
      notificationType: "Matching",
    });

    console.log("Notification sent successfully to UserID:", receiverId);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
