import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";
import { getCourts } from "@/services/courtApi";
import { getDailyBookings, type DailyBooking } from "@/services/bookingApi";
import { adminGetAllCoaches } from "@/services/coachApi";
import { getAdminUsers } from "@/services/admin-users.service";
import { getAdminPromotions } from "@/services/promotionApi";

export type DashboardStats = {
  totalCourts: number;
  activeCourts: number;
  todayBookingsCount: number;
  activeCoaches: number;
  activeStaff: number;
  activeCombos: number;
  activePromotions: number;
  todayRevenue: number;
  todayTournamentRevenue?: number;
  latestBookings: {
    BookingCode: string;
    PlayerName: string;
    PlayerEmail: string;
    PlayerPhone: string | null;
    ServiceType: string;
    CourtName: string | null;
    CoachName: string | null;
    StartTime: string | null;
    EndTime: string | null;
    Status: string;
    CreatedAt: string;
  }[];
};

export type SaaSDashboardStats = {
  revenue: number;
  prevRevenue: number;
  tournamentRevenue?: number;
  prevTournamentRevenue?: number;
  monthRevenue?: number;
  bookingsCount: number;
  prevBookingsCount: number;
  totalCourts: number;
  activeCourts: number;
  activeCoaches: number;
  activeStaff: number;
  activeCombos: number;
  dailyRevenueTrend: {
    date: string;
    revenue: number;
    bookingsCount: number;
  }[];
  hourlyBookingTrend: {
    hour: number;
    bookingsCount: number;
  }[];
  bookingStatusBreakdown: {
    status: string;
    count: number;
  }[];
  topCourts: {
    courtId: number;
    courtName: string;
    bookingsCount: number;
    totalRevenue: number;
  }[];
  topCoaches: {
    coachId: number;
    coachName: string;
    bookingsCount: number;
    totalRevenue: number;
  }[];
  topCombos: {
    promotionId: number;
    promotionCode: string;
    promotionName: string;
    usageCount: number;
  }[];
  paymentMethodAnalytics: {
    paymentMethod: string;
    count: number;
    totalAmount: number;
  }[];
  newUsersCount: number;
  activeUsersCount: number;
  returningUsersCount: number;
  recentActivities: {
    activityType: string;
    createdAt: string;
    actorName: string;
    eventCode: string;
    description: string;
    amountValue: number | null;
  }[];
};

export async function getDashboardStats(
  token: string,
  startDate?: string,
  endDate?: string
): Promise<DashboardStats | SaaSDashboardStats> {
  const url = startDate && endDate
    ? `/api/admin/dashboard?startDate=${startDate}&endDate=${endDate}`
    : "/api/admin/dashboard";
  const res = await apiClient<ApiResponse<DashboardStats | SaaSDashboardStats>>(url, {
    token,
  });
  return res.data;
}

export type DashboardSnapshot = {
  stats: DashboardStats;
  dailyBookings: DailyBooking[];
  source: "api" | "collected" | "demo";
  saaSDats?: SaaSDashboardStats;
};

function todayStr() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

function isActiveStatus(status?: string | null) {
  const value = String(status ?? "").toLowerCase();
  return ["active", "available", "approved"].includes(value);
}

function isEmptyStats(stats: DashboardStats) {
  return (
    stats.todayRevenue === 0 &&
    stats.todayBookingsCount === 0 &&
    stats.activeCourts === 0 &&
    stats.totalCourts === 0 &&
    stats.activeCoaches === 0 &&
    stats.activeStaff === 0 &&
    stats.activeCombos === 0 &&
    stats.latestBookings.length === 0
  );
}

function getEmptyStats(): DashboardStats {
  return {
    todayRevenue: 0,
    todayTournamentRevenue: 0,
    todayBookingsCount: 0,
    activeCourts: 0,
    totalCourts: 0,
    activeCoaches: 0,
    activeStaff: 0,
    activeCombos: 0,
    activePromotions: 0,
    latestBookings: [],
  };
}

