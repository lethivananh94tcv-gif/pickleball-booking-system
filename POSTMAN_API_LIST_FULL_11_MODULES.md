# Postman API Collection Report - Full 11 Modules
Dự án: Pickleball Booking System (PCS)

Bảng dưới đây là danh sách API theo từng module để đưa vào Postman Collection.

| Module | API Name | Method | Endpoint | Auth/Role | Headers | Body/Params Mẫu | Success (20x) | Error (40x/50x) |
|---|---|---|---|---|---|---|---|---|
| **1. User** | Đăng ký | POST | `/api/auth/register` | None | Content-Type: application/json | `{ "email": "x@x.com", "password": "123", "name": "Ngoc" }` | 201 Created. User data. | 400 Email exists |
| **1. User** | Đăng nhập | POST | `/api/auth/login` | None | Content-Type: application/json | `{ "email": "x@x.com", "password": "123" }` | 200 OK. Token. | 401 Invalid creds |
| **1. User** | Lấy Profile | GET | `/api/users/me` | Bearer Token | Authorization: Bearer {token} | N/A | 200 OK. User info. | 401 Unauthorized |
| **2. Court** | Lấy danh sách sân | GET | `/api/courts` | None | N/A | `?page=1&limit=10&status=available` | 200 OK. Array courts. | 500 Server Error |
| **2. Court** | Thêm sân mới | POST | `/api/courts` | Admin | Authorization: Bearer {token} | `{ "name": "Court 1", "type": "Indoor" }` | 201 Created | 403 Forbidden |
| **2. Court** | Cập nhật bảo trì | PUT | `/api/maintenance/:id` | Admin/Staff | Authorization: Bearer {token} | `{ "status": "Maintenance", "reason": "Sửa đèn" }` | 200 OK | 404 Not Found |
| **3. Booking** | Đặt sân | POST | `/api/bookings` | Player | Authorization: Bearer {token} | `{ "courtId": 1, "date": "2026-06-27", "slotIds": [1, 2] }` | 201 Booking Created | 409 Slot Conflict |
| **3. Booking** | Đặt Combo | POST | `/api/bookings/combo` | Player | Authorization: Bearer {token} | `{ "comboId": 5, "startDate": "2026-06-27" }` | 201 Created | 400 Invalid Date |
| **3. Booking** | Hủy đặt sân | DELETE | `/api/bookings/:id` | Player/Admin| Authorization: Bearer {token} | N/A | 200 OK | 403 Time limit exceed |
| **4. Coach** | Đăng ký rảnh | POST | `/api/coaches/availability`| Coach | Authorization: Bearer {token} | `{ "date": "2026-06-27", "slots": [1,2] }` | 201 OK | 400 Overlap |
| **4. Coach** | Thuê HLV | POST | `/api/coaches/book` | Player | Authorization: Bearer {token} | `{ "coachId": 3, "bookingId": 10 }` | 201 OK | 409 Coach Busy |
| **5. Playgroup**| Tạo nhóm | POST | `/api/playgroups` | Player | Authorization: Bearer {token} | `{ "name": "Team A", "level": "Beginner" }` | 201 Created | 400 Bad Request |
| **5. Playgroup**| Mời người | POST | `/api/play-invitations` | Player | Authorization: Bearer {token} | `{ "groupId": 1, "userId": 5 }` | 200 OK | 404 User Not Found |
| **5. Matching** | Tìm nhóm auto | GET | `/api/matching` | Player | Authorization: Bearer {token} | `?elo=1200` | 200 OK. Matches. | 500 Server Error |
| **6. Payment** | Tạo thanh toán | POST | `/api/payments/create` | Player | Authorization: Bearer {token} | `{ "bookingId": 10, "gateway": "payos" }` | 200 OK. Payment URL | 400 Invalid Booking |
| **6. Payment** | Webhook PayOS | POST | `/api/payments/webhook` | System | N/A | `{ "code": "00", "data": {...} }` | 200 OK | 401 Invalid Signature |
| **6. Payment** | Yêu cầu hoàn | POST | `/api/refunds` | Player | Authorization: Bearer {token} | `{ "bookingId": 10, "reason": "Bận" }` | 201 Created | 400 Not Eligible |
| **7. Promo** | Nhập Voucher | POST | `/api/promotions/apply` | Player | Authorization: Bearer {token} | `{ "code": "SUMMER10", "bookingId": 10 }` | 200 OK. Discount | 404/400 Expired/Limit |
| **8. Review** | Gửi đánh giá | POST | `/api/reviews` | Player | Authorization: Bearer {token} | `{ "targetId": 1, "type": "Court", "rating": 5 }` | 201 Created | 403 Not completed |
| **9. Notify** | Đọc thông báo | PATCH | `/api/notifications/:id`| All | Authorization: Bearer {token} | `{ "isRead": true }` | 200 OK | 404 Not Found |
| **10. Admin** | BC Doanh thu | GET | `/api/revenue/monthly` | Admin | Authorization: Bearer {token} | `?year=2026&month=6` | 200 OK. Data array | 403 Forbidden |
| **10. Admin** | Xếp ca làm | POST | `/api/staff/shifts` | Admin | Authorization: Bearer {token} | `{ "staffId": 2, "shift": "Morning" }` | 201 Created | 400 Conflict |
| **11. AI** | Hỏi đáp Chatbot | POST | `/api/ai/chat` | All | N/A | `{ "message": "Giá sân bao nhiêu?" }` | 200 OK. Reply text | 503 AI Unavailable |

---
*Lưu ý cho việc làm Postman Collection:*
- Cần tạo các Environment variables: `{{BASE_URL}}`, `{{PLAYER_TOKEN}}`, `{{ADMIN_TOKEN}}`.
- Viết pre-request script trong folder Auth để tự động lưu Token vào biến môi trường khi Login.
