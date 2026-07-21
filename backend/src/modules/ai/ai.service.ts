import { ChatbotAnalyzeResponse, CoachRecommendRequest, CoachRecommendResponse, CoachCandidate, ChatbotSession, CourtSlotSuggestion, CoachSuggestion, BookingDraft, CoachBookingDraft } from "./ai.type";
import { InMemorySessionManager, SessionManager } from "./session.manager";
const sessionManager: SessionManager = new InMemorySessionManager();
import * as courtService from "../courts/courts.service";
import * as coachService from "../coaches/coaches.service";
import * as playerMatchingRepo from "../player-matching/player-matching.repository";
import * as playerMatchingService from "../player-matching/player-matching.service";
import * as groupRepo from "../playgroups/playgroups.repository";
import * as bookingsService from "../bookings/bookings.service";


export async function analyzeIntentWithFastAPI(message: string): Promise<ChatbotAnalyzeResponse> {
  const response = await fetch("http://127.0.0.1:8000/api/ai/analyze-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error("Failed to analyze intent from AI Service");
  }

  return response.json();
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return "";
  const s = dateStr.toLowerCase().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));

  if (s === "today" || s === "hôm nay") {
    return now.toISOString().split("T")[0];
  }
  if (s === "tomorrow" || s === "ngày mai" || s === "mai") {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }
  if (s === "ngày kia" || s === "ngày mốt" || s === "mốt" || s === "day after tomorrow") {
    const dayAfter = new Date(now);
    dayAfter.setDate(now.getDate() + 2);
    return dayAfter.toISOString().split("T")[0];
  }

  // Handle patterns like: 21/06/2026, 21-06-2026, 21/06, 21-6
  const ddMmYyyyMatch = s.match(/(\d{1,2})[-/](\d{1,2})(?:[-/](\d{4}))?/);
  if (ddMmYyyyMatch) {
    const d = parseInt(ddMmYyyyMatch[1], 10);
    const m = parseInt(ddMmYyyyMatch[2], 10);
    const y = ddMmYyyyMatch[3] ? parseInt(ddMmYyyyMatch[3], 10) : now.getFullYear();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // Handle patterns like: ngày 21 tháng 6, 21 tháng 6, 21 thg 6, ngày 21 thg 6, ngày 21 tháng 6 năm 2026
  const vietMonthMatch = s.match(/(?:ngày\s+)?(\d{1,2})\s+(?:tháng|thg)\s+(\d{1,2})(?:\s+(?:năm)?\s*(\d{4}))?/);
  if (vietMonthMatch) {
    const d = parseInt(vietMonthMatch[1], 10);
    const m = parseInt(vietMonthMatch[2], 10);
    const y = vietMonthMatch[3] ? parseInt(vietMonthMatch[3], 10) : now.getFullYear();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // Handle simple: ngày 21, 21
  const dayMatch = s.match(/(?:ngày\s+)?(\d{1,2})/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    const currentDay = now.getDate();
    let month = now.getMonth() + 1;
    let year = now.getFullYear();
    if (day < currentDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  return dateStr;
}

function findAlternativeBlocks(
  availSlots: any[],
  duration: number,
  requestedStartMin: number,
  openTimeStr: string,
  closeTimeStr: string
): { startTime: string; endTime: string; price: number }[] {
  const startLimit = parseTimeToMinutes(openTimeStr) ?? 360; // default 06:00
  const endLimit = parseTimeToMinutes(closeTimeStr) ?? 1320; // default 22:00

  const toTimeStr = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const candidates: { start: number; end: number; price: number }[] = [];

  for (let t = startLimit; t + duration <= endLimit; t += 30) {
    if (t === requestedStartMin) continue;

    let blockCovered = true;
    let blockPrice = 0;
    let segmentCount = 0;
    const slotIds = new Set<number>();

    for (let seg = t; seg < t + duration; seg += 30) {
      const matchingSlot = availSlots.find((s: any) => {
        const sStart = parseTimeToMinutes(s.StartTime);
        const sEnd = parseTimeToMinutes(s.EndTime);
        return sStart !== null && sEnd !== null && sStart <= seg && sEnd >= (seg + 30);
      });

      if (!matchingSlot) {
        blockCovered = false;
        break;
      }
      slotIds.add(matchingSlot.SlotID);
      segmentCount++;
    }

    if (blockCovered && segmentCount > 0) {
      let totalPrice = 0;
      slotIds.forEach(id => {
        const slot = availSlots.find(s => s.SlotID === id);
        if (slot) totalPrice += Number(slot.Price);
      });

      candidates.push({
        start: t,
        end: t + duration,
        price: totalPrice
      });
    }
  }

  candidates.sort((a, b) => Math.abs(a.start - requestedStartMin) - Math.abs(b.start - requestedStartMin));

  return candidates.map(c => ({
    startTime: toTimeStr(c.start),
    endTime: toTimeStr(c.end),
    price: c.price
  }));
}

function normalizeTime(timeStr: string): string {
  if (!timeStr) return "";
  const s = timeStr.toLowerCase().trim();
  const isPm = s.includes("chiều") || s.includes("tối") || s.includes("pm");
  const isAm = s.includes("sáng") || s.includes("am");
  const match = s.match(/(\d{1,2})(?:[h:](\d{2})?)?/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    if (isPm && hour < 12) {
      hour += 12;
    } else if (isAm && hour === 12) {
      hour = 0;
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  return "";
}

async function resolveCourtAlias(courtNameRaw: string): Promise<{ courtId: number; courtName: string } | null> {
  if (!courtNameRaw) return null;
  const allCourts = await courtService.getAllCourts();
  const rawLower = courtNameRaw.toLowerCase().trim();
  const matched = allCourts.find((c: any) =>
    c.CourtName.toLowerCase().includes(rawLower) || rawLower.includes(c.CourtName.toLowerCase())
  );
  if (matched) {
    return { courtId: matched.CourtID, courtName: matched.CourtName };
  }
  return null;
}

async function resolveCoachAlias(coachNameRaw: string): Promise<{ coachId: number; coachName: string; hourlyRate: number } | null> {
  if (!coachNameRaw) return null;
  const allCoaches = await coachService.getAllCoaches();
  const rawLower = coachNameRaw.toLowerCase().trim();
  const cleanedRaw = rawLower.replace(/coach|thầy|thay|hlv|huấn luyện viên|huan luyen vien/g, "").trim();
  if (!cleanedRaw) return null;
  const matched = allCoaches.find((c: any) => {
    const coachName = (c.FullName || "").toLowerCase();
    return coachName.includes(cleanedRaw) || cleanedRaw.includes(coachName);
  });
  if (matched) {
    return {
      coachId: matched.CoachID,
      coachName: matched.FullName,
      hourlyRate: Number(matched.HourlyRate)
    };
  }
  return null;
}

export async function handleChatbotMessage(
  message: string,
  conversationId?: string,
  userId?: number,
  userRoles: string[] = []
) {
  const convId = conversationId || "default_session";
  const session = await sessionManager.getSession(convId);

  // Debug Logging
  console.log(`[Chatbot Input] Message: "${message}", conversationId: "${convId}", userId: ${userId}, roles: ${JSON.stringify(userRoles)}`);

  let analysis: ChatbotAnalyzeResponse;
  try {
    analysis = await analyzeIntentWithFastAPI(message);
  } catch (err: any) {
    console.warn(`[Chatbot] FastAPI call failed, fallback UNKNOWN: ${err.message}`);
    analysis = {
      intent: "UNKNOWN",
      parsedData: { originalMessage: message }
    } as any;
  }

  const { intent, parsedData } = analysis;
  console.log(`[Chatbot Parsed] Intent: ${intent}, ParsedData: ${JSON.stringify(parsedData)}`);

  let replyMessage = "Xin lỗi, mình chưa hiểu rõ ý của bạn. Bạn muốn đặt sân, thuê HLV hay cần hỗ trợ gì ạ?";
  let actionType: 'TEXT' | 'COURT_SUGGESTIONS' | 'COACH_SUGGESTIONS' | 'CONFIRM_COURT_BOOKING' | 'CONFIRM_COACH_BOOKING' | 'CONFIRM_CANCEL_COURT_BOOKING' | 'CONFIRM_CANCEL_COACH_BOOKING' | 'CONFIRM_RESCHEDULE_COURT_BOOKING' | 'CONFIRM_RESCHEDULE_COACH_BOOKING' | 'LOGIN_REQUIRED' | 'ERROR' = 'TEXT';
  let suggestedSlots: CourtSlotSuggestion[] = [];
  let suggestedCoaches: CoachSuggestion[] = [];

  // Update session's last intent
  session.lastIntent = intent;
  session.lastUpdated = Date.now();

  if (analysis.canAnswerDirectly && analysis.replyHint) {
    replyMessage = analysis.replyHint;
    actionType = "TEXT";
  } else {
    try {
    switch (intent) {
      case "GREETING":
        replyMessage = "Xin chào! Mình là Trợ lý ảo Pickle Club. Hôm nay mình có thể giúp bạn tìm/đặt sân hoặc tìm huấn luyện viên dạy Pickleball đấy!";
        actionType = "TEXT";
        break;

      case "HELP":
        replyMessage = "Mình có thể hỗ trợ bạn:\n1. Đặt sân Pickleball (ví dụ: 'Đặt sân Champion lúc 5h chiều mai')\n2. Đặt huấn luyện viên (ví dụ: 'Đặt thầy Huy dạy lúc 8h sáng ngày 21')\n3. Tra cứu giá thuê sân và học phí HLV\n4. Xem lịch sử đặt chỗ hoặc hủy lịch của bạn.\nBạn muốn làm gì ạ?";
        actionType = "TEXT";
        break;

      case "ASK_PRICE": {
        const courts = await courtService.getAllCourts();
        const priceList = courts.map((c: any) => `- Sân **${c.CourtName}**: ${Number(c.PricePerHour).toLocaleString("vi-VN")}đ/giờ (Mở cửa: ${c.OpenTime} - ${c.CloseTime})`).join("\n");
        replyMessage = `Giá thuê sân tại Pickle Club như sau:\n${priceList}`;
        actionType = "TEXT";
        break;
      }

      case "ASK_COACH_PRICE": {
        const coaches = await coachService.getAllCoaches();
        const priceList = coaches.map((c: any) => `- Coach **${c.FullName}** (${c.SkillLevel}): ${Number(c.HourlyRate).toLocaleString("vi-VN")}đ/giờ`).join("\n");
        replyMessage = `Học phí thuê huấn luyện viên tại Pickle Club như sau:\n${priceList}`;
        actionType = "TEXT";
        break;
      }

      case "ASK_OPENING_HOURS":
        replyMessage = "Pickle Club mở cửa từ 5:00 sáng đến 23:00 tối hàng ngày, bao gồm cả thứ Bảy và Chủ Nhật.";
        actionType = "TEXT";
        break;

      case "ASK_RULES":
        replyMessage = "Pickleball chơi trên sân giống sân cầu lông nhưng dùng vợt phẳng và bóng nhựa đục lỗ. Điểm số chỉ được ghi bởi bên giao bóng. Bóng phải nảy một lần ở mỗi bên trước khi có thể volley (luật 2-bounce). Bạn muốn tìm hiểu kỹ hơn về luật giao bóng hay khu vực Kitchen?";
        actionType = "TEXT";
        break;

      case "ASK_BOOKING_HISTORY":
      case "ASK_COACH_BOOKING_HISTORY": {
        if (!userId) {
          replyMessage = "Vui lòng đăng nhập hệ thống để tra cứu lịch sử đặt lịch của bạn.";
          actionType = "LOGIN_REQUIRED";
          break;
        }
        const bookings = await bookingsService.getMyBookings(userId);
        if (bookings.length === 0) {
          replyMessage = "Bạn chưa có đơn đặt lịch nào trên hệ thống.";
        } else {
          const list = bookings.slice(0, 5).map((b: any) => {
            const dateStr = new Date(b.BookingDate).toLocaleDateString("vi-VN");
            const typeStr = b.BookingType === "Court" ? "Sân" : b.BookingType === "Coach" ? "HLV" : "Combo Sân+HLV";
            const courtName = b.CourtName ? ` sân ${b.CourtName}` : "";
            const statusStr = b.Status === "Confirmed" ? "Đã xác nhận" : b.Status === "PendingPayment" ? "Chờ thanh toán" : b.Status === "Cancelled" ? "Đã hủy" : b.Status;
            return `- **${b.BookingCode}**: Đặt ${typeStr}${courtName} ngày ${dateStr} từ ${b.StartTime.substring(0, 5)} đến ${b.EndTime.substring(0, 5)} (${statusStr})`;
          }).join("\n");
          replyMessage = `Lịch sử đặt lịch gần đây của bạn:\n${list}`;
        }
        actionType = "TEXT";
        break;
      }

      case "CANCEL_BOOKING_HELP":
      case "CANCEL_COACH_BOOKING_HELP": {
        if (!userId) {
          replyMessage = "Vui lòng đăng nhập để xem danh sách lịch đặt có thể hủy.";
          actionType = "LOGIN_REQUIRED";
          break;
        }
        const bookings = await bookingsService.getMyBookings(userId);
        const cancellable = bookings.filter((b: any) => ["PendingPayment", "Confirmed"].includes(b.Status));
        if (cancellable.length === 0) {
          replyMessage = "Bạn hiện không có lịch đặt sân hay HLV nào ở trạng thái chờ thanh toán hoặc đã xác nhận để hủy.";
        } else {
          const list = cancellable.map((b: any) => {
            const dateStr = new Date(b.BookingDate).toLocaleDateString("vi-VN");
            return `- Mã **${b.BookingCode}**: Sân/HLV ngày ${dateStr} lúc ${b.StartTime.substring(0, 5)} - ${b.EndTime.substring(0, 5)}`;
          }).join("\n");
          replyMessage = `Bạn có thể hủy các đơn đặt lịch sau. Bạn muốn hủy đơn nào?\n${list}\n\n*Hãy gõ: **Hủy lịch [Mã đặt chỗ]** để xác nhận.*`;
        }
        actionType = "TEXT";
        break;
      }

      case "CONFIRM_CANCEL_BOOKING":
      case "CONFIRM_CANCEL_COACH_BOOKING": {
        if (!userId) {
          replyMessage = "Vui lòng đăng nhập để hủy lịch đặt.";
          actionType = "LOGIN_REQUIRED";
          break;
        }
        const codeMatch = message.toUpperCase().match(/BK-\d+/);
        if (!codeMatch) {
          replyMessage = "Vui lòng nhập đúng định dạng mã đặt chỗ cần hủy (Ví dụ: 'Hủy lịch BK-123456').";
          actionType = "TEXT";
          break;
        }
        const bookingCode = codeMatch[0];
        const bookings = await bookingsService.getMyBookings(userId);
        const bookingToCancel = bookings.find((b: any) => b.BookingCode === bookingCode);

        if (!bookingToCancel) {
          replyMessage = `Không tìm thấy đơn đặt lịch nào có mã ${bookingCode} trong tài khoản của bạn.`;
          actionType = "TEXT";
          break;
        }

        const cancelRes = await bookingsService.cancelBooking({
          bookingId: bookingToCancel.BookingID,
          userId,
          userRoles,
          cancelReason: "Hủy lịch qua Chatbot AI"
        });

        replyMessage = `Đã hủy thành công đơn đặt lịch **${bookingCode}**. Số tiền hoàn lại là **${cancelRes.refundAmount.toLocaleString("vi-VN")}đ** (${cancelRes.refundNote || "Đơn chưa thanh toán"}).`;
        actionType = "TEXT";
        break;
      }

      case "BOOK_COURT":
      case "CHECK_COURT_AVAILABILITY": {
        const rawDate = parsedData.dateText || parsedData.date;
        const rawTime = parsedData.startTimeText || parsedData.startTime;

        // Retrieve partial information from session if user is answering a previous question
        const date = normalizeDate(rawDate || session.bookingDraft?.bookingDate || "");
        const startTime = normalizeTime(rawTime || session.bookingDraft?.startTime || "");
        const duration = parsedData.durationMinutes || (session.bookingDraft?.startTime && session.bookingDraft?.endTime ? (parseTimeToMinutes(session.bookingDraft?.endTime)! - parseTimeToMinutes(session.bookingDraft?.startTime)!) : 60);

        if (!date || !startTime) {
          // Store partial draft to session
          session.bookingDraft = {
            courtId: 0,
            courtName: "",
            bookingDate: date,
            startTime,
            endTime: ""
          };
          replyMessage = !date 
            ? "Bạn muốn đặt sân vào ngày nào ạ? (Ví dụ: hôm nay, ngày mai, hoặc ngày 25/06)"
            : "Bạn muốn đặt sân vào khung giờ nào? (Ví dụ: 5h chiều, 19:30, hoặc 9h sáng)";
          actionType = "TEXT";
          break;
        }

        // Calculate end time
        const startMin = parseTimeToMinutes(startTime)!;
        const endMin = startMin + duration;
        const toTimeStr = (mins: number) => {
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        };
        const endTime = toTimeStr(endMin);

        // Resolve court alias
        const resolvedCourt = await resolveCourtAlias(parsedData.courtNameRaw);

        if (parsedData.courtNameRaw && !resolvedCourt) {
          // A court was requested but not found in DB
          const allCourts = await courtService.getAllCourts();
          replyMessage = `Pickle Club không có sân nào tên là **${parsedData.courtNameRaw}**. Bạn vui lòng chọn một trong các sân sau:`;
          actionType = "COURT_SUGGESTIONS";
          suggestedSlots = allCourts.slice(0, 3).map((c: any) => ({
            courtId: c.CourtID,
            courtName: c.CourtName,
            price: Number(c.PricePerHour) * (duration / 60),
            availableTime: `${startTime} - ${endTime}`
          }));
          break;
        }

        const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
        const todayStr = `${nowVN.getFullYear()}-${String(nowVN.getMonth() + 1).padStart(2, "0")}-${String(nowVN.getDate()).padStart(2, "0")}`;

        if (resolvedCourt) {
          // Specific court requested
          const slots = await courtService.getCourtSlots(resolvedCourt.courtId, date);
          let availSlots = slots.filter((s: any) => s.Status === "Available");
          
          if (date === todayStr) {
            const currentTotalMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();
            availSlots = availSlots.filter((s: any) => parseTimeToMinutes(s.StartTime)! > currentTotalMinutes);
          }

          // Check if slot is available
          let isCovered = false;
          let totalPrice = 0;
          if (availSlots.length > 0) {
            isCovered = true;
            for (let t = startMin; t < endMin; t += 30) {
              const seg = availSlots.find((s: any) => {
                const sStart = parseTimeToMinutes(s.StartTime)!;
                const sEnd = parseTimeToMinutes(s.EndTime)!;
                return sStart <= t && sEnd >= (t + 30);
              });
              if (!seg) {
                isCovered = false;
                break;
              }
            }
          }

          if (isCovered) {
            // Find slot details to calculate real price
            const coveredSlotIds = new Set<number>();
            for (let t = startMin; t < endMin; t += 30) {
              const seg = availSlots.find((s: any) => {
                const sStart = parseTimeToMinutes(s.StartTime)!;
                const sEnd = parseTimeToMinutes(s.EndTime)!;
                return sStart <= t && sEnd >= (t + 30);
              });
              if (seg) coveredSlotIds.add(seg.SlotID);
            }
            coveredSlotIds.forEach(id => {
              const slot = availSlots.find(s => s.SlotID === id);
              if (slot) totalPrice += Number(slot.Price);
            });

            session.bookingDraft = {
              courtId: resolvedCourt.courtId,
              courtName: resolvedCourt.courtName,
              bookingDate: date,
              startTime,
              endTime,
              price: totalPrice
            };
            replyMessage = `Sân **${resolvedCourt.courtName}** còn trống vào khung giờ **${startTime} - ${endTime}** ngày **${date}** với tổng giá là **${totalPrice.toLocaleString("vi-VN")}đ**. Bạn có xác nhận muốn đặt không?`;
            actionType = "CONFIRM_COURT_BOOKING";
          } else {
            // Sân này không trống, gợi ý giờ khác trên sân này hoặc sân khác cùng giờ
            const alternatives = findAlternativeBlocks(availSlots, duration, startMin, "05:00", "23:00");
            if (alternatives.length > 0) {
              replyMessage = `Sân **${resolvedCourt.courtName}** đã hết slot lúc ${startTime} - ${endTime} ngày ${date}. Tuy nhiên, sân này còn trống các khung giờ khác trong ngày:`;
              actionType = "COURT_SUGGESTIONS";
              suggestedSlots = alternatives.slice(0, 3).map(alt => ({
                courtId: resolvedCourt.courtId,
                courtName: resolvedCourt.courtName,
                price: alt.price,
                availableTime: `${alt.startTime} - ${alt.endTime}`
              }));
            } else {
              // Gợi ý sân khác cùng giờ
              const allCourts = await courtService.getAllCourts();
              const otherCourts = allCourts.filter((c: any) => c.CourtID !== resolvedCourt.courtId);
              const otherAvail: any[] = [];
              for (const c of otherCourts) {
                const cSlots = await courtService.getCourtSlots(c.CourtID, date);
                let cAvail = cSlots.filter((s: any) => s.Status === "Available");
                let cCovered = cAvail.length > 0;
                if (cCovered) {
                  for (let t = startMin; t < endMin; t += 30) {
                    if (!cAvail.some((s: any) => parseTimeToMinutes(s.StartTime)! <= t && parseTimeToMinutes(s.EndTime)! >= (t + 30))) {
                      cCovered = false;
                      break;
                    }
                  }
                }
                if (cCovered) {
                  let cPrice = 0;
                  const ids = new Set<number>();
                  for (let t = startMin; t < endMin; t += 30) {
                    const seg = cAvail.find((s: any) => parseTimeToMinutes(s.StartTime)! <= t && parseTimeToMinutes(s.EndTime)! >= (t + 30));
                    if (seg) ids.add(seg.SlotID);
                  }
                  ids.forEach(id => {
                    const slot = cAvail.find(s => s.SlotID === id);
                    if (slot) cPrice += Number(slot.Price);
                  });
                  otherAvail.push({ court: c, price: cPrice });
                }
              }

              if (otherAvail.length > 0) {
                replyMessage = `Sân **${resolvedCourt.courtName}** đã bận lúc ${startTime} - ${endTime} ngày ${date}. Nhưng các sân sau vẫn còn trống vào khung giờ này:`;
                actionType = "COURT_SUGGESTIONS";
                suggestedSlots = otherAvail.slice(0, 3).map(oa => ({
                  courtId: oa.court.CourtID,
                  courtName: oa.court.CourtName,
                  price: oa.price,
                  availableTime: `${startTime} - ${endTime}`
                }));
              } else {
                replyMessage = `Rất tiếc, sân **${resolvedCourt.courtName}** đã hết chỗ và không có sân khác trống vào lúc ${startTime} - ${endTime} ngày ${date}. Bạn vui lòng chọn ngày/giờ khác nhé!`;
                actionType = "TEXT";
              }
            }
          }
        } else {
          // No specific court mentioned, check all available courts
          const allCourts = await courtService.getAllCourts();
          const availableCourtsAtTime: any[] = [];
          for (const c of allCourts) {
            const cSlots = await courtService.getCourtSlots(c.CourtID, date);
            let cAvail = cSlots.filter((s: any) => s.Status === "Available");
            let cCovered = cAvail.length > 0;
            if (cCovered) {
              for (let t = startMin; t < endMin; t += 30) {
                if (!cAvail.some((s: any) => parseTimeToMinutes(s.StartTime)! <= t && parseTimeToMinutes(s.EndTime)! >= (t + 30))) {
                  cCovered = false;
                  break;
                }
              }
            }
            if (cCovered) {
              let cPrice = 0;
              const ids = new Set<number>();
              for (let t = startMin; t < endMin; t += 30) {
                const seg = cAvail.find((s: any) => parseTimeToMinutes(s.StartTime)! <= t && parseTimeToMinutes(s.EndTime)! >= (t + 30));
                if (seg) ids.add(seg.SlotID);
              }
              ids.forEach(id => {
                const slot = cAvail.find(s => s.SlotID === id);
                if (slot) cPrice += Number(slot.Price);
              });
              availableCourtsAtTime.push({ court: c, price: cPrice });
            }
          }

          if (availableCourtsAtTime.length > 0) {
            replyMessage = `Mình tìm thấy một vài sân còn trống vào khung giờ **${startTime} - ${endTime}** ngày **${date}**. Bạn muốn đặt sân nào?`;
            actionType = "COURT_SUGGESTIONS";
            suggestedSlots = availableCourtsAtTime.map(act => ({
              courtId: act.court.CourtID,
              courtName: act.court.CourtName,
              price: act.price,
              availableTime: `${startTime} - ${endTime}`
            }));
          } else {
            // No courts available, find alternative slots on any court
            const alternativeList: any[] = [];
            for (const c of allCourts) {
              const cSlots = await courtService.getCourtSlots(c.CourtID, date);
              const cAvail = cSlots.filter((s: any) => s.Status === "Available");
              const alternatives = findAlternativeBlocks(cAvail, duration, startMin, c.OpenTime, c.CloseTime);
              for (const alt of alternatives) {
                alternativeList.push({ court: c, ...alt });
              }
            }

            alternativeList.sort((a, b) => Math.abs(parseTimeToMinutes(a.startTime)! - startMin) - Math.abs(parseTimeToMinutes(b.startTime)! - startMin));

            if (alternativeList.length > 0) {
              replyMessage = `Rất tiếc, không có sân nào còn trống vào khung giờ ${startTime} - ${endTime} ngày ${date}. Bạn tham khảo các khung giờ trống khác dưới đây:`;
              actionType = "COURT_SUGGESTIONS";
              suggestedSlots = alternativeList.slice(0, 3).map(alt => ({
                courtId: alt.court.CourtID,
                courtName: alt.court.CourtName,
                price: alt.price,
                availableTime: `${alt.startTime} - ${alt.endTime}`
              }));
            } else {
              replyMessage = `Rất tiếc, tất cả các sân đều bận vào ngày ${date}. Bạn vui lòng chọn ngày khác nhé!`;
              actionType = "TEXT";
            }
          }
        }
        break;
      }

      case "BOOK_COACH":
      case "CHECK_COACH_AVAILABILITY": {
        const rawDate = parsedData.dateText || parsedData.date;
        const rawTime = parsedData.startTimeText || parsedData.startTime;

        const date = normalizeDate(rawDate || session.coachBookingDraft?.bookingDate || "");
        const startTime = normalizeTime(rawTime || session.coachBookingDraft?.startTime || "");
        const duration = parsedData.durationMinutes || 60;
        const needCourtTogether = parsedData.needCourtTogether !== undefined ? parsedData.needCourtTogether : (session.coachBookingDraft?.needCourtTogether || false);

        if (!date || !startTime) {
          session.coachBookingDraft = {
            coachId: 0,
            coachName: "",
            bookingDate: date,
            startTime,
            endTime: "",
            needCourtTogether
          };
          replyMessage = !date
            ? "Bạn muốn đặt lịch học với huấn luyện viên vào ngày nào ạ? (Ví dụ: ngày mai, thứ hai)"
            : "Bạn muốn học vào mấy giờ? (Ví dụ: 8h sáng, 18:00)";
          actionType = "TEXT";
          break;
        }

        const startMin = parseTimeToMinutes(startTime)!;
        const endMin = startMin + duration;
        const toTimeStr = (mins: number) => {
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        };
        const endTime = toTimeStr(endMin);

        // Resolve coach
        const resolvedCoach = await resolveCoachAlias(parsedData.coachNameRaw);

        if (parsedData.coachNameRaw && !resolvedCoach) {
          const allCoaches = await coachService.getAllCoaches();
          replyMessage = `Pickle Club không tìm thấy HLV nào có tên **${parsedData.coachNameRaw}**. Dưới đây là danh sách các huấn luyện viên đang hoạt động tại CLB:`;
          actionType = "COACH_SUGGESTIONS";
          suggestedCoaches = allCoaches.map((c: any) => ({
            coachId: c.CoachID,
            name: c.FullName,
            hourlyRate: Number(c.HourlyRate),
            skillLevel: c.SkillLevel,
            specialization: c.Specialization
          }));
          break;
        }

        if (resolvedCoach) {
          // Specific coach requested, check schedule
          const schedules = await coachService.getCoachSchedules(resolvedCoach.coachId);
          // Look for an Available slot covering requested range
          const isCoachAvailable = schedules.some((s: any) =>
            s.WorkingDate === date &&
            s.Status === "Available" &&
            parseTimeToMinutes(s.StartTime)! <= startMin &&
            parseTimeToMinutes(s.EndTime)! >= endMin
          );

          if (isCoachAvailable) {
            const coachFee = resolvedCoach.hourlyRate * (duration / 60);

            if (needCourtTogether) {
              // Intersect with court availability
              const allCourts = await courtService.getAllCourts();
              let availableCourt: any = null;
              let courtPrice = 0;
              
              for (const c of allCourts) {
                const cSlots = await courtService.getCourtSlots(c.CourtID, date);
                let cAvail = cSlots.filter((s: any) => s.Status === "Available");
                let cCovered = cAvail.length > 0;
                if (cCovered) {
                  for (let t = startMin; t < endMin; t += 30) {
                    if (!cAvail.some((s: any) => parseTimeToMinutes(s.StartTime)! <= t && parseTimeToMinutes(s.EndTime)! >= (t + 30))) {
                      cCovered = false;
                      break;
                    }
                  }
                }
                if (cCovered) {
                  let cPrice = 0;
                  const ids = new Set<number>();
                  for (let t = startMin; t < endMin; t += 30) {
                    const seg = cAvail.find((s: any) => parseTimeToMinutes(s.StartTime)! <= t && parseTimeToMinutes(s.EndTime)! >= (t + 30));
                    if (seg) ids.add(seg.SlotID);
                  }
                  ids.forEach(id => {
                    const slot = cAvail.find(s => s.SlotID === id);
                    if (slot) cPrice += Number(slot.Price);
                  });
                  availableCourt = c;
                  courtPrice = cPrice;
                  break;
                }
              }

              if (availableCourt) {
                const totalComboPrice = coachFee + courtPrice;
                session.coachBookingDraft = {
                  coachId: resolvedCoach.coachId,
                  coachName: resolvedCoach.coachName,
                  bookingDate: date,
                  startTime,
                  endTime,
                  needCourtTogether: true,
                  courtId: availableCourt.CourtID,
                  courtName: availableCourt.CourtName,
                  price: totalComboPrice
                };
                replyMessage = `Huấn luyện viên **${resolvedCoach.coachName}** rảnh lúc **${startTime} - ${endTime}** ngày **${date}** và còn sân trống **${availableCourt.CourtName}**. Bạn có muốn đặt lịch học Combo (học phí HLV + thuê sân: **${totalComboPrice.toLocaleString("vi-VN")}đ**) không?`;
                actionType = "CONFIRM_COACH_BOOKING";
              } else {
                replyMessage = `Rất tiếc, HLV **${resolvedCoach.coachName}** rảnh nhưng hệ thống đã hết sân trống lúc ${startTime} - ${endTime} ngày ${date}. Bạn vui lòng chọn khung giờ khác nhé!`;
                actionType = "TEXT";
              }
            } else {
              // Just book coach
              session.coachBookingDraft = {
                coachId: resolvedCoach.coachId,
                coachName: resolvedCoach.coachName,
                bookingDate: date,
                startTime,
                endTime,
                needCourtTogether: false,
                price: coachFee
              };
              replyMessage = `Huấn luyện viên **${resolvedCoach.coachName}** còn trống lịch lúc **${startTime} - ${endTime}** ngày **${date}** với học phí **${coachFee.toLocaleString("vi-VN")}đ**. Bạn có xác nhận muốn đặt không?`;
              actionType = "CONFIRM_COACH_BOOKING";
            }
          } else {
            // Coach not available, find alternative slots for this coach
            const coachAvailSlots = schedules.filter((s: any) => s.WorkingDate === date && s.Status === "Available");
            if (coachAvailSlots.length > 0) {
              replyMessage = `HLV **${resolvedCoach.coachName}** đã bận lúc ${startTime} - ${endTime} ngày ${date}. Các giờ rảnh khác của coach trong ngày này:`;
              actionType = "COACH_SUGGESTIONS";
              suggestedSlots = coachAvailSlots.map((s: any) => ({
                coachId: resolvedCoach.coachId,
                coachName: resolvedCoach.coachName,
                price: resolvedCoach.hourlyRate * (duration / 60),
                availableTime: `${s.StartTime.substring(0, 5)} - ${s.EndTime.substring(0, 5)}`
              }));
            } else {
              // Suggest other coaches at this time
              const allCoaches = await coachService.getAllCoaches();
              const otherCoaches = allCoaches.filter((c: any) => c.CoachID !== resolvedCoach.coachId);
              const availableOthers: any[] = [];
              for (const c of otherCoaches) {
                const cSchedules = await coachService.getCoachSchedules(c.CoachID);
                const cAvail = cSchedules.some((s: any) =>
                  s.WorkingDate === date &&
                  s.Status === "Available" &&
                  parseTimeToMinutes(s.StartTime)! <= startMin &&
                  parseTimeToMinutes(s.EndTime)! >= endMin
                );
                if (cAvail) {
                  availableOthers.push(c);
                }
              }

              if (availableOthers.length > 0) {
                replyMessage = `HLV **${resolvedCoach.coachName}** đã bận lúc ${startTime} - ${endTime} ngày ${date}. Bạn tham khảo các huấn luyện viên khác còn rảnh lúc này:`;
                actionType = "COACH_SUGGESTIONS";
                suggestedCoaches = availableOthers.slice(0, 3).map((c: any) => ({
                  coachId: c.CoachID,
                  name: c.FullName,
                  hourlyRate: Number(c.HourlyRate),
                  skillLevel: c.SkillLevel,
                  specialization: c.Specialization
                }));
              } else {
                replyMessage = `Rất tiếc, HLV **${resolvedCoach.coachName}** và các huấn luyện viên khác đều bận vào lúc ${startTime} - ${endTime} ngày ${date}.`;
                actionType = "TEXT";
              }
            }
          }
        } else {
          // No specific coach requested, find all approved coaches available at requested time
          const allCoaches = await coachService.getAllCoaches();
          const availableCoachesAtTime: any[] = [];
          
          for (const c of allCoaches) {
            const cSchedules = await coachService.getCoachSchedules(c.CoachID);
            const cAvail = cSchedules.some((s: any) =>
              s.WorkingDate === date &&
              s.Status === "Available" &&
              parseTimeToMinutes(s.StartTime)! <= startMin &&
              parseTimeToMinutes(s.EndTime)! >= endMin
            );
            if (cAvail) {
              availableCoachesAtTime.push(c);
            }
          }

          if (availableCoachesAtTime.length > 0) {
            replyMessage = `Dưới đây là danh sách huấn luyện viên có lịch trống lúc **${startTime} - ${endTime}** ngày **${date}**:`;
            actionType = "COACH_SUGGESTIONS";
            suggestedCoaches = availableCoachesAtTime.map((c: any) => ({
              coachId: c.CoachID,
              name: c.FullName,
              hourlyRate: Number(c.HourlyRate),
              skillLevel: c.SkillLevel,
              specialization: c.Specialization
            }));
          } else {
            replyMessage = `Rất tiếc, không có huấn luyện viên nào còn trống lịch vào khung giờ ${startTime} - ${endTime} ngày ${date}. Bạn vui lòng chọn khung giờ khác nhé!`;
            actionType = "TEXT";
          }
        }
        break;
      }

      case "FIND_COACH": {
        const coaches = await coachService.getAllCoaches();
        replyMessage = "Dưới đây là danh sách các huấn luyện viên đang hoạt động tại Pickle Club. Bạn muốn đặt lịch học với HLV nào ạ?";
        actionType = "COACH_SUGGESTIONS";
        suggestedCoaches = coaches.map((c: any) => ({
          coachId: c.CoachID,
          name: c.FullName,
          hourlyRate: Number(c.HourlyRate),
          skillLevel: c.SkillLevel,
          specialization: c.Specialization
        }));
        break;
      }

      case "ASK_COACH_INFO": {
        const coachNameRaw = parsedData.coachNameRaw;
        const resolvedCoach = await resolveCoachAlias(coachNameRaw);
        if (resolvedCoach) {
          const coach = await coachService.getCoachById(resolvedCoach.coachId);
          replyMessage = `Thông tin về HLV **${coach.FullName}**:\n- **Trình độ**: ${coach.SkillLevel || "N/A"}\n- **Chuyên môn**: ${coach.Specialization || "N/A"}\n- **Kinh nghiệm**: ${coach.ExperienceYears || 0} năm\n- **Học phí**: ${Number(coach.HourlyRate).toLocaleString("vi-VN")}đ/giờ\n- **Giới thiệu**: ${coach.Biography || "Chưa có tiểu sử chi tiết."}`;
          actionType = "TEXT";
        } else {
          const coaches = await coachService.getAllCoaches();
          replyMessage = `Không tìm thấy huấn luyện viên nào tên là **${coachNameRaw || ""}**. Bạn vui lòng chọn một trong các HLV đang dạy tại CLB:`;
          actionType = "COACH_SUGGESTIONS";
          suggestedCoaches = coaches.map((c: any) => ({
            coachId: c.CoachID,
            name: c.FullName,
            hourlyRate: Number(c.HourlyRate),
            skillLevel: c.SkillLevel,
            specialization: c.Specialization
          }));
        }
        break;
      }


      case "CONFIRM_BOOKING":
      case "CONFIRM_COURT_BOOKING":
      case "CONFIRM_COACH_BOOKING": {
        if (!userId) {
          replyMessage = "Vui lòng đăng nhập hệ thống để thực hiện đặt chỗ.";
          actionType = "LOGIN_REQUIRED";
          break;
        }

        if (session.bookingDraft && session.bookingDraft.courtId > 0) {
          // Confirm Court booking
          const draft = session.bookingDraft;
          const bookingResult = await bookingsService.createCourtBooking({
            userId,
            courtId: draft.courtId,
            bookingDate: draft.bookingDate,
            startTime: draft.startTime,
            endTime: draft.endTime
          });

          replyMessage = `Đặt sân thành công! Mã đặt chỗ của bạn là **${bookingResult.BookingCode}**. Tổng số tiền cần thanh toán: **${bookingResult.TotalAmount.toLocaleString("vi-VN")}đ**. Bạn vui lòng thanh toán trong vòng 10 phút để xác nhận giữ chỗ.`;
          actionType = "TEXT";
          session.bookingDraft = undefined; // clear draft
        } else if (session.coachBookingDraft && session.coachBookingDraft.coachId > 0) {
          // Confirm Coach / Combo booking
          const draft = session.coachBookingDraft;
          let bookingResult: any;

          if (draft.needCourtTogether && draft.courtId && draft.courtId > 0) {
            bookingResult = await bookingsService.createComboBooking({
              userId,
              courtId: draft.courtId,
              coachId: draft.coachId,
              bookingDate: draft.bookingDate,
              startTime: draft.startTime,
              endTime: draft.endTime
            });
            replyMessage = `Đặt lịch Combo sân + HLV thành công! Mã đơn đặt: **${bookingResult.BookingCode}**. Sân: **${draft.courtName}**, HLV: **${draft.coachName}**. Số tiền cần thanh toán: **${bookingResult.TotalAmount.toLocaleString("vi-VN")}đ**. Bạn vui lòng hoàn tất thanh toán trong vòng 10 phút.`;
          } else {
            bookingResult = await bookingsService.createCoachBooking({
              userId,
              coachId: draft.coachId,
              bookingDate: draft.bookingDate,
              startTime: draft.startTime,
              endTime: draft.endTime
            });
            replyMessage = `Đặt huấn luyện viên **${draft.coachName}** thành công! Mã đơn đặt: **${bookingResult.BookingCode}**. Số tiền cần thanh toán: **${bookingResult.TotalAmount.toLocaleString("vi-VN")}đ**. Vui lòng thanh toán trong 10 phút để giữ lịch dạy.`;
          }

          actionType = "TEXT";
          session.coachBookingDraft = undefined; // clear draft
        } else {
          replyMessage = "Mình chưa thấy thông tin đặt sân hay HLV nào đang chờ xác nhận của bạn. Bạn muốn đặt lịch gì ạ?";
          actionType = "TEXT";
        }
        break;
      }

      case "REJECT_SUGGESTION":
        session.bookingDraft = undefined;
        session.coachBookingDraft = undefined;
        replyMessage = "Dạ, mình đã hủy yêu cầu đặt lịch cũ. Bạn muốn đổi thông tin đặt sân/HLV như thế nào ạ? (Hãy cho mình biết ngày, giờ hoặc tên sân mong muốn nhé)";
        actionType = "TEXT";
        break;

      case "UNKNOWN":
      default:
        replyMessage = "Xin lỗi, mình chưa hiểu ý của bạn. Bạn muốn đặt sân, tìm HLV Pickleball hay cần xem giá cả/lịch sử đặt chỗ?";
        actionType = "TEXT";
        break;
    }
  } catch (error: any) {
    console.error(`[Chatbot Error] Handler crashed:`, error);
    replyMessage = `Đã xảy ra lỗi khi xử lý yêu cầu: ${error.message}`;
    actionType = "ERROR";
  }
  }

  // Save session state to the manager
  await sessionManager.saveSession(convId, session);

  return {
    message: replyMessage,
    intent,
    actionType,
    suggestedSlots: suggestedSlots.length > 0 ? suggestedSlots : undefined,
    suggestedCoaches: suggestedCoaches.length > 0 ? suggestedCoaches : undefined,
    bookingDraft: session.bookingDraft,
    coachBookingDraft: session.coachBookingDraft,
    needConfirmation: actionType === "CONFIRM_COURT_BOOKING" || actionType === "CONFIRM_COACH_BOOKING"
  };
}

export async function recommendCoaches(request: CoachRecommendRequest): Promise<CoachRecommendResponse> {
  const allCoaches = await coachService.getAllCoaches();

  const candidates: CoachCandidate[] = await Promise.all(allCoaches.map(async (c: any) => {
    let structuredScore = 50.0;
    if (request.budget && request.budget >= (c.HourlyRate || 0)) structuredScore += 30;
    if (request.level && c.SkillLevel === request.level) structuredScore += 20;

    // 1. Calculate Trust Score: 80% Rating + 20% Volume
    const averageRating = c.AverageRating ? Number(c.AverageRating) : 0.0;
    const totalStudents = c.TotalStudents ? Number(c.TotalStudents) : 0;
    const ratingScore = averageRating > 0 ? (averageRating / 5.0) * 100 : 70.0;
    const volumeScore = Math.min((totalStudents / 50) * 100, 100);
    const trustScore = Math.round(0.8 * ratingScore + 0.2 * volumeScore);

    // 2. Calculate Availability Score based on Preferred Time
    let availabilityScore = 50.0; // Base score if no specific slot matches
    try {
      const schedules = await coachService.getCoachSchedules(c.CoachID);
      const activeSchedules = schedules.filter((s: any) => s.Status === 'Available');

      if (request.preferredTime && activeSchedules.length > 0) {
        const pref = request.preferredTime;
        const isMorning = pref.includes("Sáng");
        const isAfternoon = pref.includes("Chiều");
        const isEvening = pref.includes("tối");
        const isWeekend = pref.includes("Cuối tuần");

        let matchCount = 0;
        for (const s of activeSchedules) {
          if (isWeekend) {
            const day = new Date(s.WorkingDate).getDay();
            if (day === 0 || day === 6) {
              matchCount++;
              continue;
            }
          }
          if (s.StartTime) {
            const startHour = parseInt(s.StartTime.split(":")[0], 10);
            if (isMorning && startHour >= 6 && startHour < 12) {
              matchCount++;
            } else if (isAfternoon && startHour >= 12 && startHour < 18) {
              matchCount++;
            } else if (isEvening && startHour >= 18 && startHour < 22) {
              matchCount++;
            }
          }
        }

        if (matchCount >= 3) {
          availabilityScore = 100.0;
        } else if (matchCount >= 1) {
          availabilityScore = 90.0;
        }
      } else {
        // If student did not choose preferredTime, give a decent default based on overall availability
        if (activeSchedules.length >= 5) {
          availabilityScore = 85.0;
        } else if (activeSchedules.length >= 1) {
          availabilityScore = 70.0;
        }
      }
    } catch (e) {
      console.error(`Error calculating availability score for coach ${c.CoachID}:`, e);
      availabilityScore = 70.0; // fallback if schedule fetch fails
    }

    return {
      coachId: c.CoachID,
      name: c.FullName || "Coach",
      description: c.Biography || "",
      teachingStyle: c.Specialization || "",
      expertise: c.SkillLevel || "",
      structuredScore: Math.min(structuredScore, 100),
      availabilityScore,
      trustScore
    };
  }));

  const topCandidates = candidates.slice(0, 15);
  const payload = { ...request, candidates: topCandidates };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("http://127.0.0.1:8000/api/ai/coaches/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("AI Service returned error");
    }

    const data: CoachRecommendResponse = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("FastAPI Error/Timeout, falling back", error);
    return handleCoachFallback(request, topCandidates);
  }
}

function handleCoachFallback(request: CoachRecommendRequest, candidates: CoachCandidate[]): CoachRecommendResponse {
  const results = candidates.map(c => {
    const finalScore = 0.45 * c.structuredScore + 0.30 * 50.0 + 0.15 * c.availabilityScore + 0.10 * c.trustScore;
    return {
      coachId: c.coachId,
      matchScore: Number(finalScore.toFixed(1)),
      score: Number(finalScore.toFixed(1)),
      semanticScore: 50.0,
      confidence: finalScore >= 60 ? "Medium" : "Low",
      reasons: ["Phù hợp với tiêu chí tìm kiếm cơ bản (Fallback)"]
    };
  }).sort((a, b) => b.matchScore - a.matchScore);

  return {
    fallback: true,
    parsedIntent: { level: request.level || "", goals: request.goals || [], teachingStyle: [], preferredTime: [], avoid: [], competitiveLevel: "" },
    results
  };
}

function parseTimeToMinutes(timeVal: any): number | null {
  if (!timeVal) return null;
  let timeStr = String(timeVal).trim();
  if (timeStr.includes("T")) {
    const parts = timeStr.split("T")[1];
    if (parts) timeStr = parts;
  }
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const hrs = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (isNaN(hrs) || isNaN(mins)) return null;
  return hrs * 60 + mins;
}

function getSkillLevelValue(level: string): number {
  const norm = String(level || "").toLowerCase().trim();
  if (norm.includes("novice")) return 2;
  if (norm.includes("advanced intermediate")) return 4;
  if (norm.includes("intermediate")) return 3;
  if (norm.includes("expert")) return 6;
  if (norm.includes("advanced")) return 5;
  if (norm.includes("professional")) return 7;
  if (norm.includes("beginner")) return 1;
  return 0;
}

function getKeywordOverlapScore(styleA: string, goalA: string, styleB: string, goalB: string): number {
  const textA = `${styleA} ${goalA}`.toLowerCase();
  const textB = `${styleB} ${goalB}`.toLowerCase();

  if (!styleA.trim() && !goalA.trim() && !styleB.trim() && !goalB.trim()) {
    return 40;
  }
  if ((!styleA.trim() && !goalA.trim()) || (!styleB.trim() && !goalB.trim())) {
    return 40;
  }

  const stopWords = new Set(["và", "để", "thích", "tìm", "chơi", "cùng", "nhau", "cơ", "bản", "cho", "của", "với", "trong", "các", "có"]);
  const wordsA = textA.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9à-ỹ]/g, "")).filter(w => w.length > 1 && !stopWords.has(w));
  const wordsB = textB.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9à-ỹ]/g, "")).filter(w => w.length > 1 && !stopWords.has(w));

  const setA = new Set(wordsA);
  let matchCount = 0;
  for (const w of wordsB) {
    if (setA.has(w)) {
      matchCount++;
    }
  }

  if (matchCount > 0) {
    return Math.min(100, 50 + matchCount * 10);
  }
  return 50;
}

