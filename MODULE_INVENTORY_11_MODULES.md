# Pickleball Booking System (PCS) - 11 Modules Inventory

Dự án hiện tại được chia thành 11 module chức năng lớn để đảm bảo khả năng mở rộng và quản lý nghiệp vụ.

## 1. User Management Module (Module Người Dùng)
- **Tên tiếng Việt**: Quản lý Người dùng & Phân quyền
- **Mô tả**: Xử lý đăng ký, đăng nhập, xác thực OTP, quản lý hồ sơ và phân quyền hệ thống.
- **Actor**: Guest, Player, Coach, Staff, Admin
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: `/login`, `/register`, `/verify-otp`, `/profile`, `/forgot-password`
- **API Backend**: `/api/auth/*`, `/api/users/*`, `/api/roles/*`
- **Bảng DB**: `Users`, `Roles`, `UserRoles`

## 2. Court Management Module (Module Sân bãi)
- **Tên tiếng Việt**: Quản lý Sân Pickleball & Bảo trì
- **Mô tả**: Tạo, sửa, xóa, lấy danh sách sân, quản lý trạng thái sân (hoạt động/bảo trì).
- **Actor**: Admin, Staff, Player (chỉ xem)
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: `/courts`, `/admin/courts`
- **API Backend**: `/api/courts/*`, `/api/maintenance/*`
- **Bảng DB**: `Courts`, `CourtMaintenance`

## 3. Booking Management Module (Module Đặt Sân)
- **Tên tiếng Việt**: Quản lý Đặt sân & Combo
- **Mô tả**: Cho phép khách hàng đặt sân theo giờ, đặt nhiều slot liên tiếp (team booking), đặt combo cố định.
- **Actor**: Player, Staff
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: `/bookings`, `/combo`, `/admin/bookings`
- **API Backend**: `/api/bookings/*`
- **Bảng DB**: `Bookings`, `BookingSlots`, `Combos`

## 4. Coach Management Module (Module Huấn luyện viên)
- **Tên tiếng Việt**: Quản lý Huấn luyện viên
- **Mô tả**: Cho phép HLV đăng ký lịch rảnh, quản lý học viên. Người chơi có thể thuê HLV.
- **Actor**: Coach, Player, Admin
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: `/coaches`, `/coach-dashboard`
- **API Backend**: `/api/coaches/*`
- **Bảng DB**: `Coaches`, `CoachAvailability`, `CoachBookings`

## 5. Player Matching & Playgroups Module (Module Giao lưu)
- **Tên tiếng Việt**: Giao lưu & Tìm đồng đội
- **Mô tả**: Tổ chức các nhóm chơi, mời người khác tham gia (play-invitations), tự động ghép cặp theo trình độ (player-matching).
- **Actor**: Player
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: `/matching`, nhóm giao lưu trên `/profile`
- **API Backend**: `/api/matching/*`, `/api/playgroups/*`, `/api/play-invitations/*`
- **Bảng DB**: `Playgroups`, `PlaygroupMembers`, `MatchRequests`

## 6. Payment & Refund Module (Module Thanh toán)
- **Tên tiếng Việt**: Thanh toán & Hoàn tiền
- **Mô tả**: Tích hợp cổng thanh toán (PayOS), quản lý giao dịch, tạo yêu cầu hoàn tiền khi hủy sân hợp lệ.
- **Actor**: Player, Admin, Staff
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: `/payment`, `/refunds`, `/admin/transactions`
- **API Backend**: `/api/payments/*`, `/api/refunds/*`
- **Bảng DB**: `Payments`, `Refunds`, `Transactions`

## 7. Promotion Module (Module Khuyến mãi)
- **Tên tiếng Việt**: Quản lý Khuyến mãi & Voucher
- **Mô tả**: Tạo các chương trình khuyến mãi, voucher giảm giá áp dụng khi đặt sân.
- **Actor**: Admin, Player (áp dụng)
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: `/promotions`, `/admin/promotions`
- **API Backend**: `/api/promotions/*`
- **Bảng DB**: `Promotions`, `Vouchers`, `UserVouchers`

## 8. Review Module (Module Đánh giá)
- **Tên tiếng Việt**: Đánh giá & Phản hồi
- **Mô tả**: Người chơi đánh giá chất lượng sân hoặc chất lượng HLV sau khi sử dụng dịch vụ.
- **Actor**: Player
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: Hiển thị trên `/courts/:id` và `/coaches/:id`
- **API Backend**: `/api/reviews/*`
- **Bảng DB**: `Reviews`

## 9. Notification Module (Module Thông báo)
- **Tên tiếng Việt**: Thông báo & Email
- **Mô tả**: Gửi thông báo in-app, SMS, hoặc Email (Nodemailer) cho các sự kiện: đặt sân thành công, hủy sân, có người mời giao lưu.
- **Actor**: System, All Roles
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: `/notifications`, chuông thông báo header
- **API Backend**: `/api/notifications/*`
- **Bảng DB**: `Notifications`, `EmailLogs`

## 10. Admin & Reports Module (Module Báo cáo & Nhân sự)
- **Tên tiếng Việt**: Báo cáo thống kê & Quản lý nhân sự
- **Mô tả**: Quản lý ca làm việc của Staff (operations), xuất báo cáo doanh thu (revenue), thống kê hệ thống (systemlogs).
- **Actor**: Admin, Staff
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + DB)
- **Màn hình Frontend**: `/admin`, `/admin/reports`, `/staff`
- **API Backend**: `/api/reports/*`, `/api/revenue/*`, `/api/staff/*`, `/api/operations/*`
- **Bảng DB**: `SystemLogs`, `StaffShifts`

## 11. AI Assistant Module (Module AI)
- **Tên tiếng Việt**: Trợ lý ảo & Phân tích thông minh
- **Mô tả**: Tích hợp Google Gemini (genai) để chat hỗ trợ khách hàng, phân tích trình độ người chơi, gợi ý sân/HLV phù hợp.
- **Actor**: Player, Guest, System
- **Trạng thái**: Đã hoàn thành (Frontend + Backend + Python/FastAPI Service)
- **Màn hình Frontend**: Chatbot Widget
- **API Backend**: `/api/ai/*` (Next.js proxy tới FastAPI)
- **Bảng DB**: Không lưu cứng (cache in-memory / NoSQL hoặc call trực tiếp API)
