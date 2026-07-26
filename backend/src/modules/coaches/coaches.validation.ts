// ============================================================
// coaches.validation.ts — Business Rule Validators
// All validation functions for the Coaches module
// Following the same style as courts.validation.ts
// ============================================================

import type { SkillLevel, CoachStatus, CoachScheduleStatus } from "./coaches.type";

const VALID_SKILL_LEVELS: SkillLevel[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Professional",
];

const VALID_COACH_STATUSES: CoachStatus[] = [
  "Pending",
  "Approved",
  "Rejected",
  "Inactive",
];

const VALID_SCHEDULE_STATUSES: CoachScheduleStatus[] = [
  "Available",
  "Holding",
  "Booked",
  "Cancelled",
  "Unavailable",
];

const HOURLY_RATE_MIN = 150_000;
const HOURLY_RATE_MAX = 2_000_000;
const EXPERIENCE_YEARS_MAX = 50;
const BIOGRAPHY_MAX_LEN = 1000;
const SPECIALIZATION_MAX_LEN = 500;

// ─── Time Validators ─────────────────────────────────────────

/**
 * Check HH:mm format (00:00 → 23:59)
 */
export function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * Validate startTime < endTime. Throws if invalid.
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

  if (sm !== 0 || em !== 0) {
    throw new Error("Thời gian bắt đầu và kết thúc phải có phút là 00 (ví dụ: 08:00, 09:00).");
  }

  if (eh * 60 + em <= sh * 60 + sm) {
    throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu");
  }

  const { SYSTEM_CONFIG } = require("../../constants/system");
  if (sh < SYSTEM_CONFIG.OPENING_HOUR || eh > SYSTEM_CONFIG.CLOSING_HOUR) {
    throw new Error(`Thời gian phải nằm trong khung giờ hệ thống (${String(SYSTEM_CONFIG.OPENING_HOUR).padStart(2, "0")}:00 - ${String(SYSTEM_CONFIG.CLOSING_HOUR).padStart(2, "0")}:00).`);
  }
}

// ─── Date Validators ──────────────────────────────────────────

/**
 * Validate workingDate is not in the past (Vietnam timezone).
 */
export function validateNotPastDate(workingDate: string): void {
  if (process.env.ENABLE_STRICT_VALIDATIONS !== "true") {
    return;
  }
  const nowVN = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  
  const todayStr = [
    nowVN.getFullYear(),
    String(nowVN.getMonth() + 1).padStart(2, "0"),
    String(nowVN.getDate()).padStart(2, "0")
  ].join("-");

  if (workingDate < todayStr) {
    throw new Error(
      "Không thể tạo lịch dạy trong quá khứ."
    );
  }
}

/**
 * Validate that if the workingDate is today, the startTime is in the future.
 */
export function validateStartTimeInFuture(workingDate: string, startTime: string): void {
  if (process.env.ENABLE_STRICT_VALIDATIONS !== "true") {
    return;
  }
  const nowVN = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  
  const todayStr = [
    nowVN.getFullYear(),
    String(nowVN.getMonth() + 1).padStart(2, "0"),
    String(nowVN.getDate()).padStart(2, "0")
  ].join("-");

  const nowTimeStr = [
    String(nowVN.getHours()).padStart(2, "0"),
    String(nowVN.getMinutes()).padStart(2, "0")
  ].join(":");

  if (workingDate === todayStr && startTime <= nowTimeStr) {
    throw new Error("Giờ bắt đầu phải lớn hơn thời gian hiện tại.");
  }
}

/**
 * Kiểm tra xem lịch đã qua thời gian hiện tại chưa (theo giờ Việt Nam).
 * @param workingDate Định dạng YYYY-MM-DD
 * @param endTime Định dạng HH:mm
 */
