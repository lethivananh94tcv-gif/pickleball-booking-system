import { requestRefund, requestCoachCancelRefund } from "@/modules/refunds/refunds.service";
import { createNotification } from "@/modules/notifications/notifications.service";
import { createSystemLog } from "@/modules/systemlogs/systemlogs.service";
import { CreateCourtBookingInput, CreateWalkInCourtBookingInput, CreateCoachBookingInput, CreateComboBookingInput, CancelBookingInput, CancelBookingResult, CheckInInput, CheckInResult } from "./bookings.type";
import { findUserById, getOrCreateWalkInGuestUser, findCourtByIdForBooking, findCoachByIdForBooking, findAvailableCourtSlot, findAvailableCoachSchedule, findBookingWithPaymentById, repoCreateCourtBooking, repoCreateCoachBooking, repoCreateComboBooking, repoCancelBookingById, repoCheckInBookingById, repoMockPayBooking, repoReleaseExpiredHoldings, repoAutoCheckInExpired, repoMarkCompletedExpiredCheckins, findBookingsByUserId, findBookingsByCoachUserId, findBookingById, findDailyBookingsForStaff, repoCreateTeamBooking } from "./bookings.repository";
import { calculateHours, validateBookingDate, validateHoldingLimit, validateCoachFeePerHour } from "./bookings.validation";
import { isScheduleExpired } from "../coaches/coaches.validation";
import { sendBookingCreatedEmail, sendPaymentSuccessEmail, sendCoachAssignedEmail, sendNoShowEmail, sendPaymentExpiredEmail } from "@/utils/mail";
import { countActiveGroupMembers } from "../playgroups/playgroups.repository";
import { AppError } from "@/utils/AppError";
import { getPool, sql } from "@/database/connection";

// ---- Create Bookings ----

/**
 * UC-13: Dat san Court.
 * BR-22: requireAuth (xu ly o controller).
 * BR-23: validateBookingDate.
 * BR-40: max 3 Holding.
 * BR-25/27/28: xu ly trong repository (transaction SERIALIZABLE, HoldUntil).
 */
