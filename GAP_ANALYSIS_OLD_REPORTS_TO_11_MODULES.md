    # Gap Analysis - Từ 6 Modules lên Full 11 Modules
Dự án: Pickleball Booking System (PCS)

Báo cáo này phân tích những thiếu sót (Gap) giữa bộ báo cáo cũ (6 modules cơ bản) và bộ báo cáo yêu cầu hiện tại (11 modules). Qua đó, đề xuất những phần cần bổ sung và điều chỉnh trong các file tài liệu.

## 1. Xác định sự chênh lệch (Gap)
**6 Modules cũ (Thông thường ở mức MVP - Minimum Viable Product):**
1. User Management
2. Court Management
3. Booking Management
4. Coach Management
5. Payment Module
6. Admin & Reports (cơ bản)

**5 Modules mới (Cần bổ sung):**
7. **Player Matching & Playgroups** (Giao lưu, tìm đội, tính điểm Elo)
8. **Promotion** (Mã giảm giá, Voucher)
9. **Review** (Đánh giá sân, đánh giá HLV)
10. **Notification** (Thông báo hệ thống, in-app, SMS, Email)
11. **AI Assistant** (Chatbot Gemini, phân tích thông minh)

## 2. Chi tiết cần cập nhật trên 5 File Báo Cáo

### A. Project Features Report
- **Giữ nguyên:** Logic của 6 modules cũ (tuy nhiên cần kiểm tra lại phần Hủy sân ở Booking có bị ảnh hưởng bởi Promotion hay không).
- **Cập nhật:** Bổ sung phần giới thiệu về việc tích hợp hệ sinh thái lớn hơn.
- **Bổ sung:** Thêm 5 sections mới mô tả chi tiết mục tiêu, input, output, business rules cho Playgroup, Promo, Review, Notification và AI. (Đặc biệt AI Assistant cần làm rõ việc call external LLM).

### B. Master Test Plan / Test Plan
- **Giữ nguyên:** Các định nghĩa về Scope, Test Level, Tool test (Jest, Postman).
- **Cập nhật:** Trong phần "Test Environment", bổ sung môi trường test cho AI (để tránh tốn token/billing thật). Bổ sung phần "Risks" rủi ro AI call bị rate-limit.
- **Bổ sung:** Thêm Performance Testing cho phần "Player Matching" (thuật toán có thể chậm nếu DB lớn).

### C. Test Case Report
- **Giữ nguyên:** Các TC về Đăng nhập, Đặt sân, Thanh toán.
- **Cập nhật:** Trong Booking TC, thêm luồng "Đặt sân có dùng Voucher" và "Gửi Notification sau khi đặt sân thành công".
- **Bổ sung:** Thêm tối thiểu 20-30 Test Cases mới cho 5 modules mở rộng. Ví dụ: AI trả lời sai định dạng, AI timeout; Review không cho phép spam; Tính Elo khi Match thắng/thua.

### D. Test Data Report
- **Giữ nguyên:** Dữ liệu mẫu của Player, Court.
- **Cập nhật:** Trong bảng Bookings data mẫu, thêm cột trạng thái đã review hay chưa để test Review module.
- **Bổ sung:** Tạo các bộ data "Mã Promo hợp lệ", "Mã Promo hết hạn", "Dữ liệu context cho AI", "Data User có các mức Elo khác nhau".

### E. Postman Collection Report
- **Giữ nguyên:** Cấu trúc folder của collection.
- **Cập nhật:** Ở API Booking, bổ sung params truyền mã Promotion. Ở API Payment webhook, chú ý luồng sinh Notification.
- **Bổ sung:** Tạo thêm 5 Folders trong Postman: `Playgroups`, `Promotions`, `Reviews`, `Notifications`, `AI`. Liệt kê endpoint `/api/ai/chat` và `/api/matching`.

## 3. Lời khuyên khi nộp báo cáo (Submit)
- **Thống nhất (Consistency)**: Đảm bảo nếu một API được nhắc ở Postman Report, thì phải có Test Case tương ứng trong Test Case Report.
- **Business Rule Tréo ngoe**: Đánh giá 1 sao (Review) có tự động thông báo (Notification) cho Admin không? Nếu có, hãy ghi luồng này vào Project Features.
- **Phạm vi bảo vệ đồ án**: Giảng viên thường sẽ hỏi rất kỹ module "AI Assistant" và "Player Matching" (vì nó phức tạp). Hãy chắc chắn báo cáo test cover được các trường hợp lỗi (Negative cases) của 2 module này.