function mergeStats(base: DashboardStats, fallback: Partial<DashboardStats>): DashboardStats {
  return {
    todayRevenue: base.todayRevenue || fallback.todayRevenue || 0,
    todayTournamentRevenue: base.todayTournamentRevenue || fallback.todayTournamentRevenue || 0,
    todayBookingsCount: base.todayBookingsCount || fallback.todayBookingsCount || 0,
    activeCourts: base.activeCourts || fallback.activeCourts || 0,
    totalCourts: base.totalCourts || fallback.totalCourts || 0,
    activeCoaches: base.activeCoaches || fallback.activeCoaches || 0,
    activeStaff: base.activeStaff || fallback.activeStaff || 0,
    activeCombos: base.activeCombos || fallback.activeCombos || 0,
    activePromotions: base.activePromotions || fallback.activePromotions || 0,
    latestBookings:
      base.latestBookings.length > 0
        ? base.latestBookings
        : fallback.latestBookings || [],
  };
}

function toLatestBooking(booking: DailyBooking): DashboardStats["latestBookings"][number] {
  return {
    BookingCode: booking.BookingCode,
    PlayerName: booking.PlayerName,
    PlayerEmail: booking.PlayerEmail,
    PlayerPhone: booking.PlayerPhone,
    ServiceType: booking.BookingType,
    CourtName: booking.CourtName,
    CoachName: booking.CoachName,
    StartTime: booking.StartTime,
    EndTime: booking.EndTime,
    Status: booking.Status,
    CreatedAt: booking.CreatedAt,
  };
}

const demoDailyBookings: DailyBooking[] = [
  {
    BookingID: 9001,
    BookingCode: "BK-DEMO-001",
    BookingType: "Court",
    BookingDate: todayStr(),
    StartTime: "07:00",
    EndTime: "08:30",
    TotalAmount: 180000,
    Status: "Confirmed",
    CheckInTime: null,
    PaymentDeadline: null,
    PlayerName: "Nguyen Minh Anh",
    PlayerEmail: "minhanh@example.com",
    PlayerPhone: "0901234567",
    CourtName: "San A1",
    CoachName: null,
    PaymentMethod: "Momo",
    PaymentStatus: "Paid",
    CreatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    BookingID: 9002,
    BookingCode: "BK-DEMO-002",
    BookingType: "Combo",
    BookingDate: todayStr(),
    StartTime: "09:00",
    EndTime: "10:30",
    TotalAmount: 420000,
    Status: "Paid",
    CheckInTime: null,
    PaymentDeadline: null,
    PlayerName: "Tran Hoang Nam",
    PlayerEmail: "hoangnam@example.com",
    PlayerPhone: "0912345678",
    CourtName: "San B2",
    CoachName: "Coach Huy",
    PaymentMethod: "VNPay",
    PaymentStatus: "Paid",
    CreatedAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
  },
  {
    BookingID: 9003,
    BookingCode: "BK-DEMO-003",
    BookingType: "Coach",
    BookingDate: todayStr(),
    StartTime: "16:00",
    EndTime: "17:00",
    TotalAmount: 250000,
    Status: "PendingPayment",
    CheckInTime: null,
    PaymentDeadline: null,
    PlayerName: "Le Gia Bao",
    PlayerEmail: "giabao@example.com",
    PlayerPhone: "0923456789",
    CourtName: null,
    CoachName: "Coach Linh",
    PaymentMethod: null,
    PaymentStatus: "Pending",
    CreatedAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
  },
];

