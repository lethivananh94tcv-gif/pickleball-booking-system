// ============================================================
// tournaments.validation.ts
// Validation schemas for the Tournament module
// ============================================================

import { z } from "zod";

export const createTournamentSchema = z.object({
  tournamentCode: z.string().min(1, "Mã giải đấu là bắt buộc").max(50),
  tournamentName: z.string().min(1, "Tên giải đấu là bắt buộc").max(255),
  description: z.string().optional(),
  location: z.string().optional(),
  registrationStart: z.string().min(1, "Ngày bắt đầu đăng ký là bắt buộc"),
  registrationEnd: z.string().min(1, "Ngày kết thúc đăng ký là bắt buộc"),
  tournamentStart: z.string().min(1, "Ngày bắt đầu giải đấu là bắt buộc"),
  tournamentEnd: z.string().min(1, "Ngày kết thúc giải đấu là bắt buộc"),
  prizeInfo: z.string().optional(),
  rules: z.string().optional(),
  imageURL: z.string().optional(),
  organizerName: z.string().optional(),
}).refine(data => {
  const regStart = new Date(data.registrationStart);
  const regEnd = new Date(data.registrationEnd);
  const tourStart = new Date(data.tournamentStart);
  const tourEnd = new Date(data.tournamentEnd);

  return regStart < regEnd && regEnd <= tourStart && tourStart < tourEnd;
}, {
  message: "Quy tắc ngày tháng: Bắt đầu đăng ký < Kết thúc đăng ký <= Bắt đầu giải < Kết thúc giải",
  path: ["registrationStart"]
}).refine(data => {
  const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const todayStr = `${nowVN.getFullYear()}-${String(nowVN.getMonth() + 1).padStart(2, "0")}-${String(nowVN.getDate()).padStart(2, "0")}`;
  const regStartStr = data.registrationStart.split("T")[0];
  return regStartStr >= todayStr;
}, {
  message: "Ngày bắt đầu đăng ký không được ở quá khứ",
  path: ["registrationStart"]
});

export const updateTournamentSchema = z.object({
  tournamentName: z.string().min(1, "Tên giải đấu là bắt buộc").max(255).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  registrationStart: z.string().optional(),
  registrationEnd: z.string().optional(),
  tournamentStart: z.string().optional(),
  tournamentEnd: z.string().optional(),
  prizeInfo: z.string().optional(),
  rules: z.string().optional(),
  imageURL: z.string().optional(),
  organizerName: z.string().optional(),
  adminOverride: z.boolean().optional(),
});

export const createDivisionSchema = z.object({
  divisionName: z.string().min(1, "Tên nội dung thi đấu là bắt buộc").max(255),
  competitionFormat: z.enum(["MenSingles", "WomenSingles", "MenDoubles", "WomenDoubles", "MixedDoubles"]),
  skillLevelName: z.string().optional(),
  minDUPR: z.number().min(0).max(8).optional().nullable(),
  maxDUPR: z.number().min(0).max(8).optional().nullable(),
  ageGroup: z.enum(["Youth", "Open", "Senior50", "Senior60"]),
  minAge: z.number().min(0).optional().nullable(),
  maxAge: z.number().min(0).optional().nullable(),
  maxTeams: z.number().int().min(2, "Số đội tối thiểu là 2"),
  registrationFee: z.number().min(0).optional().default(0),
  bracketType: z.enum(["SingleElimination", "RoundRobin", "GroupKnockout"]),
  enableThirdPlace: z.boolean().optional(),
  roundScheduleConfig: z.string().optional().nullable(),
});

export const updateDivisionSchema = z.object({
  divisionName: z.string().min(1, "Tên nội dung thi đấu là bắt buộc").max(255).optional(),
  skillLevelName: z.string().optional(),
  minDUPR: z.number().min(0).max(8).optional().nullable(),
  maxDUPR: z.number().min(0).max(8).optional().nullable(),
  minAge: z.number().min(0).optional().nullable(),
  maxAge: z.number().min(0).optional().nullable(),
  maxTeams: z.number().int().min(2).optional(),
  registrationFee: z.number().min(0).optional(),
  roundScheduleConfig: z.string().optional().nullable(),
});

const athleteSchema = z.object({
  athleteNo: z.number().int(),
  fullName: z.string().min(2, "Họ và tên tối thiểu 2 ký tự"),
  phoneNumber: z.string().regex(/^0\d{9}$/, "Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0"),
  rating: z.number().min(0).max(8),
  province: z.string().min(1, "Tỉnh thành là bắt buộc"),
  gender: z.enum(["Male", "Female"]),
  dateOfBirth: z.string().min(1, "Ngày sinh là bắt buộc"),
  photoUrl: z.string().optional().nullable(),
  cccdUrl: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export const registerSinglesSchema = z.object({
  athletes: z.array(athleteSchema).min(1).max(1),
});

export const registerDoublesSchema = z.object({
  partnerOption: z.enum(["ExistingPartner", "SuggestOnly", "AutoMatch", "ManualForm"]),
  teamName: z.string().optional(),
  partnerEmailOrPhone: z.string().optional(),
  athletes: z.array(athleteSchema).optional(),
}).refine(data => {
  if (data.partnerOption === "ExistingPartner") {
    return !!data.partnerEmailOrPhone && data.partnerEmailOrPhone.trim().length > 0;
  }
  if (data.partnerOption === "ManualForm") {
    return !!data.athletes && data.athletes.length === 2;
  }
  return true;
}, {
  message: "Thiếu thông tin đồng đội hoặc vận động viên cho hình thức đăng ký này",
  path: ["athletes"]
});

export const invitePartnerSchema = z.object({
  receiverId: z.number().int().positive("receiverId phải là số dương"),
});

export const respondInvitationSchema = z.object({
  action: z.enum(["Accepted", "Declined"]),
});

export const createTournamentPaymentSchema = z.object({
  registrationId: z.number().int().positive("registrationId phải là số dương"),
  paymentMethod: z.enum(["VNPay", "Momo", "PayOS", "BankTransfer", "Mock"]),
});

export const generateScheduleSchema = z.object({
  courtIds: z.array(z.number().int().positive()).min(1, "Ít nhất phải chọn 1 sân"),
  startDateTime: z.string().min(1, "Thời gian bắt đầu là bắt buộc"),
  endDateTime: z.string().optional(),
  matchDurationMinutes: z.number().int().positive().default(60),
  breakMinutes: z.number().int().nonnegative().default(10),
  dailyStartHour: z.string().optional(),
  dailyEndHour: z.string().optional(),
  roundNo: z.number().int().optional(),
});

export const reportMatchScoreSchema = z.object({
  sets: z.array(z.object({
    setNo: z.number().int().min(1).max(5),
    teamAScore: z.number().int().nonnegative(),
    teamBScore: z.number().int().nonnegative(),
  })).min(1, "Phải cung cấp ít nhất 1 set"),
  adminOverride: z.boolean().optional(),
  reason: z.string().optional(),
});

export const updateRoundMilestonesSchema = z.object({
  milestones: z.array(z.object({
    roundNo: z.number().int().positive(),
    roundName: z.string().optional(),
    scheduledStart: z.string().min(1, "Thời gian bắt đầu là bắt buộc"),
    courtId: z.number().int().optional(),
  })).min(1, "Phải cung cấp ít nhất 1 cột mốc"),
});