export async function createCourtBooking(input: CreateCourtBookingInput) {
  // BR-23 + Real-time check
  validateBookingDate(input.bookingDate, input.startTime);

  const isStaffWalkIn =
    !!input.paymentMethod &&
    ["Cash", "BankTransfer"].includes(input.paymentMethod) &&
    !!input.userRoles?.some((role) => ["Admin", "Staff", "Manager"].includes(role));

  if (input.paymentMethod && !isStaffWalkIn) {
    throw new Error("Chi Staff/Admin moi duoc tao booking thanh toan tai quay");
  }

  let bookingUserId = input.userId;
  let walkInNote: string | undefined;

  if (isStaffWalkIn) {
    if (input.customerId) {
      bookingUserId = input.customerId;
    } else {
      if (!input.guestName?.trim() || !input.guestPhone?.trim()) {
        throw new Error("Vui long nhap ten va so dien thoai khach vang lai");
      }

      if (!/^\d{10}$/.test(input.guestPhone.trim())) {
        throw new Error("So dien thoai khach vang lai phai gom dung 10 chu so");
      }

      const guestUser = await getOrCreateWalkInGuestUser();
      if (!guestUser) throw new Error("Khong the tao tai khoan khach vang lai");
      bookingUserId = Number(guestUser.UserID);
    }

    walkInNote = [
      "[Walk-in]",
      `StaffID:${input.userId}`,
      input.customerId ? `CustomerID:${input.customerId}` : undefined,
      input.guestName?.trim() ? `GuestName:${input.guestName.trim()}` : undefined,
      input.guestPhone?.trim() ? `GuestPhone:${input.guestPhone.trim()}` : undefined,
      `Payment:${input.paymentMethod}`,
    ].filter(Boolean).join(" | ");
  }

  // BR-22 (userId da duoc lay tu JWT o controller)
  const user = await findUserById(bookingUserId);
  if (!user) throw new Error("Nguoi dung khong ton tai");
  if (user.Status !== "Active") throw new Error("Tai khoan nguoi dung khong hoat dong");

  // BR-40
  if (!isStaffWalkIn) {
    await validateHoldingLimit(bookingUserId);
  }

  const court = await findCourtByIdForBooking(input.courtId);
  if (!court) throw new Error("San khong ton tai");
  if (court.Status !== "Available") throw new Error("San hien khong kha dung");

  // BR-24/27: tim slot kha dung
  const slot = await findAvailableCourtSlot(
    input.courtId,
    input.bookingDate,
    input.startTime,
    input.endTime
  );
  if (!slot) throw new Error("Khung gio nay da bi dat hoac khong co slot phu hop");

  const slotPrice = Number(slot.Price);
  let courtFee = slotPrice;
  let originalAmount = slotPrice;
  let discountAmount = 0;
  let promotionId: number | null = null;

  try {
    const startHour = parseInt(input.startTime.split(":")[0], 10);
    const endHour = parseInt(input.endTime.split(":")[0], 10);
    const targetDate = new Date(input.bookingDate).toISOString().split("T")[0];

    const pool = await getPool();
    const promoRes = await pool.request()
      .input("CourtID", sql.Int, input.courtId)
      .input("TargetDate", sql.Date, targetDate)
      .input("StartHour", sql.Int, startHour)
      .input("EndHour", sql.Int, endHour)
      .query(`
        SELECT TOP 1 PromotionID, DiscountValue
        FROM Promotions
        WHERE Status = 'Active' 
          AND StartDate <= @TargetDate AND EndDate >= @TargetDate
          AND TargetDate = @TargetDate
          AND (TargetCourtID IS NULL OR TargetCourtID = @CourtID)
          AND TargetHourStart IS NOT NULL AND TargetHourEnd IS NOT NULL
          AND @StartHour >= TargetHourStart AND @EndHour <= TargetHourEnd
        ORDER BY DiscountValue DESC
      `);

    if (promoRes.recordset.length > 0) {
      const promo = promoRes.recordset[0];
      promotionId = promo.PromotionID;
      const discountPercent = Number(promo.DiscountValue);
      discountAmount = slotPrice * (discountPercent / 100);
      courtFee = slotPrice - discountAmount;
    }
  } catch (err) {
    console.error("[Booking Dynamic Pricing] Error resolving dynamic slot price:", err);
  }

  // BR-39: Khong cho dat vao slot da Cancelled (xu ly bang Status check o DB)
  const result = await repoCreateCourtBooking({
    userId: bookingUserId,
    courtId: input.courtId,
    slotId: slot.SlotID,
    bookingDate: input.bookingDate,
    startTime: input.startTime,
    endTime: input.endTime,
    courtFee,
    originalAmount,
    discountAmount,
    promotionId,
    paymentMethod: isStaffWalkIn ? input.paymentMethod : undefined,
    walkInNote,
    bookedByStaffId: isStaffWalkIn ? input.userId : undefined,
    guestName: isStaffWalkIn ? input.guestName?.trim() : undefined,
    guestPhone: isStaffWalkIn ? input.guestPhone?.trim() : undefined,
  });

  if (result && result.BookingID) {
    try {
      void createNotification({
        userId: input.userId,
        title: "Đặt sân thành công",
        message: "Bạn đã đặt sân thành công. Vui lòng thanh toán trong 10 phút.",
        notificationType: "Booking",
      });

      // Gửi email xác nhận đặt sân kèm mã booking
      // Xoá gửi email lúc tạo booking để tránh nhầm lẫn, chỉ gửi lúc thanh toán thành công
      // void sendBookingCreatedEmail(user.Email, {
      //   ...
      // });
    } catch (err) {
      console.warn("Error sending notification:", err);
    }
  }

  return result;
}

export async function createWalkInCourtBooking(input: CreateWalkInCourtBookingInput) {
  const booking = await createCourtBooking({
    userId: input.staffId,
    userRoles: input.staffRoles,
    courtId: input.courtId,
    bookingDate: input.bookingDate,
    startTime: input.startTime,
    endTime: input.endTime,
    customerId: input.customerId,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
    paymentMethod: input.paymentMethod,
  });

  await createSystemLog({
    userId: input.staffId,
    action: "STAFF_WALKIN_BOOKING_CREATE",
    entityType: "Booking",
    entityId: booking.BookingID,
    description: `Staff tao booking tai quay ${booking.BookingCode}`,
    newValue: {
      bookingId: booking.BookingID,
      bookingCode: booking.BookingCode,
      customerId: input.customerId,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      paymentMethod: input.paymentMethod,
      totalAmount: booking.TotalAmount,
    },
  });

  return booking;
}

/**
 * UC-13 mo rong: Dat Coach.
 * BR-41: Coach phai Approved.
 * BR-42/43: Coach fee trong khoang hop le.
 * BR-44/46: xu ly trong repository (Available + buffer 15 phut).
 */
