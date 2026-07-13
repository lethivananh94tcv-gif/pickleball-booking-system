// ============================================================
// coaches.service.ts — Business logic for Coaches module
// ============================================================

import * as coachRepo from "./coaches.repository";
import { validateAndSaveFile, deleteFile } from "../../utils/upload";
import bcrypt from "bcryptjs";
import type {
  CreateCoachAdminInput,
  UpdateCoachProfileInput,
  UpdateCoachExpertiseInput,
  UpdateCoachFeeInput,
  UpdateCoachScheduleInput,
  CoachListFilter,
  CoachStatus,
} from "./coaches.type";
import {
  validateTimeRange,
  validateNotPastDate,
  validateStartTimeInFuture,
  validateHourlyRate,
  validateExperienceYears,
  validateBiography,
  validateSpecialization,
  validateSkillLevel,
  validateCoachStatus,
  validateScheduleStatus,
  isValidDateFormat,
  isScheduleExpired,
} from "./coaches.validation";
import { calcBookingBlockedHours, checkBufferConflict } from "./coaches.buffer";

// ─── PUBLIC: List active coaches ──────────────────────────────

export async function getAllCoaches(filter: CoachListFilter = {}) {
  return coachRepo.findAllApprovedCoaches(filter);
}

// ─── PUBLIC: Coach detail ─────────────────────────────────────

export async function getCoachById(coachId: number) {
  const coach = await coachRepo.findCoachById(coachId);

  if (!coach) {
    throw new Error("Coach không tồn tại hoặc chưa được duyệt");
  }

  return coach;
}

// ─── PUBLIC: Available schedules (for booking picker) ─────────

export async function getAvailableCoachSchedules(
  bookingDate: string,
  startTime: string,
  endTime: string
) {
  if (!bookingDate) {
    throw new Error("bookingDate là bắt buộc");
  }

  if (!startTime || !endTime) {
    throw new Error("startTime và endTime là bắt buộc");
  }

  validateTimeRange(startTime, endTime);

  const schedules = await coachRepo.findAvailableCoachSchedules(bookingDate, startTime, endTime);
  
  // Filter out expired schedules
  return schedules.filter(s => !isScheduleExpired(s.WorkingDate, s.EndTime));
}

// ─── AUTH: Get my coach profile ───────────────────────────────

export async function getMyCoachProfile(userId: number) {
  const coach = await coachRepo.findCoachByUserId(userId);

  if (!coach) {
    throw new Error("Hồ sơ Coach không tồn tại");
  }

  return coach;
}

// ─── AUTH: Update my profile ──────────────────────────────────

export async function updateMyProfile(
  userId: number,
  data: UpdateCoachProfileInput,
  avatarFile?: File
) {
  const coach = await coachRepo.findCoachByUserId(userId);

  if (!coach) {
    throw new Error("Hồ sơ Coach không tồn tại");
  }

  // Validate
  if (data.experienceYears !== undefined) {
    validateExperienceYears(data.experienceYears);
  }
  if (data.biography !== undefined) {
    validateBiography(data.biography);
  }
  if (data.specialization !== undefined) {
    validateSpecialization(data.specialization);
  }

  let newAvatarPath: string | null = null;
  try {
    if (avatarFile) {
      newAvatarPath = await validateAndSaveFile(avatarFile, "avatar", coach.CoachID);
    }

    const updated = await coachRepo.updateCoachProfile(coach.CoachID, data);
    if (!updated) {
      throw new Error("Cập nhật hồ sơ thất bại");
    }

    if (newAvatarPath) {
      await coachRepo.updateUserAvatar(userId, newAvatarPath);
    }

    return updated;
  } catch (error) {
    if (newAvatarPath) {
      deleteFile(newAvatarPath);
    }
    throw error;
  }
}

// ─── AUTH: Update my expertise ────────────────────────────────

