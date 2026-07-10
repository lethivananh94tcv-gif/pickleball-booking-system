# Project Features - Full 11 Modules
Dự án: Pickleball Booking System (PCS)

---

## 1. User Management Module
- **Mục tiêu**: Xử lý toàn bộ vòng đời tài khoản và phân quyền.
- **Tính năng con**:
  - Đăng ký (Register) / Đăng nhập (Login).
  - Quản lý hồ sơ cá nhân (Cập nhật SĐT, Avatar, Email).
  - Lấy lại mật khẩu (Forgot Password / OTP).
  - Phân quyền (RBAC - Role Based Access Control).
- **Luồng nghiệp vụ chính**: User đăng ký -> Xác thực OTP -> Cập nhật hồ sơ -> Hệ thống tự động gán role (Player). Admin có thể nâng cấp user thành Coach/Staff.
- **Business rules**: Email và SĐT phải là duy nhất. Mật khẩu mã hóa bcrypt. OTP hết hạn sau 5 phút.
- **Input/Output**: In: Thông tin cá nhân. Out: JWT Token, Thông tin user.
- **Role**: Guest (đăng ký), Tất cả (đăng nhập/hồ sơ), Admin (phân quyền).
- **Liên kết**: Xác thực token ảnh hưởng đến 10 module còn lại.

## 2. Court Management Module
- **Mục tiêu**: Quản lý thông tin và trạng thái các sân bóng.
- **Tính năng con**:
  - CRUD Sân bóng.
  - Quản lý hình ảnh và tiện ích sân (đèn, mái che).
  - Cập nhật trạng thái bảo trì (Maintenance).
- **Luồng nghiệp vụ chính**: Admin tạo sân -> Set trạng thái "Available". Nếu sân hỏng, Staff set "Maintenance", tự động hủy các booking trong thời gian bảo trì.
- **Business rules**: Sân bảo trì không được phép đặt lịch mới. Tên sân không được trùng trong cùng cơ sở.
- **Input/Output**: In: Tên sân, loại sân, giờ mở/đóng cửa. Out: Danh sách sân.
- **Role**: Admin/Staff (quản lý), Player (xem).
- **Liên kết**: Gắn chặt với Booking Module.

## 3. Booking Management Module
- **Mục tiêu**: Cho phép đặt lịch sử dụng sân.
- **Tính năng con**:
  - Xem lịch trống (Timetable).
  - Đặt sân theo giờ lẻ (Single Slot) hoặc theo nhóm giờ liên tiếp (Team Booking / Multi-slot).
  - Đặt sân theo Combo cố định (sáng/tối).
  - Hủy đặt sân.
- **Luồng nghiệp vụ chính**: Chọn sân -> Chọn ngày/giờ -> Kiểm tra conflict -> Tạm giữ slot (Hold) 10 phút -> Thanh toán -> Xác nhận Booking.
- **Business rules**: Slot phải trống hoàn toàn mới được đặt. Team Booking yêu cầu các slot phải liên tiếp nhau. Không cho đặt quá 2 tiếng (120p) trong một lần.
- **Role**: Player, Staff (đặt hộ).
- **Liên kết**: Kết nối module Payment (tạo giao dịch), Court (check trạng thái), Notification (gửi email xác nhận).

## 4. Coach Management Module
- **Mục tiêu**: Kết nối người chơi với huấn luyện viên.
- **Tính năng con**:
  - Đăng ký hồ sơ HLV.
  - Cập nhật lịch rảnh (Availability).
  - Người chơi book lịch HLV.
- **Luồng nghiệp vụ chính**: Coach đăng ký lịch rảnh -> Player xem lịch -> Book lịch kèm theo Booking Sân -> Thanh toán.
- **Business rules**: Lịch HLV và lịch sân phải khớp nhau. Coach phải được Admin duyệt (Verified) mới hiện lên danh sách.
- **Role**: Coach, Player, Admin.

## 5. Player Matching & Playgroups Module
- **Mục tiêu**: Tăng tương tác cộng đồng.
- **Tính năng con**:
  - Tạo nhóm chơi (Playgroup).
  - Gửi lời mời tham gia (Play-invitations).
  - Ghép cặp tự động dựa trên trình độ (Player Matching).