export async function createCoachBooking(input: CreateCoachBookingInput) {
  validateBookingDate(input.bookingDate, input.startTime);

  if (isScheduleExpired(input.bookingDate, input.endTime)) {
    throw new Error("Khung giờ này đã kết thúc, không thể đặt lịch.");
  }

  const user = await findUserById(input.userId);
  if (!user) throw new Error("Nguoi dung khong ton tai");
  if (user.Status !== "Active") throw new Error("Tai khoan nguoi dung khong hoat dong");

  await validateHoldingLimit(input.userId);

  const coach = await findCoachByIdForBooking(input.coachId);
  if (!coach) throw new Error("HLV khong ton tai");
  if (coach.Status !== "Approved") throw new Error("HLV chua duoc duyet (BR-41)");

  // BR-42/43
  validateCoachFeePerHour(Number(coach.HourlyRate));

  const hours = calculateHours(input.startTime, input.endTime);
  const coachFee = Number(coach.HourlyRate) * hours;

  // BR-44/46: findAvailableCoachSchedule da kiem tra buffer 15 phut
  const coachSchedule = await findAvailableCoachSchedule(
    input.coachId,
    input.bookingDate,
    input.startTime,
    input.endTime
  );
  if (!coachSchedule) {
    throw new Error("HLV khong co lich trong khung gio nay hoac vi pham buffer 15 phut (BR-46)");
  }

  const result = await repoCreateCoachBooking({
    userId: input.userId,
    coachId: input.coachId,
    coachScheduleId: coachSchedule.CoachScheduleID,
    bookingDate: input.bookingDate,
    startTime: input.startTime,
    endTime: input.endTime,
    coachFee,
  });

  if (result && result.BookingID) {
    try {
      void createNotification({
        userId: input.userId,
        title: "Đặt HLV thành công",
        message: "Bạn đã đặt lịch HLV thành công. Vui lòng thanh toán trong 10 phút.",
        notificationType: "Booking",
      });

      // Gửi email xác nhận đặt HLV kèm mã booking
      // Xoá gửi email lúc tạo booking để tránh nhầm lẫn
    } catch (err) {
      console.warn("Error sending coach booking created email/notification:", err);
    }
  }

  return result;
}

/**
 * UC-15: Dat Combo (San + HLV cung giao dich - BR-28 atomic).
 */
export async function createComboBooking(input: CreateComboBookingInput) {
  validateBookingDate(input.bookingDate, input.startTime);

  if (isScheduleExpired(input.bookingDate, input.endTime)) {
    throw new Error("Khung giờ này đã kết thúc, không thể đặt lịch.");
  }

  const user = await findUserById(input.userId);
  if (!user) throw new Error("Nguoi dung khong ton tai");
  if (user.Status !== "Active") throw new Error("Tai khoan nguoi dung khong hoat dong");

  await validateHoldingLimit(input.userId);

  const court = await findCourtByIdForBooking(input.courtId);
  if (!court) throw new Error("San khong ton tai");
  if (court.Status !== "Available") throw new Error("San hien khong kha dung");

  const coach = await findCoachByIdForBooking(input.coachId);
  if (!coach) throw new Error("HLV khong ton tai");
  if (coach.Status !== "Approved") throw new Error("HLV chua duoc duyet (BR-41)");

  // BR-42/43
  validateCoachFeePerHour(Number(coach.HourlyRate));

  const hours = calculateHours(input.startTime, input.endTime);
  const coachFee = Number(coach.HourlyRate) * hours;

  const slot = await findAvailableCourtSlot(
    input.courtId,
    input.bookingDate,
    input.startTime,
    input.endTime
  );
  if (!slot) throw new Error("Khung gio san da bi dat");

  const courtFee = Number(slot.Price);

  // BR-46
  const coachSchedule = await findAvailableCoachSchedule(
    input.coachId,
    input.bookingDate,
    input.startTime,
    input.endTime
  );
  if (!coachSchedule) {
    throw new Error("HLV khong co lich trong khung gio nay hoac vi pham buffer 15 phut (BR-46)");
  }

  const result = await repoCreateComboBooking({
    userId: input.userId,
    courtId: input.courtId,
    coachId: input.coachId,
    slotId: slot.SlotID,
    coachScheduleId: coachSchedule.CoachScheduleID,
    bookingDate: input.bookingDate,
    startTime: input.startTime,
    endTime: input.endTime,
    courtFee,
    coachFee,
  });

  if (result && result.BookingID) {
    try {
      void createNotification({
        userId: input.userId,
        title: "Đặt sân thành công",
        message: "Bạn đã đặt sân thành công. Đang chờ thanh toán.",
        notificationType: "Booking",
      });

      const coachName = coach && coach.UserID ? (await findUserById(coach.UserID))?.FullName || "HLV" : "HLV";

      // Gửi email xác nhận đặt Combo kèm mã booking
      // Xoá gửi email lúc tạo booking để tránh nhầm lẫn
    } catch (err) {
      console.warn("Error sending combo booking created email/notification:", err);
    }
  }

  return result;
}

// ---- Cancel Booking (UC-17) ----

/**
 * UC-17: Huy booking.
 * BR-NEW-01: Chi cancel khi Status = PendingPayment hoac Confirmed.
 * BR-NEW-02: Chi chu booking hoac Admin/Staff duoc cancel.
 * BR-33: Huy >= 12 gio truoc → refund 100%.
 * BR-34: Huy < 12 gio va >= 2 gio → refund 70%.
 * BR-35: Huy < 2 gio → khong refund.
 * BR-NEW-03: Release slot/schedule ve Available.
 */
