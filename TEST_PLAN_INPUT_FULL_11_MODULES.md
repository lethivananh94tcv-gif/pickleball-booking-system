# Master Test Plan Input - Full 11 Modules
Dự án: Pickleball Booking System (PCS)

## 1. Test Objectives
- Đảm bảo chất lượng toàn bộ 11 module của PCS trước khi Go-Live.
- Đảm bảo tính toàn vẹn dữ liệu trong các luồng giao dịch tài chính (Payment, Refund).
- Đảm bảo hiệu năng và độ ổn định của module AI Service và Matching.
- Đảm bảo phân quyền (RBAC) chặt chẽ giữa Guest, Player, Coach, Staff, Admin.

## 2. Test Scope (Phạm vi Test)
- **In-Scope**: 11 Modules: User, Court, Booking, Coach, Playgroup/Matching, Payment, Promotion, Review, Notification, Admin/Report, AI Assistant.
- **Out-of-Scope**:
  - Test stress test trên cổng thanh toán thật (dùng Sandbox thay thế).
  - Test hạ tầng vật lý của hệ thống (Hardware server).
  - Tích hợp SMS thực tế nếu chưa mua API (dùng Mock).

## 3. Test Strategy
- **Phương pháp**: Agile Testing, kết hợp Manual và Automation.
- **Loại hình**: Functional, UI/UX, API Testing, Security, Performance (cho chức năng Auto-matching).
- **Quy trình**: Unit Test (Dev) -> API Test (Postman) -> Integration (CI/CD) -> System Test (Manual/Web) -> UAT.

## 4. Test Levels & Mapping 11 Modules

| Module | Unit Test (Jest) | API Test (Postman) | UI Test | Integration Test |
|---|---|---|---|---|
| 1. User & Auth | Có (Hash pass) | Có (Auth token) | Có | Có (DB Users) |
| 2. Courts | Có (Validation) | Có (CRUD) | Có | Không |
| 3. Bookings | Có (Conflict logic)| Có (Multi-slot) | Có (Timetable) | Có (Booking <-> Court) |
| 4. Coaches | Có | Có | Có | Có (Coach <-> Booking) |
| 5. Playgroup/Matching | Có (Thuật toán Elo)| Có | Có | Không |
| 6. Payments | Có (Tính tiền) | Có (Webhook) | Có (Redirect) | Có (PayOS Mock) |
| 7. Promotions | Có (Check date) | Có | Có | Có (Promo <-> Payment) |
| 8. Reviews | Không | Có | Có | Không |
| 9. Notifications | Có (Template) | Có | Có (Chuông) | Có (Email service) |
| 10. Admin Reports | Có (Sum/Group) | Có (Aggregations) | Có (Chart) | Không |
| 11. AI Assistant | Có (NLP fallback)| Có (Timeout) | Có (Chat UI) | Có (Next.js <-> FastAPI)|

## 5. Test Environment
- **DEV**: Môi trường do dev tự build ở Local (Next.js port 3000/5000, Local SQL Server).
- **STAGING/QA**: Server test nội bộ, database clone từ production (ẩn data nhạy cảm).
- **UAT**: Server cho khách hàng nghiệm thu.

## 6. Test Tools
- **Test Management**: Excel/Google Sheets, Jira.
- **API Testing**: Postman.
- **Automation/Unit**: Jest, React Testing Library.
- **Browser/UI Testing**: Chrome/Edge DevTools (Responsive check), Playwright (nếu có auto UI).
- **Database**: SQL Server Management Studio (SSMS).

## 7. Roles & Responsibilities
- **Test Manager/Lead**: Lập Test Plan, Review Test Case, Approve release.
- **Manual Tester**: Viết Test Case, Execute UI Test, Report Bug.
- **Automation Tester**: Cấu hình Postman Collections, viết script CI/CD.
- **Developer**: Viết Unit Test, Fix Bug.

## 8. Entry & Exit Criteria
- **Entry Criteria**:
  - Code đã được merge vào nhánh `staging`.
  - Pass 100% Unit Test.
  - Các module đã sẵn sàng trên UI.
- **Exit Criteria**:
  - Đã execute 100% test cases.
  - Không còn bug High/Critical nào MỞ (Open).
  - Tỷ lệ pass >= 95%.
  - Báo cáo Test Report đã được ký duyệt.

## 9. Risks and Mitigation
- **Rủi ro 1**: API AI Gemini có thể bị rate limit làm hỏng luồng test. -> **Xử lý**: Chuẩn bị Mock Server cho AI endpoint trong lúc test functional.
- **Rủi ro 2**: Thiếu test data cho Báo cáo doanh thu (cần data cũ). -> **Xử lý**: Viết SQL Seed Data tạo 1000 records booking trải dài 6 tháng.
- **Rủi ro 3**: Webhook thanh toán test khó. -> **Xử lý**: Dùng Postman để bắn fake payload webhook.
