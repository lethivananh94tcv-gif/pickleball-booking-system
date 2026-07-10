# Test Case Matrix - Full 11 Modules
Dự án: Pickleball Booking System (PCS)

Bảng dưới đây liệt kê các Test Case mẫu (đại diện) cho 11 modules, đảm bảo phủ đủ Positive, Negative, Validation, Role, và API Error. Có thể copy paste vào Excel.

| TC_ID | Module | Feature | Test Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority | Type |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC_USR_01 | User | Register | Đăng ký thành công | Khách ở màn hình Đăng ký | 1. Nhập thông tin. 2. Bấm Đăng ký | Email: `new@test.com`, Pass: `123456`, Name: `Test` | Tạo tài khoản, chuyển hướng OTP | | | High | Functional |
| TC_USR_02 | User | Register | Trùng email | Đã có user `admin@pcs.com` | 1. Nhập email trùng. 2. Bấm Đăng ký | Email: `admin@pcs.com` | Báo lỗi: "Email đã tồn tại" | | | Medium | Negative |
| TC_CRT_01 | Court | Add Court | Thêm sân hợp lệ | Login quyền Admin | 1. Vào Admin -> Sân. 2. Thêm mới | Name: `Sân 10`, Type: `Indoor` | Lưu DB, hiển thị Sân 10 | | | High | Role/Func |
| TC_CRT_02 | Court | Maintenance | Sân bảo trì thì không được đặt | Sân 1 đang bảo trì | 1. Vào trang đặt sân. 2. Chọn Sân 1 | Sân ID = 1 | Các slot bị disable, báo bảo trì | | | High | Functional |
| TC_BKG_01 | Booking | Multi-slot | Đặt 2 slot liên tiếp thành công | Login Player, có tiền/chưa pay | 1. Chọn ngày. 2. Chọn Slot 1 & 2. 3. Đặt | Date: Hôm nay, Slot: 1, 2 | Hệ thống hold slot, nhảy trang Pay | | | High | Functional |
| TC_BKG_02 | Booking | Validation | Đặt quá 2 tiếng (3 slots) | Login Player | 1. Chọn Slot 1,2,3. 2. Bấm Đặt | Slots: 1, 2, 3 | Nút Đặt bị disable hoặc báo lỗi max 120p | | | Medium | Validation|
| TC_BKG_03 | Booking | API Error | Race condition trùng slot | 2 User cùng nhìn thấy slot trống | 1. Cùng gọi API Đặt sân cùng lúc | Court 1, Slot 1 | User 1 được 201, User 2 bị 409 Conflict | | | High | API |
| TC_COA_01 | Coach | Set Avail | Đăng ký lịch rảnh | Login Coach | 1. Vào Dashboard. 2. Đăng ký rảnh | Slot 3, 4 | Lưu DB, Player nhìn thấy HLV rảnh | | | High | Functional |
| TC_PLY_01 | Playgroup | Create | Tạo nhóm giao lưu | Login Player | 1. Vào tab Matching. 2. Tạo nhóm | Name: `Gà con` | Nhóm được tạo, hiển thị danh sách | | | Medium | Functional |
| TC_PAY_01 | Payment | PayOS | Xử lý Webhook thành công | Đã có Booking trạng thái HOLD | 1. Postman gọi Webhook giả lập | `code: "00", bookingId: 10` | Booking chuyển PAID | | | High | Integration|
| TC_PAY_02 | Refund | Request | Hủy sân trước 24h hoàn 100% | Có booking ngày mai | 1. Vào lịch sử. 2. Bấm Hủy | Booking ID 12 | Status = Refund_Pending, tạo request 100%| | | High | Functional |
| TC_PRM_01 | Promo | Voucher | Mã KM hết hạn | Có mã EXPIRED | 1. Ở màn hình thanh toán nhập mã | Code: `TET2026` | Báo lỗi: "Mã đã hết hạn" | | | Medium | Validation|
| TC_REV_01 | Review | Write | Chỉ review sân đã chơi | Booking chưa chơi xong | 1. Cố ý gọi API review | `courtId: 1, rating: 5` | API trả về 403 Not completed | | | Medium | API/Neg |
| TC_NOT_01 | Notify | Email | Gửi mail khi đặt thành công | N/A | 1. Hoàn tất thanh toán | Booking ID 15 | Có bản ghi trong EmailLogs, nhận mail thật| | | Medium | Functional |
| TC_RPT_01 | Admin | Revenue | Chặn staff xem doanh thu | Login Staff | 1. Vào menu Revenue | URL: `/admin/revenue`| Chuyển hướng 403 Forbidden | | | High | Security |
| TC_AI_01 | AI | Chatbot | Chatbot trả lời thông tin sân | Màn hình ngoài | 1. Gõ "Sân VIP giá bao nhiêu" | Text: "Sân VIP" | Bot trả về thông tin giá chính xác | | | High | Functional |
| TC_AI_02 | AI | Fallback | AI Server down (503) | AI Server đang tắt | 1. Gõ tin nhắn vào Bot | N/A | UI báo "Bot đang bận", không crash app | | | Medium | API/Neg |