export async function cancelBooking(
  input: CancelBookingInput
): Promise<CancelBookingResult> {
  const booking = await findBookingWithPaymentById(input.bookingId);

  if (!booking) {
    throw new Error("Booking khong ton tai");
  }

  // BR-NEW-02: Kiem tra quyen cancel
  const isOwner = booking.UserID === input.userId;
  const isAdminOrStaff = input.userRoles.some((r) =>
    ["Admin", "Staff"].includes(r)
  );
  if (!isOwner && !isAdminOrStaff) {
    throw new Error("Ban khong co quyen huy booking nay (BR-NEW-02)");
  }

  // BR-NEW-01: Chi cancel khi dang PendingPayment hoac Confirmed
  if (!["PendingPayment", "Confirmed"].includes(booking.Status)) {
    throw new Error(
      `Khong the huy booking co trang thai ${booking.Status}. Chi huy duoc khi dang cho thanh toan hoac da xac nhan (BR-NEW-01)`
    );
  }

  if (booking.Status === "PendingPayment") {
    const cancelReason = input.cancelReason ?? "Huy boi nguoi dung (chua thanh toan).";
    await repoCancelBookingById(input.bookingId, cancelReason);

    void createNotification({
      userId: input.userId,
      title: "Booking da bi huy",
      message: `Booking #${booking.BookingCode} da bi huy thanh cong.`,
      notificationType: "Booking",
    });

    return {
      bookingId: input.bookingId,
      status: "Cancelled",
      refundAmount: 0,
      refundPercent: 0,
      refundNote: "",
      refundRecord: null as any,
    };
  }

  // Tinh thoi gian den khi bat dau choi
  let startTimeStr = '';
  if (typeof booking.StartTime === 'string') {
    startTimeStr = booking.StartTime;
  } else if (booking.StartTime instanceof Date) {
    const hh = String(booking.StartTime.getUTCHours()).padStart(2, '0');
    const mm = String(booking.StartTime.getUTCMinutes()).padStart(2, '0');
    startTimeStr = `${hh}:${mm}`;
  } else {
    startTimeStr = '00:00';
  }

  let dateStr = '';
  if (typeof booking.BookingDate === 'string') {
    dateStr = booking.BookingDate.split('T')[0];
  } else {
    const yyyy = booking.BookingDate.getFullYear();
    const mm = String(booking.BookingDate.getMonth() + 1).padStart(2, '0');
    const dd = String(booking.BookingDate.getDate()).padStart(2, '0');
    dateStr = `${yyyy}-${mm}-${dd}`;
  }

  const bookingStartDateTime = new Date(`${dateStr}T${startTimeStr}:00+07:00`);
  const now = new Date();
  const hoursUntilStart = (bookingStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Tinh refund
  let refundPercent = 0;
  let refundNote = "";

  if (hoursUntilStart >= 12) {
    // BR-33: Huy truoc 12 gio → refund 100%
    refundPercent = 100;
    refundNote = "Huy truoc 12 gio - hoan 100% (BR-33)";
  } else if (hoursUntilStart >= 2) {
    // BR-34: Huy trong 2-12 gio → refund 70%
    refundPercent = 70;
    refundNote = "Huy trong 2-12 gio - hoan 70%, tru 30% phi (BR-34)";
  } else {
    // BR-35: Huy trong 2 gio → khong refund
    refundPercent = 0;
    refundNote = "Huy trong vong 2 gio - khong duoc hoan tien (BR-35)";
  }

  const totalAmount = Number(booking.TotalAmount);
  const refundAmount = Math.round((totalAmount * refundPercent) / 100);
  const cancelReason = input.cancelReason ?? `Huy boi nguoi dung. ${refundNote}`;

  let refundRecord = null as any;

  if (refundAmount > 0) {
    // Nêú có hoàn tiền, requestRefund sẽ xử lý tạo RefundRecord VÀ cancel booking
    refundRecord = await requestRefund(
      input.bookingId,
      booking.UserID, // Gọi thay mặt chủ booking (để pass ownership check)
      cancelReason
    );
  } else {
    // Nêú không hoàn tiền (hoặc <= 0), chỉ cancel booking
    await repoCancelBookingById(input.bookingId, cancelReason);
  }

  // Gui notification cho user (chu booking)
  void createNotification({
    userId: booking.UserID,
    title: "Booking đã bị hủy",
    message: `Booking #${booking.BookingCode} đã bị hủy. ${refundNote}`,
    notificationType: "Booking",
  });

  return {
    bookingId: input.bookingId,
    status: "Cancelled",
    refundAmount,
    refundPercent,
    refundNote,
    refundRecord,
  };
}

/**
 * BR-54: Coach chu dong huy booking Confirmed.
 * Player duoc hoan 100% trong 24 gio, gui notification ngay.
 */
export async function cancelBookingByCoach(
  bookingId: number,
  coachUserId: number
): Promise<CancelBookingResult> {
  const booking = await findBookingWithPaymentById(bookingId);

  if (!booking) throw new Error("Booking khong ton tai");
  if (booking.Status !== "Confirmed") {
    throw new Error("Chi co the huy booking o trang thai Confirmed (BR-54)");
  }

  let bookingDateStr = "";
  if (typeof booking.BookingDate === "string") {
    bookingDateStr = booking.BookingDate.split("T")[0];
  } else if (booking.BookingDate instanceof Date) {
    bookingDateStr = [
      booking.BookingDate.getFullYear(),
      String(booking.BookingDate.getMonth() + 1).padStart(2, '0'),
      String(booking.BookingDate.getDate()).padStart(2, '0')
    ].join('-');
  }

  const sessionStartTime = new Date(`${bookingDateStr}T${booking.StartTime}:00+07:00`);
  if (sessionStartTime.getTime() <= Date.now()) {
    throw new Error("Không thể hủy buổi dạy đã bắt đầu hoặc đã kết thúc");
  }

  const cancelReason =
    "HLV chu dong huy - hoan 100% trong 24 gio (BR-54)";

  const totalAmount = Number(booking.TotalAmount);

  // BR-54: Hoàn 100% bất kể thời gian.
  // Dùng requestCoachCancelRefund thay vì requestRefund vì:
  //   - requestRefund tính hoàn theo thời gian (có thể < 100% hoặc throw nếu < 2h)
  //   - requestCoachCancelRefund luôn hoàn 100% và tự cancel booking đúng thứ tự
  // KHÔNG gọi repoCancelBookingById trước — requestCoachCancelRefund xử lý cancel nội bộ
  const refundRecord = await requestCoachCancelRefund(bookingId, booking.UserID, cancelReason);

  // BR-54: Gui notification cho Player ngay lap tuc
  void createNotification({
    userId: booking.UserID,
    title: "HLV da huy lich day",
    message: `HLV da huy lich day cho booking #${booking.BookingCode}. Ban se duoc hoan 100% so tien (${totalAmount.toLocaleString("vi-VN")} VND) trong 24 gio.`,
    notificationType: "Booking",
  });

  // Gui notification cho coach
  void createNotification({
    userId: coachUserId,
    title: "Ban da huy lich day",
    message: `Ban da huy booking #${booking.BookingCode}. He thong se hoan 100% cho Player.`,
    notificationType: "Booking",
  });

  return {
    bookingId,
    status: "Cancelled",
    refundAmount: totalAmount,
    refundPercent: 100,
    refundNote: cancelReason,
    refundRecord,
  };
}

// ---- Check-in (BR-29/30) ----

/**
 * BR-29: Chi check-in khi booking da Confirmed.
 * BR-30 (Updated): Chi duoc check-in khi da den hoac dang trong gio choi.
 *   - Admin/Staff co the check-in bat ky luc nao trong ngay dat san.
 *   - User thuong: chi duoc check-in khi da den gio bat dau (khong cho check-in som).
 * Auto check-in: neu admin/staff quen, he thong tu dong check-in sau khi het gio choi.
 */
export async function checkInBooking(
  input: CheckInInput
): Promise<CheckInResult> {
  const booking = await findBookingById(input.bookingId);

  if (!booking) throw new Error("Booking khong ton tai");

  // Kiem tra ownership (Bo qua neu la Admin hoac Staff)
  const isAdminOrStaff = input.userRoles?.some((r) => ["Admin", "Staff"].includes(r));
  if (!isAdminOrStaff && booking.UserID !== input.userId) {
    throw new Error("Ban khong co quyen check-in booking nay");
  }

  // BR-29
  if (!["Confirmed", "Paid"].includes(booking.Status)) {
    throw new Error(
      `Chi check-in duoc khi booking o trang thai Confirmed/Paid (hien tai: ${booking.Status}) (BR-29)`
    );
  }

  // Lay gio hien tai o Viet Nam
  const nowVN = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );

  const vnDateStr = new Date(booking.BookingDate).toLocaleDateString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [month, day, year] = vnDateStr.split("/");
  const dateStr = `${year}-${month}-${day}`;

  const bookingStartDateTime = new Date(`${dateStr}T${booking.StartTime}:00`);
  const bookingEndDateTime = new Date(`${dateStr}T${booking.EndTime}:00`);

  // Admin/Staff: chi can trong ngay dat san la check-in duoc
  // User thuong: chi duoc check-in khi da den hoac dang trong gio choi
  if (!isAdminOrStaff) {
    // User: Khong duoc check-in truoc gio bat dau
    if (nowVN.getTime() < bookingStartDateTime.getTime()) {
      throw new Error("Chưa đến giờ chơi. Bạn chỉ có thể check-in khi đã đến hoặc đang trong giờ chơi.");
    }
    // User: Khong duoc check-in sau khi gio choi da ket thuc
    if (nowVN.getTime() > bookingEndDateTime.getTime()) {
      throw new Error("Đã quá thời gian check-in. Giờ chơi đã kết thúc.");
    }
  } else {
    // Admin/Staff: Check-in duoc trong cung ngay dat san
    const bookingDateOnly = new Date(`${dateStr}T00:00:00`);
    const bookingDateEnd = new Date(`${dateStr}T23:59:59`);
    if (nowVN.getTime() < bookingDateOnly.getTime() || nowVN.getTime() > bookingDateEnd.getTime()) {
      throw new Error("Chỉ có thể check-in trong ngày diễn ra sự kiện.");
    }
  }

  await repoCheckInBookingById(input.bookingId);

  const checkInTime = new Date().toISOString();

  // Gui notification
  void createNotification({
    userId: booking.UserID,
    title: "Check-in thanh cong",
    message: `Ban da check-in thanh cong cho booking #${booking.BookingCode}. Chuc ban choi vui ve!`,
    notificationType: "Booking",
  });

  return {
    bookingId: input.bookingId,
    status: "CheckedIn",
    checkInTime,
  };
}