export async function updateMyExpertise(
  userId: number,
  data: UpdateCoachExpertiseInput,
  certFile?: File
) {
  const coach = await coachRepo.findCoachByUserId(userId);

  if (!coach) {
    throw new Error("Hồ sơ Coach không tồn tại");
  }

  // Validate
  if (data.skillLevel !== undefined) {
    validateSkillLevel(data.skillLevel);
  }
  if (data.specialization !== undefined) {
    validateSpecialization(data.specialization);
  }
  if (data.experienceYears !== undefined) {
    validateExperienceYears(data.experienceYears);
  }

  let newCertPath: string | null = null;
  try {
    if (certFile) {
      newCertPath = await validateAndSaveFile(certFile, "certificate", coach.CoachID);
      data.certifications = newCertPath;
    }

    const updated = await coachRepo.updateCoachExpertise(coach.CoachID, data);
    if (!updated) {
      throw new Error("Cập nhật chuyên môn thất bại");
    }

    return updated;
  } catch (error) {
    if (newCertPath) {
      deleteFile(newCertPath);
    }
    throw error;
  }
}

// ─── AUTH: Update teaching fee ────────────────────────────────

export async function updateMyFee(
  userId: number,
  data: UpdateCoachFeeInput
) {
  const coach = await coachRepo.findCoachByUserId(userId);

  if (!coach) {
    throw new Error("Hồ sơ Coach không tồn tại");
  }

  validateHourlyRate(data.hourlyRate);

  const updated = await coachRepo.updateCoachFee(coach.CoachID, data);

  if (!updated) {
    throw new Error("Cập nhật học phí thất bại");
  }

  return updated;
}

// ─── AUTH: Get my schedules ───────────────────────────────────

export async function getMySchedules(userId: number) {
  const coach = await coachRepo.findCoachByUserId(userId);

  if (!coach) {
    throw new Error("Hồ sơ Coach không tồn tại");
  }

  const schedules = await coachRepo.findCoachSchedules(coach.CoachID);

  const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));

  const activeBookedScheduleIdsArr = await coachRepo.findActiveBookedScheduleIds(coach.CoachID);
  const activeBookedScheduleIds = new Set(activeBookedScheduleIdsArr);

  const processedSchedules = schedules.map(s => {
    const dateStr = s.WorkingDate.split('T')[0];
    const scheduleDate = new Date(`${dateStr}T${s.StartTime}:00`);
    const isExpired = scheduleDate <= nowVN;

    let finalStatus = s.Status;
    if (activeBookedScheduleIds.has(s.CoachScheduleID)) {
      finalStatus = "Booked";
    }

    return {
      ...s,
      Status: finalStatus,
      isExpired,
    };
  });

  return processedSchedules.filter(s => !s.isExpired);
}

// ─── AUTH: Get schedule options ───────────────────────────────

export async function getScheduleOptions(userId: number, date: string) {
  const coach = await coachRepo.findCoachByUserId(userId);

  if (!coach) {
    throw new Error("Hồ sơ Coach không tồn tại");
  }

  // Validate date format
  if (!isValidDateFormat(date)) {
    throw new Error("Ngày không đúng định dạng YYYY-MM-DD");
  }

  const schedules = await coachRepo.findCoachSchedules(coach.CoachID);

  // Use bookings repo dynamically to avoid circular dependencies if any,
  // or just directly since coaches.service shouldn't strictly care.
  const { findBookingsByCoachUserId } = require("@/modules/bookings/bookings.repository");
  const bookings = await findBookingsByCoachUserId(userId);

  // ── Step 1: Block giờ từ CoachSchedule hiện có (kể cả legacy long schedule) ──
  const scheduleOccupied = new Set<number>();
  schedules.forEach(s => {
    if (s.WorkingDate.startsWith(date)) {
      const startH = parseInt(s.StartTime.split(':')[0], 10);
      const endH   = parseInt(s.EndTime.split(':')[0], 10);
      // Mark every hour in [startH, endH) — handles legacy long schedules
      for (let hr = startH; hr < endH; hr++) {
        scheduleOccupied.add(hr);
      }
    }
  });

  // ── Step 2: Block giờ từ active bookings + Buffer Time 15 phút ──
  // Sử dụng shared helper từ coaches.buffer.ts
  // Đảm bảo nhất quán với createMySchedule và Player available-schedules
  const { blockedHours: bookingBlocked } = calcBookingBlockedHours(bookings, date);

  // ── Step 3: Hợp nhất tất cả blocked hours ──
  const occupiedSet = new Set<number>([...scheduleOccupied, ...bookingBlocked]);

  const startTimes: string[] = [];
  const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const todayStr = `${nowVN.getFullYear()}-${String(nowVN.getMonth() + 1).padStart(2, '0')}-${String(nowVN.getDate()).padStart(2, '0')}`;
  const isToday = date === todayStr;
  const currentHour = nowVN.getHours();

  // Past dates cannot have any start times
  if (date < todayStr) {
    return { date, startTimes: [], occupiedHours: Array.from(occupiedSet) };
  }

  const { SYSTEM_CONFIG } = require("../../constants/system");
  // Coach can only start a slot up to CLOSING_HOUR - 1 (i.e. 22:00 if closing is 23:00)
  for (let h = SYSTEM_CONFIG.OPENING_HOUR; h < SYSTEM_CONFIG.CLOSING_HOUR; h++) {
    if (isToday && h <= currentHour) continue;
    if (occupiedSet.has(h)) continue;
    startTimes.push(`${String(h).padStart(2, "0")}:00`);
  }

  return {
    date,
    startTimes,
    occupiedHours: Array.from(occupiedSet).sort((a, b) => a - b)
  };
}

