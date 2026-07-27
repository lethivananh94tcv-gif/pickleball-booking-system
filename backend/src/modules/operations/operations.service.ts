import { repoGetTodayOperations, repoGetBookingStatus, repoUpdateBookingStatus, repoGetExpiredConfirmedBookings } from "./operations.repository";
import { findBookingById, findUserById } from "../bookings/bookings.repository";
import { createAuditLog } from "../logs/logs.service";
import { createNotification } from "../notifications/notifications.service";
import { sendNoShowEmail } from "@/utils/mail";
import { getPool, sql } from "@/database/connection";
import { TodayOperationsData, OperationSummary } from "./operations.type";

function getVNAbsoluteTime(dateUtc: Date | null | undefined, timeUtc: Date | null | undefined): Date | null {
  if (!dateUtc || !timeUtc) return null;
  try {
    const year = dateUtc.getUTCFullYear();
    const month = dateUtc.getUTCMonth() + 1;
    const date = dateUtc.getUTCDate();
    
    const hours = timeUtc.getUTCHours();
    const minutes = timeUtc.getUTCMinutes();
    
    const isoString = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+07:00`;
    return new Date(isoString);
  } catch (err) {
    console.warn("Failed to get VN Absolute time for date/time:", dateUtc, timeUtc, err);
    return null;
  }
}

export async function autoMarkNoShowBookings(targetDate: string): Promise<number> {
  const bookings = await repoGetExpiredConfirmedBookings(targetDate);
  const now = new Date();
  let autoNoShowCount = 0;

  for (const booking of bookings) {
    const bookingStart = getVNAbsoluteTime(booking.BookingDate, booking.StartTime);
    if (!bookingStart) {
      console.warn(`Booking ${booking.BookingCode} is missing BookingDate or StartTime. Skipping auto no-show check.`);
      continue;
    }
    const minNoShowTime = new Date(bookingStart.getTime() + 15 * 60000);

    if (now >= minNoShowTime) {
      const note = "Auto No-show: Khách không check-in sau 15 phút.";
      
      // Update status to NoShow and store note in CancelReason
      await repoUpdateBookingStatus(booking.BookingID, 'NoShow', note);
      
      // Audit log
      await createAuditLog({
        userId: null, // System
        actionName: "AUTO_NO_SHOW",
        tableName: "Bookings",
        entityId: booking.BookingID,
        description: "System automatically marked booking as No-show because customer did not check in within 15 minutes after start time."
      });

      const user = await findUserById(booking.UserID);
      if (user) {
        void sendNoShowEmail(user.Email, {
          bookingCode: booking.BookingCode,
          startTime: booking.StartTime,
          bookingDate: booking.BookingDate,
          isAuto: true,
        });
      }

      // Notify Player
      void createNotification({
        userId: booking.UserID,
        title: "Booking bị đánh dấu No-show",
        message: "Booking của bạn đã bị đánh dấu No-show do không check-in sau 15 phút kể từ giờ bắt đầu.",
        notificationType: "Booking"
      }).catch((err) => console.warn("Failed to create auto no-show player notification:", err));

      // Notify Coach if applicable
      if (booking.CoachID) {
        try {
          const pool = await getPool();
          const coachRes = await pool.request().input("CoachID", sql.Int, booking.CoachID).query("SELECT UserID FROM Coaches WHERE CoachID = @CoachID");
          const coachUserId = coachRes.recordset[0]?.UserID;
          
          if (coachUserId) {
            void createNotification({
              userId: coachUserId,
              title: "Booking bị No-show",
              message: "Một booking có bạn phụ trách đã bị đánh dấu No-show do khách không check-in.",
              notificationType: "Booking"
            }).catch((err) => console.warn("Failed to create auto no-show coach notification:", err));
          }
        } catch (err) {
          console.warn("Failed to notify coach on auto no-show:", err);
        }
      }

      autoNoShowCount++;
    }
  }

  return autoNoShowCount;
}

export async function getTodayOperations(dateParam?: string | null): Promise<TodayOperationsData> {
  const targetDate = dateParam || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  
  // Auto mark no-shows before fetching the list
  const autoNoShowCount = await autoMarkNoShowBookings(targetDate);
  
  const bookings = await repoGetTodayOperations(targetDate);
  
  const summary: OperationSummary = {
    totalBookings: 0,
    waitingCheckIn: 0,
    checkedIn: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };

  bookings.forEach(b => {
    switch(b.status) {
      case 'Confirmed':
      case 'Paid':
        summary.waitingCheckIn++;
        summary.totalBookings++;
        break;
      case 'CheckedIn':
        summary.checkedIn++;
        summary.totalBookings++;
        break;
      case 'Completed':
        summary.completed++;
        summary.totalBookings++;
        break;
      case 'Cancelled':
      case 'Refunded':
        summary.cancelled++;
        break;
      case 'NoShow':
        summary.noShow++;
        summary.totalBookings++;
        break;
    }
  });

  return {
    summary,
    bookings,
    autoNoShowCount,
  };
}

export async function checkInOperation(bookingId: number, note?: string, actorId?: number) {
  const booking = await repoGetBookingStatus(bookingId);
  if (!booking) throw new Error("Booking not found");
  
  if (!['Confirmed', 'Paid'].includes(booking.Status)) {
    throw new Error("Chỉ có thể check-in booking ở trạng thái Đã xác nhận hoặc Đã thanh toán.");
  }

  // BR-30: Check date must be today in Vietnam timezone
  const bookingDateStr = booking.BookingDate.toISOString().split('T')[0];
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  if (bookingDateStr !== todayStr) {
    throw new Error("Chỉ có thể check-in các booking trong ngày hôm nay.");
  }

  // BR-30: Check-in is valid within 30 minutes before start time and up to 15 minutes after start time
  const bookingStart = getVNAbsoluteTime(booking.BookingDate, booking.StartTime);
  if (!bookingStart) {
    throw new Error("Không tìm thấy thông tin giờ bắt đầu của booking.");
  }
  const now = new Date();
  const earliestCheckIn = new Date(bookingStart.getTime() - 30 * 60 * 1000);
  const latestCheckIn = new Date(bookingStart.getTime() + 15 * 60 * 1000);

  if (now < earliestCheckIn) {
    throw new Error("Chưa đến giờ check-in (chỉ cho phép trước giờ bắt đầu tối đa 30 phút).");
  }
  if (now > latestCheckIn) {
    throw new Error("Đã quá hạn check-in (chỉ cho phép sau giờ bắt đầu tối đa 15 phút).");
  }

  // Update status to CheckedIn and set CheckInTime
  await repoUpdateBookingStatus(bookingId, 'CheckedIn', note, true);

  const fullBooking = await findBookingById(bookingId);
  
  if (actorId) {
    await createAuditLog({
      userId: actorId,
      actionName: "CHECK_IN",
      tableName: "Bookings",
      entityId: bookingId,
      description: `Confirmed -> CheckedIn${note ? `. Note: ${note}` : ''}`
    });
  }

  if (fullBooking?.UserID) {
    await createNotification({
      userId: fullBooking.UserID,
      title: "Check-in thành công",
      message: `Booking ${booking.BookingCode} đã được check-in thành công. Chúc bạn chơi vui vẻ!`,
      notificationType: "System"
    });
  }

  if (fullBooking?.CoachID) {
    const pool = await getPool();
    const coachRes = await pool.request().input("CoachID", sql.Int, fullBooking.CoachID).query("SELECT UserID FROM Coaches WHERE CoachID = @CoachID");
    const coachUserId = coachRes.recordset[0]?.UserID;
    if (coachUserId) {
      await createNotification({
        userId: coachUserId,
        title: "Học viên đã check-in",
        message: `Học viên của booking ${booking.BookingCode} đã check-in tại sân.`,
        notificationType: "System"
      });
    }
  }

  return {
    bookingId,
    status: 'CheckedIn',
    checkInTime: new Date().toISOString()
  };
}

export async function completeOperation(bookingId: number, actorId?: number) {
  const booking = await repoGetBookingStatus(bookingId);
  if (!booking) throw new Error("Booking not found");
  
  if (booking.Status !== 'CheckedIn') {
    throw new Error("Chỉ có thể hoàn thành booking đang ở trạng thái Check-in.");
  }

  // BR-32: Booking only transitions to Completed when play session has ended for at least 30 minutes
  const bookingEnd = getVNAbsoluteTime(booking.BookingDate, booking.EndTime);
  if (!bookingEnd) {
    throw new Error("Không tìm thấy thông tin giờ kết thúc của booking.");
  }
  const now = new Date();
  const allowedCompletionTime = new Date(bookingEnd.getTime() + 30 * 60 * 1000);
  if (now < allowedCompletionTime) {
    throw new Error("Chỉ có thể hoàn thành booking sau khi kết thúc ca chơi ít nhất 30 phút.");
  }

  // Update status to Completed
  await repoUpdateBookingStatus(bookingId, 'Completed');

  const fullBooking = await findBookingById(bookingId);

  if (actorId) {
    await createAuditLog({
      userId: actorId,
      actionName: "COMPLETE",
      tableName: "Bookings",
      entityId: bookingId,
      description: "CheckedIn -> Completed"
    });
  }

  if (fullBooking?.UserID) {
    await createNotification({
      userId: fullBooking.UserID,
      title: "Booking hoàn thành",
      message: `Booking ${booking.BookingCode} đã hoàn thành. Cảm ơn bạn đã sử dụng dịch vụ!`,
      notificationType: "System"
    });
  }

  if (fullBooking?.CoachID) {
    const pool = await getPool();
    const coachRes = await pool.request().input("CoachID", sql.Int, fullBooking.CoachID).query("SELECT UserID FROM Coaches WHERE CoachID = @CoachID");
    const coachUserId = coachRes.recordset[0]?.UserID;
    if (coachUserId) {
      await createNotification({
        userId: coachUserId,
        title: "Buổi học hoàn thành",
        message: `Buổi học (Booking ${booking.BookingCode}) đã được đánh dấu hoàn thành.`,
        notificationType: "System"
      });
    }
  }

  return {
    bookingId,
    status: 'Completed'
  };
}

export async function noShowOperation(bookingId: number, note?: string, actorId?: number) {
  const booking = await repoGetBookingStatus(bookingId);
  if (!booking) throw new Error("Booking not found");
  
  if (!['Confirmed', 'Paid'].includes(booking.Status)) {
    throw new Error("Chỉ có thể đánh dấu No-show booking ở trạng thái Đã xác nhận hoặc Đã thanh toán.");
  }

  // BR-31: Only allow manual no-show on the booking date and after start time
  const bookingDateStr = booking.BookingDate.toISOString().split('T')[0];
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  if (bookingDateStr !== todayStr) {
    throw new Error("Chỉ có thể báo vắng các booking trong ngày hôm nay.");
  }

  const bookingStart = getVNAbsoluteTime(booking.BookingDate, booking.StartTime);
  if (!bookingStart) {
    throw new Error("Không tìm thấy thông tin giờ bắt đầu của booking.");
  }
  const now = new Date();
  if (now < bookingStart) {
    throw new Error("Không thể báo vắng trước giờ bắt đầu của booking.");
  }

  // Update status to NoShow
  await repoUpdateBookingStatus(bookingId, 'NoShow', note);

  const fullBooking = await findBookingById(bookingId);

  if (actorId) {
    await createAuditLog({
      userId: actorId,
      actionName: "NO_SHOW",
      tableName: "Bookings",
      entityId: bookingId,
      description: `Confirmed -> NoShow${note ? `. Reason: ${note}` : ''}`
    });
  }

  if (fullBooking?.UserID) {
    const user = await findUserById(fullBooking.UserID);
    if (user) {
      void sendNoShowEmail(user.Email, {
        bookingCode: booking.BookingCode,
        startTime: booking.StartTime,
        bookingDate: booking.BookingDate,
        isAuto: false,
        reason: note,
      });
    }

    await createNotification({
      userId: fullBooking.UserID,
      title: "Vắng mặt (No-show)",
      message: `Booking ${booking.BookingCode} đã bị đánh dấu vắng mặt. Vui lòng liên hệ nếu có sai sót.`,
      notificationType: "System"
    });
  }

  return {
    bookingId,
    status: 'NoShow'
  };
}