// ---- Mock Pay ----

/**
 * Mock thanh toan: PendingPayment → Confirmed.
 * Dev sau thay bang VNPay/Momo webhook.
 */
export async function mockPayBooking(
  bookingId: number,
  userId: number,
  paymentMethod: "VNPay" | "Momo" = "VNPay"
) {
  const booking = await findBookingById(bookingId);

  if (!booking) throw new Error("Booking khong ton tai");
  if (booking.UserID !== userId) throw new Error("Ban khong co quyen thanh toan booking nay");
  if (booking.Status !== "PendingPayment") {
    throw new Error(`Booking o trang thai ${booking.Status}, khong the thanh toan`);
  }

  const deadline = new Date(calculatePaymentDeadline(booking.CreatedAt, booking.BookingDate, booking.StartTime));
  if (Date.now() > deadline.getTime()) {
    // Release the booking since it's expired
    await cancelBooking({
      bookingId,
      userId: booking.UserID,
      userRoles: ["Admin"], // Allow system cancellation
      cancelReason: "Hết hạn thanh toán",
    });
    throw new Error("Booking đã hết hạn thanh toán và đã tự động bị huỷ.");
  }

  await repoMockPayBooking(bookingId, paymentMethod);

  try {
    // Gui notification
    void createNotification({
      userId,
      title: "Thanh toán thành công",
      message: `Bạn đã đặt sân và thanh toán thành công cho booking #${booking.BookingCode} qua ${paymentMethod}. Chúc bạn chơi vui vẻ!`,
      notificationType: "Payment",
    });

    const { getPool, sql } = await import("@/database/connection");
    const pool = await getPool();

    const bkResult = await pool
      .request()
      .input("BookingID", sql.Int, bookingId)
      .query(`
        SELECT b.BookingCode, b.BookingType,
               CONVERT(VARCHAR(10), b.BookingDate, 103) AS BookingDate,
               CONVERT(VARCHAR(5), bd.StartTime, 108) AS StartTime,
               CONVERT(VARCHAR(5), bd.EndTime, 108) AS EndTime,
               b.DiscountAmount,
               u.UserID, u.Email, u.FullName,
               c.CourtName,
               co.UserID AS CoachUserID
        FROM Bookings b
        JOIN Users u ON b.UserID = u.UserID
        LEFT JOIN BookingDetails bd ON bd.BookingID = b.BookingID
        LEFT JOIN Courts c ON bd.CourtID = c.CourtID
        LEFT JOIN Coaches co ON bd.CoachID = co.CoachID
        WHERE b.BookingID = @BookingID
      `);

    const bk = bkResult.recordset[0];

    if (bk && bk.Email) {
      let coachName = "HLV";
      if (bk.CoachUserID) {
        const coachUserRes = await pool.request().input("UID", sql.Int, bk.CoachUserID).query("SELECT FullName FROM Users WHERE UserID = @UID");
        if (coachUserRes.recordset[0]) coachName = coachUserRes.recordset[0].FullName;
      }

      let bookingTypeStr = "Sân (Court)";
      if (bk.BookingType === "Coach") bookingTypeStr = "HLV (Coach)";
      if (bk.BookingType === "Combo") bookingTypeStr = "Combo (Sân + HLV)";

      const { sendPaymentSuccessEmail } = await import("@/utils/mail");
      void sendPaymentSuccessEmail(bk.Email, {
        playerName: bk.FullName,
        bookingCode: bk.BookingCode,
        bookingType: bookingTypeStr,
        bookingDate: bk.BookingDate,
        startTime: bk.StartTime,
        endTime: bk.EndTime,
        courtName: bk.CourtName,
        coachName: bk.BookingType !== "Court" ? coachName : undefined,
        amount: booking.TotalAmount,
        discountAmount: bk.DiscountAmount,
        paymentMethod: paymentMethod
      });
    }

    if (booking.CoachID) {
      const { getPool, sql } = await import("@/database/connection");
      const pool = await getPool();
      const coachRes = await pool.request().input("CoachID", sql.Int, booking.CoachID).query("SELECT UserID, FullName, Email FROM Coaches c JOIN Users u ON c.UserID = u.UserID WHERE c.CoachID = @CoachID");
      const coachData = coachRes.recordset[0];
      if (coachData && coachData.UserID) {
        void createNotification({
          userId: coachData.UserID,
          title: "Có lịch dạy mới",
          message: `Booking #${booking.BookingCode} đã được thanh toán và đặt lịch thành công với bạn.`,
          notificationType: "Booking"
        });

        if (coachData.Email) {
          void sendCoachAssignedEmail(coachData.Email, {
            bookingCode: booking.BookingCode,
            playerName: bk ? bk.FullName : "Player",
            bookingDate: booking.BookingDate,
            startTime: booking.StartTime,
            endTime: booking.EndTime,
            bookingType: booking.BookingType === "Combo" ? "Combo (Sân + HLV)" : "Thuê HLV",
          });
        }
      }
    }
  } catch (err) {
    console.warn("Error sending payment success/coach assigned notifications:", err);
  }

  return {
    bookingId,
    bookingCode: booking.BookingCode,
    status: "Confirmed",
    paymentMethod,
    message: "Thanh toan thanh cong. Booking da duoc xac nhan.",
  };
}