// ─── AUTH: Create schedule ────────────────────────────────────

export async function createMySchedule(
  userId: number,
  data: {
    workingDate: string;
    startTime: string;
    endTime: string;
  }
) {
  const coach = await coachRepo.findCoachByUserId(userId);

  if (!coach) {
    throw new Error("Hồ sơ Coach không tồn tại");
  }

  if (coach.Status !== "Approved") {
    throw new Error("Chỉ Coach đã được duyệt mới có thể tạo lịch làm việc");
  }

  // Validate date & time
  if (!data.workingDate || !isValidDateFormat(data.workingDate)) {
    throw new Error("workingDate không đúng định dạng YYYY-MM-DD");
  }

  validateNotPastDate(data.workingDate);
  validateStartTimeInFuture(data.workingDate, data.startTime);
  validateTimeRange(data.startTime, data.endTime);

  // ── Check 1: Overlap với CoachSchedule hiện có (kể cả legacy long schedule) ──
  // checkScheduleOverlap dùng half-open interval: StartTime < @EndTime AND EndTime > @StartTime
  const hasOverlap = await coachRepo.checkScheduleOverlap(
    coach.CoachID,
    data.workingDate,
    data.startTime,
    data.endTime
  );

  if (hasOverlap) {
    throw new Error("Lịch bị trùng với lịch đã tồn tại. Vui lòng chọn khung giờ khác");
  }

  // ── Check 2: Buffer Time 15 phút với active bookings ──
  // Re-check tại backend — KHÔNG tin vào schedule-options hay frontend dropdown.
  // Shared logic từ coaches.buffer.ts (nhất quán với getScheduleOptions và Player search).
  const { findBookingsByCoachUserId } = require("@/modules/bookings/bookings.repository");
  const bookingsForBuffer = await findBookingsByCoachUserId(userId);

  const requestStartH = parseInt(data.startTime.split(":")[0]);
  const requestEndH   = parseInt(data.endTime.split(":")[0]);

  const bufferError = checkBufferConflict(
    bookingsForBuffer,
    data.workingDate,
    requestStartH,
    requestEndH
  );

  if (bufferError) {
    throw new Error(bufferError);
  }

  // ── Step 3: Split into 1-hour slots và insert ──
  const slots = [];
  for (let h = requestStartH; h < requestEndH; h++) {
    const slotStart = `${String(h).padStart(2, "0")}:00`;
    const slotEnd = `${String(h + 1).padStart(2, "0")}:00`;
    slots.push({
      coachId: coach.CoachID,
      workingDate: data.workingDate,
      startTime: slotStart,
      endTime: slotEnd,
    });
  }

  return coachRepo.createCoachSchedulesTransaction(slots);
}

// ─── AUTH: Update my schedule ─────────────────────────────────

