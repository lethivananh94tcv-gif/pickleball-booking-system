const sql = require('mssql');

const config = {
    user: 'sa',
    password: '123456',
    server: '127.0.0.1',
    database: 'PCS_SYSTEM_5',
    options: {
        encrypt: false, // For local dev
        trustServerCertificate: true
    }
};

async function demo() {
    try {
        await sql.connect(config);
        
        const result = await sql.query(`SELECT GroupID, GroupName, CreatedBy FROM PlayingGroups WHERE GroupName LIKE N'%Team sang & Thanh Hải Trần%'`);
        if (result.recordset.length === 0) {
            console.log("Không tìm thấy nhóm.");
            process.exit(1);
        }
        
        const targetGroup = result.recordset[0];
        const receiverId = targetGroup.CreatedBy;
        console.log(`Tìm thấy nhóm: ${targetGroup.GroupName}, Leader ID: ${receiverId}`);
        
        await sql.query(`
            INSERT INTO Notifications (UserID, Title, Message, NotificationType, Status, CreatedAt)
            VALUES (${receiverId}, N'Đối thủ đã đặt sân', N'Đội của đối thủ đã đặt sân thành công cho trận giao hữu ngày 2026-07-15 từ 18:00 đến 20:00.', 'Matching', 'Unread', GETDATE())
        `);
        
        console.log("Đã gửi thông báo thành công!");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

demo();