// ---- Release Expired (BR-26/31/32) ----

/**
 * BR-26: Giai phong cac booking het han.
 * (Modified): Tu dong check-in cac booking da het thoi gian choi thay vi No-show.
 */
export async function releaseExpiredBookings() {
  const [releasedData, autoCheckedInCount] = await Promise.all([
    repoReleaseExpiredHoldings(),  // BR-26
    repoAutoCheckInExpired(),        // Modified BR-31 (Auto Check-In)
  ]);

  for (const b of releasedData.expiredBookings) {
    void sendPaymentExpiredEmail(b.Email, {
      bookingCode: b.BookingCode,
    });
  }

  return {
    releasedHoldings: releasedData.releasedCount,
    autoCheckedIn: autoCheckedInCount,
    message: `Da giai phong ${releasedData.releasedCount} booking Holding het han, tu dong check-in ${autoCheckedInCount} booking da het gio`,
  };
}

/**
 * BR-32: Tu dong chuyen booking tu CheckedIn sang Completed.
 * Dieu kien: booking da check-in VA da het gio choi (EndTime + 30 phut).
 */
export async function completeCheckedInBookings() {
  const completedCount = await repoMarkCompletedExpiredCheckins();

  return {
    completedCount,
    message: `Da hoan thanh ${completedCount} booking CheckedIn het gio choi (BR-32)`,
  };
}