export async function updateMySchedule(
  userId: number,
  scheduleId: number,
  data: UpdateCoachScheduleInput
) {
  const coach = await coachRepo.findCoachByUserId(userId);

  if (!coach) {
    throw new Error("Hồ sơ Coach không tồn tại");
  }

  // Verify ownership
  const existing = await coachRepo.findScheduleById(scheduleId);

  if (!existing) {
    throw new Error("Lịch không tồn tại");
  }

  if (existing.CoachID !== coach.CoachID) {
    throw new Error("Bạn không có quyền chỉnh sửa lịch này");
  }

  if (existing.Status === "Booked" || existing.Status === "Holding") {
    throw new Error("Không thể chỉnh sửa lịch đã được đặt hoặc đang giữ chỗ");
  }

  // Validate if provided
  if (data.workingDate) {
    if (!isValidDateFormat(data.workingDate)) {
      throw new Error("workingDate không đúng định dạng YYYY-MM-DD");
    }
    validateNotPastDate(data.workingDate);
  }

  const newDate = data.workingDate || existing.WorkingDate;
  const newStart = data.startTime || existing.StartTime;
  const newEnd = data.endTime || existing.EndTime;

  if (data.startTime || data.endTime || data.workingDate) {
    validateStartTimeInFuture(newDate, newStart);
    validateTimeRange(newStart, newEnd);
  }

  if (data.status !== undefined) {
    validateScheduleStatus(data.status);
  }

  // Check overlap for the new time
  if (data.workingDate || data.startTime || data.endTime) {
    const newDate = data.workingDate || existing.WorkingDate;
    const newStart = data.startTime || existing.StartTime;
    const newEnd = data.endTime || existing.EndTime;

    const hasOverlap = await coachRepo.checkScheduleOverlap(
      coach.CoachID,
      newDate,
      newStart,
      newEnd,
      scheduleId
    );

    if (hasOverlap) {
      throw new Error("Lịch bị trùng với lịch đã tồn tại. Vui lòng chọn khung giờ khác");
    }
  }

  const updated = await coachRepo.updateCoachSchedule(
    scheduleId,
    coach.CoachID,
    data
  );

  if (!updated) {
    throw new Error("Cập nhật lịch thất bại");
  }

  return updated;
}

// ─── AUTH: Delete my schedule ─────────────────────────────────

export async function deleteMySchedule(userId: number, scheduleId: number) {
  const coach = await coachRepo.findCoachByUserId(userId);

  if (!coach) {
    throw new Error("Hồ sơ Coach không tồn tại");
  }

  // Verify ownership
  const existing = await coachRepo.findScheduleById(scheduleId);

  if (!existing) {
    throw new Error("Lịch không tồn tại");
  }

  if (existing.CoachID !== coach.CoachID) {
    throw new Error("Bạn không có quyền xóa lịch này");
  }

  if (existing.Status === "Booked" || existing.Status === "Holding") {
    throw new Error("Không thể xóa lịch đã được đặt hoặc đang giữ chỗ");
  }

  const deleted = await coachRepo.deleteCoachSchedule(
    scheduleId,
    coach.CoachID
  );

  if (!deleted) {
    throw new Error("Xóa lịch thất bại");
  }

  return deleted;
}

// ─── ADMIN: List all coaches ──────────────────────────────────

export async function getAllCoachesAdmin() {
  return coachRepo.findAllCoachesAdmin();
}

// ─── ADMIN: Create coach directly ─────────────────────────────

export async function createCoachByAdmin(data: CreateCoachAdminInput) {
  // Validate input
  if (!data.fullName || !data.email) {
    const { AppError } = await import("@/utils/AppError");
    throw new AppError("Họ tên và email là bắt buộc", 400);
  }
  
  const password = data.password || "123456"; // Default password if not provided
  const cost = 12; // bcrypt cost >= 12 as requested
  const passwordHash = await bcrypt.hash(password, cost);
  
  const userId = await coachRepo.createCoachAdminTransaction({
    ...data,
    passwordHash
  });
  
  return userId;
}

// ─── ADMIN: Pending coaches ───────────────────────────────────

export async function getPendingCoaches() {
  return coachRepo.findPendingCoaches();
}

// ─── ADMIN: Approve/reject/suspend coach ─────────────────────

export async function updateCoachStatus(coachId: number, status: CoachStatus) {
  validateCoachStatus(status);

  const coach = await coachRepo.findCoachByIdAdmin(coachId);

  if (!coach) {
    throw new Error("Coach không tồn tại");
  }

  const updated = await coachRepo.updateCoachStatus(coachId, status);

  if (!updated) {
    throw new Error("Cập nhật trạng thái Coach thất bại");
  }

  console.log(
    `[ADMIN] Coach #${coachId} status updated: ${coach.Status} → ${status}`
  );

  return updated;
}