export function getDemoSaaSDashboardStats(): SaaSDashboardStats {
  return {
    revenue: 87560000,
    prevRevenue: 73800000,
    tournamentRevenue: 15400000,
    prevTournamentRevenue: 12000000,
    monthRevenue: 74426000,
    bookingsCount: 156,
    prevBookingsCount: 142,
    totalCourts: 10,
    activeCourts: 10,
    activeCoaches: 6,
    activeStaff: 1,
    activeCombos: 5,
    dailyRevenueTrend: [
      { date: "01/05", revenue: 11200000, bookingsCount: 18 },
      { date: "02/05", revenue: 14500000, bookingsCount: 22 },
      { date: "03/05", revenue: 12100000, bookingsCount: 19 },
      { date: "04/05", revenue: 17400000, bookingsCount: 28 },
      { date: "05/05", revenue: 13900000, bookingsCount: 20 },
      { date: "06/05", revenue: 16200000, bookingsCount: 25 },
      { date: "07/05", revenue: 12660000, bookingsCount: 24 }
    ],
    hourlyBookingTrend: [
      { hour: 0, bookingsCount: 0 },
      { hour: 2, bookingsCount: 1 },
      { hour: 4, bookingsCount: 2 },
      { hour: 6, bookingsCount: 4 },
      { hour: 8, bookingsCount: 7 },
      { hour: 10, bookingsCount: 11 },
      { hour: 12, bookingsCount: 16 },
      { hour: 14, bookingsCount: 13 },
      { hour: 16, bookingsCount: 9 },
      { hour: 18, bookingsCount: 8 },
      { hour: 20, bookingsCount: 12 },
      { hour: 22, bookingsCount: 7 }
    ],
    bookingStatusBreakdown: [
      { status: "Completed", count: 112 },
      { status: "Cancelled", count: 26 },
      { status: "PendingPayment", count: 18 }
    ],
    topCourts: [
      { courtId: 1, courtName: "Sunrise Court", bookingsCount: 45, totalRevenue: 9000000 },
      { courtId: 2, courtName: "Galaxy Arena", bookingsCount: 32, totalRevenue: 6400000 },
      { courtId: 3, courtName: "PickleStar Center", bookingsCount: 28, totalRevenue: 5600000 },
      { courtId: 4, courtName: "Champion Court", bookingsCount: 24, totalRevenue: 4800000 },
      { courtId: 5, courtName: "Victory Pickleball", bookingsCount: 18, totalRevenue: 3600000 }
    ],
    topCoaches: [
      { coachId: 1, coachName: "Coach Huy", bookingsCount: 20, totalRevenue: 5000000 },
      { coachId: 2, coachName: "Coach Linh", bookingsCount: 15, totalRevenue: 3750000 },
      { coachId: 3, coachName: "Coach Nam", bookingsCount: 12, totalRevenue: 3000000 }
    ],
    topCombos: [
      { promotionId: 1, promotionCode: "HELLO5", promotionName: "Khuyến mãi chào mừng", usageCount: 25 },
      { promotionId: 2, promotionCode: "SUMMER20", promotionName: "Ưu đãi mùa hè", usageCount: 18 }
    ],
    paymentMethodAnalytics: [
      { paymentMethod: "VietQR", count: 132, totalAmount: 73900640 },
      { paymentMethod: "Tiền mặt (Khách vãng lai)", count: 24, totalAmount: 13659360 }
    ],
    newUsersCount: 35,
    activeUsersCount: 120,
    returningUsersCount: 85,
    recentActivities: [
      {
        activityType: "Booking",
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        actorName: "Sunrise Court",
        eventCode: "BK02567",
        description: "Booking #BK02567 đã được xác nhận",
        amountValue: 350000
      },
      {
        activityType: "Refund",
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        actorName: "Nguyen Van A",
        eventCode: "RF0123",
        description: "Hoàn tiền #RF0123 thành công",
        amountValue: 1250000
      },
      {
        activityType: "Promotion",
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        actorName: "Admin",
        eventCode: "HELLO5",
        description: 'Combo "HELLO5" được sử dụng - Giảm 5%',
        amountValue: null
      },
      {
        activityType: "User",
        createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        actorName: "Nguyen Van A",
        eventCode: "nguyenvana@example.com",
        description: "Người chơi mới đăng ký",
        amountValue: null
      }
    ]
  };
}