// ---- Helper: Calculate Payment Deadline ----

function calculatePaymentDeadline(createdAt: Date, bookingDate: Date | string, startTime: string): string {
  // DB stores local time via GETDATE(), but mssql driver treats it as UTC.
  // Fix timezone issue when deployed to AWS (UTC) vs Local (UTC+7).
  let realUtcTime = new Date(createdAt).getTime();

  // If the parsed DB time is significantly in the future compared to now (e.g., > 4 hours),
  // it means the DB returned a UTC+7 time but the mssql driver parsed it as UTC.
  // We subtract 7 hours to get the real UTC time.
  if (realUtcTime > Date.now() + 4 * 60 * 60 * 1000) {
    realUtcTime -= 7 * 60 * 60 * 1000;
  }
  
  const deadline1 = new Date(realUtcTime + 10 * 60 * 1000);

  const dateStr = new Date(bookingDate).toLocaleDateString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [month, day, year] = dateStr.split("/");
  const deadline2 = new Date(`${year}-${month}-${day}T${startTime}:00+07:00`);

  return deadline1 < deadline2 ? deadline1.toISOString() : deadline2.toISOString();
}

// ---- View Bookings ----

export async function getMyBookings(userId: number) {
  const user = await findUserById(userId);
  if (!user) throw new Error("Nguoi dung khong ton tai");
  const bookings = await findBookingsByUserId(userId);

  return bookings.map((b) => ({
    ...b,
    PaymentDeadline: b.Status === "PendingPayment"
      ? calculatePaymentDeadline(b.CreatedAt, b.BookingDate, b.StartTime)
      : null
  }));
}

