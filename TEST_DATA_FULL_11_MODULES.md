# Test Data Report - Full 11 Modules
Dự án: Pickleball Booking System (PCS)

Bảng dưới đây cung cấp Test Data chuẩn bị cho các module để hỗ trợ Automation Test hoặc Manual Test.

| Data Set Name | Module | Loại Data | Mô tả Data | Mẫu SQL / JSON |
|---|---|---|---|---|
| `Admin_Account` | User | Hợp lệ | Tài khoản quyền cao nhất | `INSERT INTO Users (Email, Pass, Role) VALUES ('admin@pcs.com', '$2...','Admin')` |
| `Staff_Account` | User | Hợp lệ | Tài khoản nhân viên | `INSERT INTO Users (Email, Pass, Role) VALUES ('staff@pcs.com', '...','Staff')` |
| `Player_Accounts` | User | Hợp lệ | 3 user để test invite | User: `p1@a.com`, `p2@a.com`, `p3@a.com` (Role: Player) |
| `Invalid_Email` | User | Không hợp lệ | Chuỗi sai định dạng | `test@com`, `@@@`, `abc` |
| `Court_List_Seed` | Court | Hợp lệ | 5 sân mẫu để test | `INSERT INTO Courts (Name, Status) VALUES ('VIP 1', 'Available'), ('VIP 2', 'Maintenance')` |
| `Conflict_Booking`| Booking | DB State | 1 Booking đã tạo từ 8-9h sáng | Bảng `Bookings`: `courtId=1`, `slot=1`, `status='PAID'` |
| `Valid_Multi_Slot`| Booking | Payload API| Mảng slot liên tiếp | `{ "courtId": 1, "slotIds": [2, 3] }` |
| `Invalid_Slot` | Booking | Không hợp lệ | Slot cách quãng | `{ "courtId": 1, "slotIds": [2, 4] }` |
| `Duration_Exceed` | Booking | Không hợp lệ | Đặt > 120 phút | `{ "courtId": 1, "slotIds": [1, 2, 3] }` (3 slot = 180p) |
| `Coach_Available` | Coach | DB State | HLV có lịch rảnh | `INSERT INTO CoachAvailability (CoachId, SlotId) VALUES (1, 5)` |
| `Elo_Similar` | Matching| DB State | 2 User có Elo gần nhau | User A Elo = 1200, User B Elo = 1250 |
| `PayOS_Webhook` | Payment | Payload API| Chuẩn bị mock webhook | `{ "code": "00", "data": { "orderCode": 1023, "amount": 100000 } }` |
| `Refund_Eligible` | Refund | DB State | Booking diễn ra vào tuần sau | Booking có `startTime = GETDATE() + 7 days` |
| `Refund_Late` | Refund | DB State | Booking diễn ra trong 2h tới| Booking có `startTime = GETDATE() + 2 hours` (Không hoàn) |
| `Promo_Valid` | Promo | Hợp lệ | Mã voucher còn hạn | Bảng `Vouchers`: `Code='TEST10'`, `Discount=10`, `Exp=2027`|
| `Review_Eligible` | Review | DB State | Booking đã chơi xong | Bảng `Bookings`: `status='COMPLETED'` |
| `Revenue_Data` | Admin | DB State | 100 giao dịch tháng trước | Chạy script tạo 100 bản ghi Payments trong khoảng tháng trước. |
| `AI_Context` | AI | Dữ liệu nền | Giá sân để bot học | File text nội bộ hoặc DB: "Sân VIP giá 100k, Sân thường 80k" |

## Hướng dẫn sử dụng:
1. Có thể dùng thư viện `Faker` (Node.js) để tự sinh dữ liệu `Player_Accounts`.
2. Có thể tạo file `seed.sql` trong folder `db-migrations` để đẩy data chuẩn này vào Local/Test Database.