export async function matchTeammates(userId: number): Promise<any> {
  const userProfile = await playerMatchingRepo.findProfileByUserId(userId);
  if (!userProfile) {
    throw new Error("Hồ sơ matching của bạn không tồn tại");
  }

  const allCandidates = await playerMatchingRepo.findAllMatchingProfiles(userId);

  const candidatesWithStructured = allCandidates.map((c: any) => {
    let skillComp = 50;
    const skillUser = getSkillLevelValue(userProfile.SkillLevel);
    const skillCand = getSkillLevelValue(c.SkillLevel);
    if (skillUser > 0 && skillCand > 0) {
      const diff = Math.abs(skillUser - skillCand);
      if (diff === 0) skillComp = 100;
      else if (diff === 1) skillComp = 85;
      else if (diff === 2) skillComp = 70;
      else if (diff === 3) skillComp = 50;
      else if (diff === 4) skillComp = 35;
      else if (diff === 5) skillComp = 20;
      else skillComp = 10;
    }

    let roleComp = 50;
    const rU = String(userProfile.PlayingRole || "").toLowerCase().trim();
    const rC = String(c.PlayingRole || "").toLowerCase().trim();
    if (rU && rC) {
      if ((rU === "attacker" && rC === "defender") || (rU === "defender" && rC === "attacker")) {
        roleComp = 100;
      } else if ((rU === "aggressive" && rC === "control") || (rU === "control" && rC === "aggressive")) {
        roleComp = 95;
      } else if ((rU === "net player" && rC === "baseline player") || (rU === "baseline player" && rC === "net player")) {
        roleComp = 95;
      } else if (rU === "all-rounder" && ["attacker", "defender", "aggressive", "control", "net player", "baseline player"].includes(rC)) {
        roleComp = 90;
      } else if (rC === "all-rounder" && ["attacker", "defender", "aggressive", "control", "net player", "baseline player"].includes(rU)) {
        roleComp = 90;
      } else if (rU === "all-rounder" && rC === "all-rounder") {
        roleComp = 75;
      } else if (rU === rC) {
        roleComp = 75;
      } else {
        roleComp = 35;
      }
    }

    let schedOverlap = 50;
    const startU = parseTimeToMinutes(userProfile.AvailableStartTime);
    const endU = parseTimeToMinutes(userProfile.AvailableEndTime);
    const startC = parseTimeToMinutes(c.AvailableStartTime);
    const endC = parseTimeToMinutes(c.AvailableEndTime);
    if (startU !== null && endU !== null && startC !== null && endC !== null) {
      const overlapStart = Math.max(startU, startC);
      const overlapEnd = Math.min(endU, endC);
      const overlapMins = Math.max(0, overlapEnd - overlapStart);
      if (overlapMins >= 60) schedOverlap = 100;
      else if (overlapMins >= 30) schedOverlap = 75;
      else if (overlapMins > 0) schedOverlap = 50;
      else schedOverlap = 25;
    }

    let expSim = 50;
    if (typeof userProfile.ExperienceYears === "number" && typeof c.ExperienceYears === "number") {
      const diff = Math.abs(userProfile.ExperienceYears - c.ExperienceYears);
      if (diff <= 1) expSim = 100;
      else if (diff <= 3) expSim = 75;
      else if (diff <= 5) expSim = 55;
      else expSim = 40;
    }

    return {
      profile: c,
      skillComp,
      roleComp,
      schedOverlap,
      expSim
    };
  });

  // Sort candidates by basic structural match score descending so that AI evaluates the most compatible players
  candidatesWithStructured.sort((a, b) => {
    const scoreA = 0.30 * a.skillComp + 0.25 * a.roleComp + 0.20 * a.schedOverlap + 0.10 * a.expSim;
    const scoreB = 0.30 * b.skillComp + 0.25 * b.roleComp + 0.20 * b.schedOverlap + 0.10 * b.expSim;
    return scoreB - scoreA;
  });

  const topCandidates = candidatesWithStructured.slice(0, 5);

  const payload = {
    user: {
      playerId: userProfile.UserID,
      name: userProfile.FullName || "Player",
      playingRole: userProfile.PlayingRole || "",
      skillLevel: userProfile.SkillLevel || "",
      experienceYears: userProfile.ExperienceYears || 0,
      playStyle: userProfile.PlayStyle || "",
      goal: userProfile.Goal || "",
      availableStartTime: userProfile.AvailableStartTime || "",
      availableEndTime: userProfile.AvailableEndTime || ""
    },
    candidates: topCandidates.map(tc => ({
      playerId: tc.profile.UserID,
      name: tc.profile.FullName || "Player",
      playingRole: tc.profile.PlayingRole || "",
      skillLevel: tc.profile.SkillLevel || "",
      experienceYears: tc.profile.ExperienceYears || 0,
      playStyle: tc.profile.PlayStyle || "",
      goal: tc.profile.Goal || "",
      availableStartTime: tc.profile.AvailableStartTime || "",
      availableEndTime: tc.profile.AvailableEndTime || "",
      skillComp: tc.skillComp,
      roleComp: tc.roleComp,
      schedOverlap: tc.schedOverlap,
      expSim: tc.expSim
    }))
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("http://127.0.0.1:8000/api/ai/players/match-teammates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("FastAPI teammate matching failed");
    }

    const result = await response.json();

    // Map FastAPI results to include original DB profiles
    const finalResults = (result.results || []).map((r: any) => {
      const dbProfile = allCandidates.find((c: any) => c.UserID === r.player.playerId);
      return {
        ...r,
        player: dbProfile || r.player
      };
    });

    return {
      ...result,
      results: finalResults
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("FastAPI teammate call failed, falling back", error.message);

    const results = topCandidates.map(tc => {
      const semScore = getKeywordOverlapScore(
        userProfile.PlayStyle || "",
        userProfile.Goal || "",
        tc.profile.PlayStyle || "",
        tc.profile.Goal || ""
      );

      const finalScore = 0.30 * tc.skillComp + 0.25 * tc.roleComp + 0.20 * tc.schedOverlap + 0.10 * tc.expSim + 0.15 * semScore;

      const reasons: string[] = [];
      if (tc.skillComp >= 75) reasons.push("Trình độ phù hợp dễ phối hợp");
      if (tc.roleComp >= 90) reasons.push("Vai trò thi đấu bổ trợ tốt cho nhau");
      if (tc.schedOverlap >= 75) reasons.push("Có khung giờ rảnh trùng nhau");
      if (tc.expSim >= 75) reasons.push("Số năm kinh nghiệm tương đương");

      const missingStyleOrGoal = !userProfile.PlayStyle || !userProfile.Goal || !tc.profile.PlayStyle || !tc.profile.Goal;
      if (missingStyleOrGoal) {
        reasons.push("Lưu ý: Dữ liệu mô tả phong cách chơi hoặc mục tiêu còn thiếu");
      } else if (semScore >= 70) {
        reasons.push("Phong cách chơi và mục tiêu có sự tương hợp tốt");
      }

      return {
        player: tc.profile,
        score: parseFloat(finalScore.toFixed(1)),
        reasons: reasons.length > 0 ? reasons : ["Phù hợp với các tiêu chí matching cơ bản"]
      };
    }).sort((a, b) => (b.score || 0) - (a.score || 0));

    return {
      success: true,
      mode: "teammate",
      fallback: true,
      fallbackReason: error.message || "AI service offline",
      results
    };
  }
}

export async function matchOpponentTeams(userId: number): Promise<any> {
  const teammateId = await playerMatchingRepo.findUserTeammate(userId);
  if (!teammateId) {
    throw new Error("Bạn cần có đồng đội trước khi tìm cặp đối thủ phù hợp.");
  }

  const userProfile = await playerMatchingRepo.findProfileByUserId(userId);
  const teammateProfile = await playerMatchingRepo.findProfileByUserId(teammateId);
  if (!userProfile || !teammateProfile) {
    throw new Error("Hồ sơ matching của bạn hoặc đồng đội không tồn tại");
  }

  const getGroupInfoForPair = async (p1: number, p2: number) => {
    const gId = await groupRepo.findActiveGroupBetweenPlayers(p1, p2);
    if (!gId) return { groupId: null, creatorId: null };
    const details = await groupRepo.getGroupDetails(gId);
    return {
      groupId: gId,
      creatorId: details?.CreatorID || null
    };
  };

  const myGroupInfo = await getGroupInfoForPair(userId, teammateId);

  const getPlayerPower = async (profile: any) => {
    let skillNum = 40;
    const skillNorm = String(profile.SkillLevel || "").toLowerCase().trim();
    if (skillNorm.includes("beginner")) skillNum = 40;
    else if (skillNorm.includes("novice")) skillNum = 52;
    else if (skillNorm.includes("advanced intermediate")) skillNum = 78;
    else if (skillNorm.includes("intermediate")) skillNum = 65;
    else if (skillNorm.includes("expert")) skillNum = 92;
    else if (skillNorm.includes("advanced")) skillNum = 85;
    else if (skillNorm.includes("professional")) skillNum = 100;

    let expScore = 30;
    const exp = profile.ExperienceYears || 0;
    if (exp === 0) expScore = 30;
    else if (exp <= 2) expScore = 55;
    else if (exp <= 5) expScore = 75;
    else if (exp <= 9) expScore = 90;
    else expScore = 100;

    let trustScore = 0;
    if (profile.AvatarURL) trustScore += 20;
    if (profile.PlayStyle && profile.PlayStyle.trim()) trustScore += 20;
    if (profile.Goal && profile.Goal.trim()) trustScore += 20;
    if (profile.AvailableStartTime && profile.AvailableEndTime) trustScore += 20;
    if (profile.PlayingRole) trustScore += 20;

    let activityScore = 50;
    try {
      const actCount = await playerMatchingRepo.getRecentActivityCount(profile.UserID);
      activityScore = Math.min(100, 50 + actCount * 10);
    } catch {
      activityScore = 50;
    }

    return 0.45 * skillNum + 0.25 * expScore + 0.15 * trustScore + 0.15 * activityScore;
  };

  const getRoleSynergyBonus = (roleA: string, roleB: string): number => {
    const rA = String(roleA || "").toLowerCase().trim();
    const rB = String(roleB || "").toLowerCase().trim();

    if (!rA || !rB) return 0;
    if ((rA === "attacker" && rB === "defender") || (rA === "defender" && rB === "attacker")) return 8;
    if ((rA === "aggressive" && rB === "control") || (rA === "control" && rB === "aggressive")) return 7;
    if ((rA === "net player" && rB === "baseline player") || (rA === "baseline player" && rB === "net player")) return 7;
    if (rA === "all-rounder" && ["attacker", "defender", "aggressive", "control", "net player", "baseline player"].includes(rB)) return 5;
    if (rB === "all-rounder" && ["attacker", "defender", "aggressive", "control", "net player", "baseline player"].includes(rA)) return 5;
    if (rA === rB) return 2;
    return 2;
  };

  const userPower = await getPlayerPower(userProfile);
  const teammatePower = await getPlayerPower(teammateProfile);
  const myTeamPower = (userPower + teammatePower) / 2 + getRoleSynergyBonus(userProfile.PlayingRole, teammateProfile.PlayingRole);

  const allCandidates = await playerMatchingRepo.findAllMatchingProfiles(userId);
  const filteredCandidates = allCandidates.filter((c: any) => c.UserID !== teammateId);

  const opponentPairs: any[] = [];
  for (let i = 0; i < filteredCandidates.length; i++) {
    for (let j = i + 1; j < filteredCandidates.length; j++) {
      opponentPairs.push({ pC: filteredCandidates[i], pD: filteredCandidates[j] });
    }
  }

  if (opponentPairs.length === 0) {
    return {
      success: true,
      mode: "opponent_team",
      fallback: false,
      myTeam: {
        players: [userProfile, teammateProfile],
        teamPower: parseFloat(myTeamPower.toFixed(1)),
        groupId: myGroupInfo.groupId
      },
      results: []
    };
  }

  const evaluatedPairs = await Promise.all(opponentPairs.map(async (pair) => {
    const { pC, pD } = pair;

    const powerC = await getPlayerPower(pC);
    const powerD = await getPlayerPower(pD);
    const oppTeamPower = (powerC + powerD) / 2 + getRoleSynergyBonus(pC.PlayingRole, pD.PlayingRole);

    let powerBal = 40;
    const powerDiff = Math.abs(myTeamPower - oppTeamPower);
    if (powerDiff < 5) powerBal = 100;
    else if (powerDiff < 10) powerBal = 85;
    else if (powerDiff < 15) powerBal = 70;
    else if (powerDiff < 20) powerBal = 55;
    else powerBal = Math.max(10, 40 - Math.round((powerDiff - 20) * 2));

    let schedOverlap = 50;
    const startU = parseTimeToMinutes(userProfile.AvailableStartTime);
    const endU = parseTimeToMinutes(userProfile.AvailableEndTime);
    const startT = parseTimeToMinutes(teammateProfile.AvailableStartTime);
    const endT = parseTimeToMinutes(teammateProfile.AvailableEndTime);

    const startC = parseTimeToMinutes(pC.AvailableStartTime);
    const endC = parseTimeToMinutes(pC.AvailableEndTime);
    const startD = parseTimeToMinutes(pD.AvailableStartTime);
    const endD = parseTimeToMinutes(pD.AvailableEndTime);

    if (startU !== null && endU !== null && startT !== null && endT !== null &&
      startC !== null && endC !== null && startD !== null && endD !== null) {
      const myStart = Math.max(startU, startT);
      const myEnd = Math.min(endU, endT);

      const oppStart = Math.max(startC, startD);
      const oppEnd = Math.min(endC, endD);

      if (myStart < myEnd && oppStart < oppEnd) {
        const overlapStart = Math.max(myStart, oppStart);
        const overlapEnd = Math.min(myEnd, oppEnd);
        const overlapMins = Math.max(0, overlapEnd - overlapStart);
        if (overlapMins >= 60) schedOverlap = 100;
        else if (overlapMins >= 30) schedOverlap = 75;
        else if (overlapMins > 0) schedOverlap = 50;
        else schedOverlap = 25;
      } else {
        schedOverlap = 25;
      }
    }

    const containsComp = (txt: string) => /thi đấu|cọ xát|tournament|competition|giải đấu/i.test(txt);
    const containsCasual = (txt: string) => /giao lưu|vui vẻ|fun|social|friendly|sức khỏe/i.test(txt);
    const containsPractice = (txt: string) => /tập luyện|nâng trình|practice|coaching|learning/i.test(txt);

    const goalMy = `${userProfile.Goal} ${teammateProfile.Goal}`;
    const goalOpp = `${pC.Goal} ${pD.Goal}`;

    let goalComp = 50;
    if (userProfile.Goal || teammateProfile.Goal || pC.Goal || pD.Goal) {
      const compMy = containsComp(goalMy);
      const compOpp = containsComp(goalOpp);
      const casMy = containsCasual(goalMy);
      const casOpp = containsCasual(goalOpp);
      const pracMy = containsPractice(goalMy);
      const pracOpp = containsPractice(goalOpp);

      if (compMy && compOpp) goalComp = 100;
      else if (casMy && casOpp) goalComp = 85;
      else if (pracMy && pracOpp) goalComp = 85;
      else if (pracMy && (compOpp || casOpp)) goalComp = 65;
      else if (pracOpp && (compMy || casMy)) goalComp = 65;
      else goalComp = 45;
    }

    const myAvgExp = ((userProfile.ExperienceYears || 0) + (teammateProfile.ExperienceYears || 0)) / 2;
    const oppAvgExp = ((pC.ExperienceYears || 0) + (pD.ExperienceYears || 0)) / 2;
    const expDiff = Math.abs(myAvgExp - oppAvgExp);

    let expBal = 40;
    if (expDiff <= 1) expBal = 100;
    else if (expDiff <= 3) expBal = 80;
    else if (expDiff <= 5) expBal = 60;
    else expBal = 40;

    const oppGroupInfo = await getGroupInfoForPair(pC.UserID, pD.UserID);

    return {
      pC,
      pD,
      oppTeamPower,
      powerBal,
      schedOverlap,
      goalComp,
      expBal,
      groupId: oppGroupInfo.groupId,
      creatorId: oppGroupInfo.creatorId
    };
  }));

  evaluatedPairs.sort((a, b) => {
    const scoreA = 0.50 * a.powerBal + 0.30 * a.schedOverlap;
    const scoreB = 0.50 * b.powerBal + 0.30 * b.schedOverlap;
    return scoreB - scoreA;
  });

  const topPairs = evaluatedPairs.slice(0, 5);

  const payload = {
    myTeam: {
      players: [
        {
          playerId: userProfile.UserID,
          name: userProfile.FullName || "Player",
          playingRole: userProfile.PlayingRole || "",
          skillLevel: userProfile.SkillLevel || "",
          experienceYears: userProfile.ExperienceYears || 0,
          playStyle: userProfile.PlayStyle || "",
          goal: userProfile.Goal || "",
          availableStartTime: userProfile.AvailableStartTime || "",
          availableEndTime: userProfile.AvailableEndTime || ""
        },
        {
          playerId: teammateProfile.UserID,
          name: teammateProfile.FullName || "Player",
          playingRole: teammateProfile.PlayingRole || "",
          skillLevel: teammateProfile.SkillLevel || "",
          experienceYears: teammateProfile.ExperienceYears || 0,
          playStyle: teammateProfile.PlayStyle || "",
          goal: teammateProfile.Goal || "",
          availableStartTime: teammateProfile.AvailableStartTime || "",
          availableEndTime: teammateProfile.AvailableEndTime || ""
        }
      ],
      teamPower: myTeamPower
    },
    opponentTeams: topPairs.map(tp => ({
      opponentTeamId: `${tp.pC.UserID}_${tp.pD.UserID}`,
      players: [
        {
          playerId: tp.pC.UserID,
          name: tp.pC.FullName || "Player",
          playingRole: tp.pC.PlayingRole || "",
          skillLevel: tp.pC.SkillLevel || "",
          experienceYears: tp.pC.ExperienceYears || 0,
          playStyle: tp.pC.PlayStyle || "",
          goal: tp.pC.Goal || "",
          availableStartTime: tp.pC.AvailableStartTime || "",
          availableEndTime: tp.pC.AvailableEndTime || ""
        },
        {
          playerId: tp.pD.UserID,
          name: tp.pD.FullName || "Player",
          playingRole: tp.pD.PlayingRole || "",
          skillLevel: tp.pD.SkillLevel || "",
          experienceYears: tp.pD.ExperienceYears || 0,
          playStyle: tp.pD.PlayStyle || "",
          goal: tp.pD.Goal || "",
          availableStartTime: tp.pD.AvailableStartTime || "",
          availableEndTime: tp.pD.AvailableEndTime || ""
        }
      ],
      teamPower: tp.oppTeamPower,
      powerBal: tp.powerBal,
      schedOverlap: tp.schedOverlap,
      goalComp: tp.goalComp,
      expBal: tp.expBal
    }))
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("http://127.0.0.1:8000/api/ai/players/match-opponents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("FastAPI opponent matching failed");
    }

    const result = await response.json();

    // Map FastAPI results to include group info and database profiles
    const finalResults = result.results.map((r: any) => {
      const matchPair = topPairs.find(tp => `${tp.pC.UserID}_${tp.pD.UserID}` === r.opponentTeamId);
      return {
        ...r,
        opponentTeam: {
          players: matchPair ? [matchPair.pC, matchPair.pD] : (r.opponentTeam?.players || []),
          groupId: matchPair?.groupId || null,
          creatorId: matchPair?.creatorId || null
        }
      };
    });

    return {
      success: true,
      mode: "opponent_team",
      fallback: result.fallback || false,
      fallbackReason: result.fallbackReason || null,
      myTeam: {
        players: [userProfile, teammateProfile],
        teamPower: parseFloat(myTeamPower.toFixed(1)),
        groupId: myGroupInfo.groupId
      },
      results: finalResults
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("FastAPI opponent call failed, falling back", error.message);

    const results = topPairs.map(tp => {
      const myStyleText = `${userProfile.PlayStyle} ${teammateProfile.PlayStyle}`;
      const myGoalText = `${userProfile.Goal} ${teammateProfile.Goal}`;
      const oppStyleText = `${tp.pC.PlayStyle} ${tp.pD.PlayStyle}`;
      const oppGoalText = `${tp.pC.Goal} ${tp.pD.Goal}`;

      const semScore = getKeywordOverlapScore(myStyleText, myGoalText, oppStyleText, oppGoalText);
      const finalScore = 0.40 * tp.powerBal + 0.25 * tp.schedOverlap + 0.15 * tp.goalComp + 0.10 * tp.expBal + 0.10 * semScore;

      const reasons: string[] = [];
      if (tp.powerBal >= 85) reasons.push("Sức mạnh hai đội rất cân bằng");
      if (tp.expBal >= 80) reasons.push("Kinh nghiệm thi đấu tương đương");
      if (tp.schedOverlap >= 75) reasons.push("Cả hai đội đều rảnh cùng khung giờ");
      if (semScore >= 70) reasons.push("Phong cách chơi tạo ra trận đấu cạnh tranh tốt");

      return {
        opponentTeam: {
          players: [tp.pC, tp.pD],
          groupId: tp.groupId || null,
          creatorId: tp.creatorId || null
        },
        opponentTeamId: `${tp.pC.UserID}_${tp.pD.UserID}`,
        teamPower: parseFloat(tp.oppTeamPower.toFixed(1)),
        score: parseFloat(finalScore.toFixed(1)),
        reasons: reasons.length > 0 ? reasons : ["Phù hợp với các tiêu chí thi đấu cơ bản"]
      };
    }).sort((a, b) => (b.score || 0) - (a.score || 0));

    return {
      success: true,
      mode: "opponent_team",
      fallback: true,
      fallbackReason: error.message || "AI service offline",
      myTeam: {
        players: [userProfile, teammateProfile],
        teamPower: parseFloat(myTeamPower.toFixed(1)),
        groupId: myGroupInfo.groupId
      },
      results
    };
  }
}