export async function getCoachReceivedBookings(userId: number) {
  const user = await findUserById(userId);
  if (!user) throw new Error("Nguoi dung khong ton tai");
  const bookings = await findBookingsByCoachUserId(userId);

  return bookings.map((b) => ({
    ...b,
    PaymentDeadline: b.Status === "PendingPayment"
      ? calculatePaymentDeadline(b.CreatedAt, b.BookingDate, b.StartTime)
      : null
  }));
}

export async function getBookingDetail(bookingId: number, userId: number, userRoles: string[]) {
  const booking = await findBookingById(bookingId);
  if (!booking) throw new Error("Booking khong ton tai");

  // Chi chu booking hoac Admin/Staff moi xem duoc chi tiet
  const isOwner = booking.UserID === userId;
  const isAdminOrStaff = userRoles.some((r) => ["Admin", "Staff"].includes(r));

  if (!isOwner && !isAdminOrStaff) {
    throw new Error("Ban khong co quyen xem booking nay");
  }

  const paymentDeadline = booking.Status === "PendingPayment"
    ? calculatePaymentDeadline(booking.CreatedAt, booking.BookingDate, booking.StartTime)
    : null;

  return { ...booking, PaymentDeadline: paymentDeadline };
}

/**
 * UC-49: Staff xem booking trong ngay.
 * BR-NEW-04: Chi Staff/Admin moi duoc goi (xu ly o controller).
 */
export async function getDailyBookings(date?: string) {
  const bookings = await findDailyBookingsForStaff(date);
  return bookings.map((b) => ({
    ...b,
    PaymentDeadline: b.Status === "PendingPayment"
      ? calculatePaymentDeadline((b as any).CreatedAt || new Date(), b.BookingDate, b.StartTime)
      : null
  }));
}

// ---- Team Booking (UC-36) ----

/**
 * UC-36: Dat san sau khi ghep nhom thanh cong.
 *
 * BR dependencies:
 * - BR-23: Ngay dat >= hom nay
 * - BR-28: Transaction locking chong double booking
 * - BR-40: Max 3 Holding cung luc (ap dung cho tat ca thanh vien nhom)
 * - BR-91: Nhom toi da 4 nguoi (validate tu PlayGroups module)
 * - BR-92: Player max 3 nhom active (validate tu PlayGroups module)
 *
 * TODO: Implement day du sau khi PlayGroups & PlayerMatching module hoan thanh.
 *       Can goi: playgroupsService.validateGroupForBooking(groupId)
 *                matchingService.validateMatchStatus(matchId)
 */
export async function createTeamBooking(input: {
  userId: number;      // Nguoi dat (leader of group)
  groupId: number;     // PlayGroup ID sau khi match thanh cong
  courtId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
}) {
  // BR-23
  validateBookingDate(input.bookingDate, input.startTime);

  // Validate duration <= 2 hours (120 minutes)
  const [startH, startM] = input.startTime.split(':').map(Number);
  const [endH, endM] = input.endTime.split(':').map(Number);
  const durationMins = (endH * 60 + endM) - (startH * 60 + startM);

  if (durationMins <= 0) {
    throw new AppError("Thời gian kết thúc phải sau thời gian bắt đầu.", 400);
  }
  if (durationMins > 120) {
    throw new AppError("Bạn chỉ có thể đặt tối đa 2 giờ liên tiếp cho một lần đặt sân nhóm.", 400);
  }

  // Validate user
  const user = await findUserById(input.userId);
  if (!user) throw new Error("Nguoi dung khong ton tai");
  if (user.Status !== "Active") throw new Error("Tai khoan nguoi dung khong hoat dong");

  // BR-40
  await validateHoldingLimit(input.userId);

  // Validate court
  const court = await findCourtByIdForBooking(input.courtId);
  if (!court) throw new Error("San khong ton tai");
  if (court.Status !== "Available") throw new Error("San hien khong kha dung");

  // Validate group member count for team booking
  const activeCount = await countActiveGroupMembers(input.groupId);
  if (activeCount < 2) {
    throw new Error("Nhóm của bạn cần có ít nhất 2 thành viên đang hoạt động để đặt sân nhóm. (Lưu ý: Để kiểm tra nhóm đối thủ, hệ thống cần bổ sung payload ở phase sau).");
  }

  // Tao booking voi type = 'Team' va ghi nhan groupId
  return repoCreateTeamBooking({
    userId: input.userId,
    groupId: input.groupId,
    courtId: input.courtId,
    bookingDate: input.bookingDate,
    startTime: input.startTime,
    endTime: input.endTime,
  });
}