- **Luồng nghiệp vụ chính**: Player A tạo group -> Mời Player B. Hệ thống tự động gợi ý những người có cùng số điểm Elo.
- **Business rules**: Chỉ invite được user đang active. Mức độ chênh lệch Elo không quá 200 điểm khi auto-matching.
- **Role**: Player.
- **Liên kết**: Tương tác với Notification để gửi lời mời.

## 6. Payment & Refund Module
- **Mục tiêu**: Đảm bảo dòng tiền minh bạch.
- **Tính năng con**:
  - Tích hợp cổng thanh toán (PayOS / VNPay).
  - Quản lý ví nội bộ (nếu có) hoặc xử lý nạp/rút.
  - Xử lý hoàn tiền khi hủy sân.
- **Luồng nghiệp vụ chính**: Nhận Webhook từ cổng thanh toán -> Cập nhật trạng thái Booking -> Ghi log Transaction. Nếu Player hủy sân trước 24h -> Tạo Refund Request -> Staff duyệt.
- **Business rules**: Hủy trước 24h hoàn 100%. Hủy trước 12h hoàn 50%. Hủy sát giờ (dưới 12h) không hoàn.
- **Role**: Player, Staff, Admin.
- **Liên kết**: Booking, Admin/Reports.

## 7. Promotion Module
- **Mục tiêu**: Kích cầu kinh doanh.
- **Tính năng con**:
  - Tạo mã giảm giá (Voucher).
  - Chương trình Flash Sale.
- **Luồng nghiệp vụ chính**: Admin tạo mã KM -> Player nhập mã lúc thanh toán Booking -> Check điều kiện áp dụng -> Trừ tiền hóa đơn.
- **Business rules**: Voucher có số lượng giới hạn và thời gian hiệu lực. Chỉ áp dụng 1 voucher trên 1 đơn hàng.
- **Role**: Admin (tạo), Player (dùng).

## 8. Review Module
- **Mục tiêu**: Đánh giá chất lượng dịch vụ.
- **Tính năng con**:
  - Chấm điểm sân (1-5 sao).
  - Chấm điểm HLV.
- **Luồng nghiệp vụ chính**: Sau khi Booking "Completed" -> Hệ thống mở quyền review -> Player submit review.
- **Business rules**: Chỉ những người đã sử dụng dịch vụ (Booking đã xong) mới được review. Không được sửa review sau 7 ngày.
- **Role**: Player.
- **Liên kết**: Court, Coach (tính điểm trung bình).

## 9. Notification Module
- **Mục tiêu**: Duy trì liên lạc với user.
- **Tính năng con**:
  - Push Notification (In-app).
  - Email Notification.
- **Luồng nghiệp vụ chính**: Event (Booking tạo/hủy/Thanh toán/Có lời mời) -> Kích hoạt Notification Service -> Gửi cho User -> Đánh dấu đã đọc.
- **Business rules**: Email gửi thất bại phải có cơ chế retry tối đa 3 lần.
- **Role**: System (Tự động trigger).

## 10. Admin & Reports Module
- **Mục tiêu**: Quản trị vận hành.
- **Tính năng con**:
  - Phân ca làm việc của Staff.
  - Dashboard doanh thu (Revenue).
  - Log hoạt động hệ thống.
- **Luồng nghiệp vụ chính**: Dữ liệu từ Booking/Payment -> Aggregation (tổng hợp) theo ngày/tuần/tháng -> Vẽ biểu đồ.
- **Business rules**: Báo cáo doanh thu chỉ những người có quyền "Admin" hoặc "Manager" mới được xem.
- **Role**: Admin, Staff.

## 11. AI Assistant Module
- **Mục tiêu**: Hỗ trợ khách hàng tự động 24/7.
- **Tính năng con**:
  - Chatbot hỏi đáp chính sách.
  - Gợi ý đặt sân qua chat.
- **Luồng nghiệp vụ chính**: User nhập text -> AI Service phân tích NLP (Gemini) -> Gọi API lấy dữ liệu sân -> Trả về câu trả lời hoặc link đặt sân.
- **Business rules**: Phải xử lý fallback khi API AI bị lỗi (rate limit 429).
- **Role**: Guest, Player.
- **Liên kết**: Gọi API của Court/Booking để lấy data cho Bot.