function getDemoSnapshot(): DashboardSnapshot {
  const todayRevenue = demoDailyBookings
    .filter((booking) => ["Paid", "Confirmed", "CheckedIn", "Completed"].includes(booking.Status))
    .reduce((sum, booking) => sum + booking.TotalAmount, 0);

  return {
    source: "demo",
    dailyBookings: demoDailyBookings,
    stats: {
      totalCourts: 8,
      activeCourts: 7,
      todayBookingsCount: demoDailyBookings.length,
      activeCoaches: 5,
      activeStaff: 4,
      activeCombos: 3,
      activePromotions: 3,
      todayRevenue,
      todayTournamentRevenue: 1800000, // mock today tournament revenue
      latestBookings: demoDailyBookings.map(toLatestBooking),
    },
    saaSDats: getDemoSaaSDashboardStats(),
  };
}

export function getDemoDashboardSnapshot(): DashboardSnapshot {
  return getDemoSnapshot();
}

export async function getDashboardSnapshot(
  token: string,
  startDate?: string,
  endDate?: string
): Promise<DashboardSnapshot> {
  if (startDate && endDate) {
    try {
      const [stats, dailyBookings] = await Promise.all([
        getDashboardStats(token, startDate, endDate) as Promise<SaaSDashboardStats>,
        getDailyBookings(token, todayStr()).catch(() => []),
      ]);
      return {
        source: "api",
        dailyBookings,
        stats: {
          totalCourts: stats.totalCourts,
          activeCourts: stats.activeCourts,
          todayBookingsCount: stats.bookingsCount,
          activeCoaches: stats.activeCoaches,
          activeStaff: stats.activeStaff,
          activeCombos: stats.activeCombos,
          activePromotions: 0,
          todayRevenue: stats.revenue,
          todayTournamentRevenue: stats.tournamentRevenue,
          latestBookings: [],
        },
        saaSDats: {
          ...stats,
          monthRevenue: stats.monthRevenue,
        },
      };
    } catch (err) {
      console.error("Lỗi tải SaaS stats từ API, chuyển sang demo:", err);
      return {
        ...getDemoSnapshot(),
        source: "demo",
      };
    }
  }

  const [statsResult, dailyResult] = await Promise.allSettled([
    getDashboardStats(token),
    getDailyBookings(token, todayStr()),
  ]);

  const baseStats =
    statsResult.status === "fulfilled"
      ? statsResult.value as DashboardStats
      : getEmptyStats();
  const dailyBookings = dailyResult.status === "fulfilled" ? dailyResult.value : [];

  const collectedResult = await Promise.allSettled([
    getCourts(),
    adminGetAllCoaches(token),
    getAdminUsers({ page: 1, limit: 100, roleName: "Staff" }),
    getAdminPromotions(token, { status: "Active" }),
  ]);

  const courts = collectedResult[0].status === "fulfilled" ? collectedResult[0].value : [];
  const coaches = collectedResult[1].status === "fulfilled" ? collectedResult[1].value : [];
  const staffPage = collectedResult[2].status === "fulfilled" ? collectedResult[2].value : null;
  const promotions = collectedResult[3].status === "fulfilled" ? collectedResult[3].value : [];

  const collectedStats = mergeStats(baseStats, {
    totalCourts: courts.length,
    activeCourts: courts.filter((court) => isActiveStatus(court.Status)).length,
    activeCoaches: coaches.filter((coach) => isActiveStatus(coach.Status)).length,
    activeStaff:
      staffPage?.items.filter((staff) => isActiveStatus(staff.status)).length ??
      staffPage?.pagination.total ??
      0,
    activeCombos: promotions.length,
    activePromotions: promotions.length,
    todayBookingsCount: dailyBookings.length,
    todayRevenue: dailyBookings
      .filter((booking) => ["Paid", "Confirmed", "CheckedIn", "Completed"].includes(booking.Status))
      .reduce((sum, booking) => sum + booking.TotalAmount, 0),
    todayTournamentRevenue: baseStats.todayTournamentRevenue || 0,
    latestBookings: dailyBookings.map(toLatestBooking),
  });

  if (isEmptyStats(collectedStats) && dailyBookings.length === 0) {
    return getDemoSnapshot();
  }

  return {
    source: isEmptyStats(baseStats) ? "collected" : "api",
    stats: collectedStats,
    dailyBookings,
    saaSDats: getDemoSaaSDashboardStats(), // fallback/default
  };
}