export function isScheduleExpired(workingDate: string, endTime: string): boolean {
  // Tạo chuỗi ISO đại diện cho thời gian kết thúc của lịch theo múi giờ Việt Nam
  const vnIsoString = `${workingDate}T${endTime}:00+07:00`;
  const scheduleEndTimestamp = new Date(vnIsoString).getTime();
  
  // So sánh với thời gian hiện tại tuyệt đối (epoch time)
  return scheduleEndTimestamp <= Date.now();
}

/**
 * Validate date string is in YYYY-MM-DD format.
 */
export function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

// ─── Hourly Rate Validator ────────────────────────────────────

/**
 * Validate hourlyRate is integer VND in range [150_000, 2_000_000].
 */
export function validateHourlyRate(hourlyRate: unknown): void {
  if (typeof hourlyRate !== "number" || isNaN(hourlyRate)) {
    throw new Error("hourlyRate phải là số nguyên");
  }
  if (!Number.isInteger(hourlyRate)) {
    throw new Error("hourlyRate phải là số nguyên (VND), không chấp nhận số thập phân");
  }
  if (hourlyRate < HOURLY_RATE_MIN || hourlyRate > HOURLY_RATE_MAX) {
    throw new Error(
      `hourlyRate phải từ ${HOURLY_RATE_MIN.toLocaleString("vi-VN")} đ đến ${HOURLY_RATE_MAX.toLocaleString("vi-VN")} đ`
    );
  }
}

// ─── Experience Validator ─────────────────────────────────────

/**
 * Validate experienceYears is >= 0 and <= 50.
 */
export function validateExperienceYears(years: unknown): void {
  if (typeof years !== "number" || isNaN(years)) {
    throw new Error("experienceYears phải là số nguyên");
  }
  if (!Number.isInteger(years) || years < 0 || years > EXPERIENCE_YEARS_MAX) {
    throw new Error(
      `experienceYears phải từ 0 đến ${EXPERIENCE_YEARS_MAX}`
    );
  }
}

// ─── Text Length Validators ───────────────────────────────────

/**
 * Validate biography max 1000 characters.
 */
export function validateBiography(bio: unknown): void {
  if (bio === null || bio === undefined) return;
  if (typeof bio !== "string") {
    throw new Error("biography phải là chuỗi ký tự");
  }
  if (bio.length > BIOGRAPHY_MAX_LEN) {
    throw new Error(`biography tối đa ${BIOGRAPHY_MAX_LEN} ký tự`);
  }
}

/**
 * Validate specialization max 500 characters.
 */
export function validateSpecialization(spec: unknown): void {
  if (spec === null || spec === undefined) return;
  if (typeof spec !== "string") {
    throw new Error("specialization phải là chuỗi ký tự");
  }
  if (spec.length > SPECIALIZATION_MAX_LEN) {
    throw new Error(`specialization tối đa ${SPECIALIZATION_MAX_LEN} ký tự`);
  }
}

// ─── Enum Validators ──────────────────────────────────────────

/**
 * Validate skillLevel is one of the allowed values.
 */
export function validateSkillLevel(skillLevel: unknown): void {
  if (!VALID_SKILL_LEVELS.includes(skillLevel as SkillLevel)) {
    throw new Error(
      `skillLevel phải là một trong: ${VALID_SKILL_LEVELS.join(", ")}`
    );
  }
}

/**
 * Validate coach status for admin updates.
 */
export function validateCoachStatus(status: unknown): void {
  if (!VALID_COACH_STATUSES.includes(status as CoachStatus)) {
    throw new Error(
      `status phải là một trong: ${VALID_COACH_STATUSES.join(", ")}`
    );
  }
}

/**
 * Validate schedule status.
 */
export function validateScheduleStatus(status: unknown): void {
  if (!VALID_SCHEDULE_STATUSES.includes(status as CoachScheduleStatus)) {
    throw new Error(
      `status phải là một trong: ${VALID_SCHEDULE_STATUSES.join(", ")}`
    );
  }
}
