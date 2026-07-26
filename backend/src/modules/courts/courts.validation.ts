// ============================================================
// courts.validation.ts — Business Rule Validators
// Tập trung toàn bộ các hàm kiểm tra nghiệp vụ tại đây
// để tái sử dụng trong Service layer.
// ============================================================

/**
 * Kiểm tra định dạng giờ HH:mm (00:00 → 23:59)
 */
export function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * Kiểm tra endTime phải lớn hơn startTime
 * Ném Error nếu không hợp lệ.
 */
export function validateTimeRange(startTime: string, endTime: string): void {
  if (!isValidTimeFormat(startTime)) {
    throw new Error(`Giờ bắt đầu không đúng định dạng HH:mm: "${startTime}"`);
  }
  if (!isValidTimeFormat(endTime)) {
    throw new Error(`Giờ kết thúc không đúng định dạng HH:mm: "${endTime}"`);
  }

  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);

  if (eh * 60 + em <= sh * 60 + sm) {
    throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu");
  }
}

/**
 * Kiểm tra giá thuê sân hợp lệ (100,000 → 1,000,000 VNĐ)
 * Áp dụng cho cả Court.PricePerHour lẫn Slot.Price
 */
export function validatePrice(price: number, label = "Giá"): void {
  if (isNaN(price) || price < 100000 || price > 1000000) {
    throw new Error(`${label} phải từ 100.000 đ đến 1.000.000 đ`);
  }
}

/**
 * Kiểm tra ngày không được nhỏ hơn ngày hiện tại.
 * So sánh theo chuỗi YYYY-MM-DD (UTC+7).
 *
 * @throws BadRequestException-style Error nếu ngày trong quá khứ
 */
export function validateNotPastDate(slotDate: string): void {
  if (process.env.ENABLE_STRICT_VALIDATIONS !== "true") {
    return;
  }
  // Lấy ngày hiện tại theo múi giờ +07:00 (không phụ thuộc server timezone)
  const nowVN = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  
  const year = nowVN.getFullYear();
  const month = String(nowVN.getMonth() + 1).padStart(2, "0");
  const day = String(nowVN.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (slotDate < todayStr) {
    throw new Error(
      "Không thể tạo hoặc quản lý slot cho các ngày trong quá khứ"
    );
  }
}

/**
 * Kiểm tra giờ không được nhỏ hơn giờ hiện tại nếu ngày là hôm nay.
 */
export function validateNotPastTime(slotDate: string, startTime: string): void {
  if (process.env.ENABLE_STRICT_VALIDATIONS !== "true") {
    return;
  }
  const nowVN = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  
  const year = nowVN.getFullYear();
  const month = String(nowVN.getMonth() + 1).padStart(2, "0");
  const day = String(nowVN.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (slotDate === todayStr) {
    const currentMin = nowVN.getHours() * 60 + nowVN.getMinutes();
    const [sh, sm] = startTime.split(":").map(Number);
    if (sh * 60 + sm <= currentMin) {
      throw new Error(`Giờ bắt đầu (${startTime}) không được trong quá khứ`);
    }
  }
}

/**
 * Kiểm tra các trường bắt buộc của Court khi tạo mới
 */
export function validateCreateCourtFields(data: {
  courtCode?: string;
  courtName?: string;
  courtType?: string;
  openTime?: string;
  closeTime?: string;
}): void {
  if (!data.courtCode?.trim()) {
    throw new Error("Mã sân (courtCode) là bắt buộc");
  }
  if (!data.courtName?.trim()) {
    throw new Error("Tên sân (courtName) là bắt buộc");
  }
  if (!data.courtType || !["Indoor", "Outdoor"].includes(data.courtType)) {
    throw new Error("Loại sân (courtType) phải là Indoor hoặc Outdoor");
  }
  if (!data.openTime || !data.closeTime) {
    throw new Error("Giờ mở cửa và giờ đóng cửa là bắt buộc");
  }
}
