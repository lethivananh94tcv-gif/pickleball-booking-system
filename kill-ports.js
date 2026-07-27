const { execSync } = require('child_process');

const ports = [3000, 5000, 8000];

console.log('🔄 Đang kiểm tra và giải phóng các cổng: ' + ports.join(', ') + '...');

ports.forEach(port => {
  try {
    let cmd = '';
    if (process.platform === 'win32') {
      cmd = `netstat -ano | findstr :${port} | findstr LISTENING`;
    } else {
      cmd = `lsof -t -i:${port}`;
    }
    
    const stdout = execSync(cmd).toString().trim();
    if (stdout) {
      const pids = new Set();
      stdout.split('\n').forEach(line => {
        if (process.platform === 'win32') {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') pids.add(pid);
        } else {
          const pid = line.trim();
          if (pid) pids.add(pid);
        }
      });

      pids.forEach(pid => {
        try {
          console.log(`💀 Đang tắt tiến trình PID ${pid} chiếm giữ cổng ${port}...`);
          if (process.platform === 'win32') {
            execSync(`taskkill /f /pid ${pid}`);
          } else {
            execSync(`kill -9 ${pid}`);
          }
        } catch (err) {
          // Bỏ qua lỗi nếu tiến trình đã tự đóng trước đó
        }
      });
    }
  } catch (err) {
    // execSync ném lỗi nếu không tìm thấy tiến trình (lệnh exit code 1) -> bỏ qua bình thường
  }
});

console.log('✅ Tất cả các cổng đã sẵn sàng!');