// ─── HELPERS (for future Booking integration) ─────────────────

/**
 * Check if a coach is available for a specific date/time window.
 * Returns true if the coach has an Available schedule covering the window.
 */
export async function checkCoachAvailable(
  coachId: number,
  workingDate: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const schedules = await coachRepo.findCoachSchedules(coachId);

  return schedules.some(
    (s) =>
      s.WorkingDate === workingDate &&
      s.StartTime <= startTime &&
      s.EndTime >= endTime &&
      s.Status === "Available"
  );
}

/**
 * Get all available time slots for a coach on a given date.
 */
export async function getCoachAvailableSlots(coachId: number, date: string) {
  const schedules = await coachRepo.findCoachSchedules(coachId);
  const daySchedules = schedules.filter((s) => s.WorkingDate === date && !isScheduleExpired(s.WorkingDate, s.EndTime));
  // Find all booked/holding slots for this coach on this day
  const busySlots = daySchedules.filter(s => s.Status === 'Booked' || s.Status === 'Holding');

  return daySchedules.filter((s) => {
    if (s.Status !== "Available") return false;

    // Check buffer 15 mins against busy slots
    const sStart = new Date(`1970-01-01T${s.StartTime}:00`);
    const sEnd = new Date(`1970-01-01T${s.EndTime}:00`);

    for (const busy of busySlots) {
      const bStart = new Date(`1970-01-01T${busy.StartTime}:00`);
      const bEnd = new Date(`1970-01-01T${busy.EndTime}:00`);

      // bStart - 15 mins
      const bufferStart = new Date(bStart.getTime() - 15 * 60000);
      // bEnd + 15 mins
      const bufferEnd = new Date(bEnd.getTime() + 15 * 60000);

      // Overlap logic: A overlaps B if (StartA < EndB) and (EndA > StartB)
      if (sStart < bufferEnd && sEnd > bufferStart) {
        return false; // Filtered out by buffer
      }
    }
    return true;
  });
}

// ─── INCOME ───────────────────────────────────────────────────

export async function getMyIncome(userId: number) {
  const coach = await coachRepo.findCoachByUserId(userId);
  if (!coach) {
    const { AppError } = await import("@/utils/AppError");
    throw new AppError("Không tìm thấy thông tin Coach", 404);
  }

  const rawSessions = await coachRepo.findCoachIncome(coach.CoachID);

  let totalWorkingHours = 0;
  let totalIncome = 0;
  const sessions = rawSessions.map((row) => {
    const hours = row.WorkingHours;
    const fee = row.CoachFee > 0 ? row.CoachFee : hours * row.HourlyRate;
    
    totalWorkingHours += hours;
    totalIncome += fee;

    return {
      bookingId: row.BookingID,
      bookingType: row.BookingType,
      playerName: row.PlayerName,
      workingDate: row.WorkingDate,
      startTime: row.StartTime,
      endTime: row.EndTime,
      workingHours: hours,
      coachFee: fee,
      status: row.Status,
      paymentStatus: 'Paid' // since status is Completed, we assume it's paid
    };
  });

  const monthlyMap: Record<string, { month: string; sessions: number; workingHours: number; income: number }> = {};
  
  for (const session of sessions) {
    // workingDate format: YYYY-MM-DD -> get YYYY-MM
    const month = session.workingDate.substring(0, 7);
    if (!monthlyMap[month]) {
      monthlyMap[month] = { month, sessions: 0, workingHours: 0, income: 0 };
    }
    monthlyMap[month].sessions += 1;
    monthlyMap[month].workingHours += session.workingHours;
    monthlyMap[month].income += session.coachFee;
  }

  const monthlyIncome = Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month));

  return {
    summary: {
      totalSessions: sessions.length,
      completedSessions: sessions.length, // Query only fetched completed
      totalWorkingHours: totalWorkingHours,
      totalIncome: totalIncome
    },
    monthlyIncome,
    sessions
  };
}

export async function getCoachSchedules(coachId: number) {
  return coachRepo.findCoachSchedules(coachId);
}
