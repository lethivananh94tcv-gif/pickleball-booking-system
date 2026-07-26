import { countHoldingBookingsByUserId } from "./bookings.repository";


// ---- Helper Functions ----

/**
 * Tinh so gio giua startTime va endTime.
 * Validate: toi thieu 1 gio, toi da 4 gio.
 */
export function calculateHours(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const diffMinutes = end - start;

  if (diffMinutes <= 0) {
    throw new Error("End time phai lon hon start time");
  }

  const hours = diffMinutes / 60;

  if (hours < 1) {
    throw new Error("Thoi gian dat san toi thieu la 1 gio");
  }

  if (hours > 4) {
    throw new Error("Thoi gian dat san toi da la 4 gio");
  }

  return hours;
}

/**
 * Validate ngay dat phai >= hom nay, va thoi gian chua troi qua (BR-23).
 */
export function validateBookingDate(bookingDate: string, startTime: string): void {
  if (process.env.ENABLE_STRICT_VALIDATIONS !== "true") {
    return;
  }
  const nowVN = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );

  // Format YYYY-MM-DD
  const year = nowVN.getFullYear();
  const month = String(nowVN.getMonth() + 1).padStart(2, "0");
  const day = String(nowVN.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (bookingDate < todayStr) {
    throw new Error("Ngay dat phai la hom nay hoac trong tuong lai (BR-23)");
  }

  if (bookingDate === todayStr) {
    const currentHour = nowVN.getHours();
    const currentMinute = nowVN.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;

    if (startTotalMinutes <= currentTotalMinutes) {
      throw new Error("Khung giờ này đã bắt đầu, không thể đặt.");
    }
  }
}

/**
 * Kiem tra user chua qua 3 booking Holding (BR-40).
 */
export async function validateHoldingLimit(userId: number): Promise<void> {
  const holdingCount = await countHoldingBookingsByUserId(userId);
  if (holdingCount >= 1) {
    throw new Error(
      "Bạn đang có booking chưa thanh toán. Vui lòng thanh toán hoặc hủy booking hiện tại trước khi đặt thêm."
    );
  }
}

/**
 * Validate coach fee trong khoang [150,000 - 2,000,000] VND/gio (BR-42/43).
 */
export function validateCoachFeePerHour(hourlyRate: number): void {
  if (hourlyRate < 150000) {
    throw new Error("Coach fee toi thieu la 150,000 VND/gio (BR-42)");
  }
  if (hourlyRate > 2000000) {
    throw new Error("Coach fee toi da la 2,000,000 VND/gio (BR-43)");
  }
}
