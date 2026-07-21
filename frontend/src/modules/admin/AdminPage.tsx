"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./AdminPage.module.css";
import {
  getDashboardSnapshot,
  getDemoDashboardSnapshot,
  type SaaSDashboardStats,
  getDemoSaaSDashboardStats,
} from "@/services/adminApi";
import { getManagerRefunds, approveRefund } from "@/services/refundApi";
import { getRelativeTime } from "@/utils/timeFormat";
import { getToken, getUser } from "@/utils/authStorage";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiCalendar,
  FiUsers,
  FiAward,
  FiClock,
  FiRefreshCw,
  FiChevronDown,
  FiBell,
  FiActivity,
  FiGrid,
  FiFilter,
  FiAlertCircle,
  FiTag,
  FiCheckCircle,
  FiEdit,
  FiPlus,
  FiSearch,
  FiMail,
  FiCheck,
  FiX,
  FiCpu,
  FiHardDrive,
  FiDatabase,
  FiShield,
} from "react-icons/fi";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Completed: "#4f46e5", // Indigo
  Confirmed: "#10b981", // Emerald
  Paid: "#10b981",
  CheckedIn: "#8b5cf6", // Purple
  PendingPayment: "#f59e0b", // Amber
  Cancelled: "#ef4444", // Rose
  Refunded: "#ec4899", // Pink
};

const STATUS_LABELS: Record<string, string> = {
  Completed: "Đã hoàn thành",
  Confirmed: "Đã xác nhận",
  Paid: "Đã thanh toán",
  CheckedIn: "Đã Check-in",
  PendingPayment: "Chờ thanh toán",
  Cancelled: "Đã hủy",
  Refunded: "Hoàn tiền",
};

const PAYMENT_COLORS: Record<string, string> = {
  "VietQR": "#4f46e5", // Indigo
  "Tiền mặt (Khách vãng lai)": "#f59e0b", // Amber
};
const FALLBACK_PAYMENT_COLORS = ["#4f46e5", "#f59e0b", "#8b5cf6", "#10b981", "#ec4899"];

export default function AdminPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [user, setUser] = useState<any | null>(null);
  
  // Data States
  const [saaSDats, setSaaSDats] = useState<SaaSDashboardStats | null>(null);
  const [dailyBookings, setDailyBookings] = useState<any[]>([]);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataSource, setDataSource] = useState<"api" | "collected" | "demo">("api");

  // Filter States
  const [datePreset, setDatePreset] = useState("7days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Time scale switch (Weekly / Monthly)
  const [timeScale, setTimeScale] = useState<"weekly" | "monthly">("weekly");

  useEffect(() => {
    setIsMounted(true);
    const jwt = getToken();
    setToken(jwt);
    const currentUser = getUser();
    setUser(currentUser);
    const userRole = String(
      currentUser?.RoleName || currentUser?.role || currentUser?.roles?.[0] || ""
    );
    setRole(userRole);
    if (userRole.toLowerCase().includes("staff")) {
      router.push("/staff/operations");
    }
  }, [router]);

  const getPresetDates = useCallback((preset: string) => {
    const end = new Date();
    const start = new Date();
    if (preset === "7days") {
      start.setDate(end.getDate() - 6);
    } else if (preset === "30days") {
      start.setDate(end.getDate() - 29);
    } else if (preset === "thisMonth") {
      start.setDate(1);
    }
    const toYMD = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    return {
      startDate: toYMD(start),
      endDate: toYMD(end),
    };
  }, []);

  // Main data loader
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    
    let queryStart = "";
    let queryEnd = "";

    if (datePreset === "custom") {
      if (!customStartDate || !customEndDate) {
        setError("Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.");
        setLoading(false);
        return;
      }
      if (customStartDate > customEndDate) {
        setError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
        setLoading(false);
        return;
      }
      queryStart = customStartDate;
      queryEnd = customEndDate;
    } else {
      const dates = getPresetDates(datePreset);
      queryStart = dates.startDate;
      queryEnd = dates.endDate;
    }

    const currentToken = getToken();

    // If no token, load demo mock data
    if (!currentToken) {
      setTimeout(() => {
        const demo = getDemoDashboardSnapshot();
        setSaaSDats(demo.saaSDats || getDemoSaaSDashboardStats());
        setDailyBookings(demo.dailyBookings || []);
        setDataSource("demo");
        setLoading(false);
      }, 500);
      return;
    }

    try {
      const snapshot = await getDashboardSnapshot(currentToken, queryStart, queryEnd);
      setSaaSDats(snapshot.saaSDats || getDemoSaaSDashboardStats());
      setDailyBookings(snapshot.dailyBookings || []);
      setDataSource(snapshot.source);

      // Fetch pending refunds
      try {
        const refunds = await getManagerRefunds(currentToken, { status: "Pending" });
        setRefundRequests(refunds || []);
      } catch (refundErr) {
        console.error("Lỗi lấy danh sách hoàn tiền:", refundErr);
        setRefundRequests([]);
      }
    } catch (err) {
      console.error("Lỗi tải dữ liệu dashboard:", err);
      setError("Không thể kết nối đến máy chủ. Đang hiển thị dữ liệu demo.");
      setSaaSDats(getDemoSaaSDashboardStats());
      setDataSource("demo");
    } finally {
      setLoading(false);
    }
  }, [datePreset, customStartDate, customEndDate, getPresetDates]);

  useEffect(() => {
    if (isMounted) {
      loadData();
    }
  }, [loadData, isMounted]);

  // Refund approval handler
  const handleApproveRefundRequest = async (refundCode: string) => {
    const currentToken = getToken();
    if (!currentToken) {
      alert("Vui lòng đăng nhập với quyền quản trị viên.");
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn duyệt đơn hoàn tiền ${refundCode}?`)) {
      return;
    }
    try {
      await approveRefund(currentToken, refundCode);
      alert("Đã duyệt hoàn tiền thành công!");
      loadData();
    } catch (err: any) {
      alert("Lỗi khi duyệt hoàn tiền: " + err.message);
    }
  };

  // Sparkline generator
  const renderKpiSparkline = (data: number[], color: string, id: string) => {
    if (!data || data.length < 2) {
      data = [30, 40, 35, 55, 45, 60, 50];
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 120;
    const height = 30;
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

    return (
      <svg className={styles.kpiSparkline} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#grad-${id})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // Format currency
  const formatCurrency = (val: number) => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M đ`;
    }
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0
    }).format(val);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(0, 0, 0, 0.05)",
          padding: "10px 14px",
          borderRadius: "10px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 16px -6px rgba(0, 0, 0, 0.05)",
        }}>
          <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontWeight: 500 }}>{label}</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "13.5px", color: "#0f172a", fontWeight: 600 }}>
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const userName = user?.FullName || user?.fullName || "Admin";

  if (loading && !saaSDats) {
    return (
      <main className={styles.page}>
        <div className={styles.skeletonHeader}></div>
        <div className={styles.skeletonKpis}>
          <div className={styles.skeletonCard}></div>
          <div className={styles.skeletonCard}></div>
          <div className={styles.skeletonCard}></div>
          <div className={styles.skeletonCard}></div>
        </div>
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonPanel}></div>
          <div className={styles.skeletonPanel}></div>
        </div>
      </main>
    );
  }

  const stats = saaSDats || getDemoSaaSDashboardStats();
  
  // Growth Calculations
  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat((((current - previous) / previous) * 100).toFixed(1));
  };
  const revGrowth = calculateGrowth(stats.revenue, stats.prevRevenue);
  const tournamentRevGrowth = calculateGrowth(stats.tournamentRevenue || 0, stats.prevTournamentRevenue || 0);
  const bookingsGrowth = calculateGrowth(stats.bookingsCount, stats.prevBookingsCount);

  // Booking status breakdowns
  const isBookingEmpty = stats.bookingsCount === 0;
  const statusPieData = isBookingEmpty
    ? [
        { name: "Đã hoàn thành", value: 1, color: "#3b82f6" },
        { name: "Đã hủy", value: 1, color: "#ef4444" }
      ]
    : stats.bookingStatusBreakdown.map((item) => ({
        name: STATUS_LABELS[item.status] || item.status,
        value: item.count,
        color: STATUS_COLORS[item.status] || "#94a3b8",
      }));

  // Payment method breakdowns
  const totalPaymentAmount = stats.paymentMethodAnalytics?.reduce((sum, item) => sum + item.totalAmount, 0) || 0;
  const isPaymentEmpty = totalPaymentAmount === 0;
  const paymentPieData = isPaymentEmpty
    ? [
        { name: "VietQR", value: 1, color: "#3b82f6" },
        { name: "Tiền mặt (Khách vãng lai)", value: 1, color: "#f97316" }
      ]
    : stats.paymentMethodAnalytics.map((item, idx) => ({
        name: item.paymentMethod || "Khác",
        value: item.totalAmount,
        color: PAYMENT_COLORS[item.paymentMethod] || FALLBACK_PAYMENT_COLORS[idx % FALLBACK_PAYMENT_COLORS.length],
      }));

  // Booking Volume Progress (Today)
  const totalBookingsCount = dailyBookings.length;
  const standardCount = dailyBookings.filter(b => b.BookingType === "Court").length;
  const premiumCount = dailyBookings.filter(b => b.BookingType === "Combo").length;
  const coachingCount = dailyBookings.filter(b => b.BookingType === "Coach").length;

  const standardPct = totalBookingsCount > 0 ? Math.round((standardCount / totalBookingsCount) * 100) : 0;
  const premiumPct = totalBookingsCount > 0 ? Math.round((premiumCount / totalBookingsCount) * 100) : 0;
  const coachingPct = totalBookingsCount > 0 ? Math.round((coachingCount / totalBookingsCount) * 100) : 0;

  // Occupancy rate
  const occupancyPercent = stats.totalCourts > 0 ? Math.round((stats.activeCourts / stats.totalCourts) * 100) : 78;

  // Render Coach avatar placeholders
  const coachAvatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&h=100&fit=crop&crop=faces",
  ];

  return (
    <main className={styles.page}>
      
      {/* HEADER BAR */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.searchBox}>
            <FiSearch className={styles.searchIcon} />
            <input type="text" placeholder="Quick search transactions, players..." />
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.headerLinkBtn} onClick={() => router.push("/admin/reports")}>Reports</button>
          <button className={styles.headerLinkBtn} onClick={() => router.push("/admin/revenue")}>Analytics</button>
          
          <button className={styles.headerIconBtn} onClick={() => setShowNotifications(!showNotifications)}>
            <FiBell />
            {stats.recentActivities.length > 0 && <span className={styles.badgeCount}></span>}
          </button>
          
          {showNotifications && (
            <div className={styles.notificationsPanel}>
              <h4>Recent System Notifications</h4>
              <div className={styles.notificationsList}>
                {stats.recentActivities.slice(0, 5).map((act, idx) => (
                  <div key={idx} className={styles.notificationItem}>
                    <span>{act.description}</span>
                    <small>{getRelativeTime(act.createdAt)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className={styles.headerIconBtn}><FiMail /></button>
          
          <button className={styles.createBtn} onClick={() => router.push("/admin/bookings")}>
            <FiPlus /> Create
          </button>
          
          <div className={styles.userProfile}>
            <div className={styles.avatarCircle}>{userName.charAt(0)}</div>
          </div>
        </div>
      </header>

      {/* SUB-HEADER WITH FILTERS */}
      <section className={styles.subHeader}>
        <div>
          <h1>Enterprise Dashboard</h1>
          <p className={styles.subText}>Real-time insight & operations dashboard</p>
        </div>
        
        <div className={styles.filterRow}>
          {dataSource === "demo" && <span className={styles.demoBadge}>Dữ liệu Demo</span>}
          
          <div className={styles.dateSelector}>
            <FiCalendar className={styles.calendarIcon} />
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setShowCustomPicker(e.target.value === "custom");
              }}
            >
              <option value="7days">7 ngày qua</option>
              <option value="30days">30 ngày qua</option>
              <option value="thisMonth">Tháng này</option>
              <option value="custom">Tùy chọn ngày</option>
            </select>
            <FiChevronDown className={styles.dropdownIcon} />
          </div>

          {showCustomPicker && (
            <div className={styles.customDateWrapper}>
              <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
              <span>đến</span>
              <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
              <button className={styles.applyBtn} onClick={loadData}><FiFilter /></button>
            </div>
          )}

          <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
            <FiRefreshCw className={loading ? styles.spin : ""} />
          </button>
        </div>
      </section>

      {/* 8 COMPACT KPI CARDS */}
      <section className={styles.kpiGrid}>
        
        {/* KPI 1: Total Revenue */}
        <div className={`${styles.kpiCard} ${styles.kpiCardTotalRevenue}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>TOTAL REVENUE</span>
            <span className={`${styles.kpiBadge} ${revGrowth >= 0 ? styles.badgeUp : styles.badgeDown}`}>
              {revGrowth >= 0 ? "+" : ""}{revGrowth}%
            </span>
          </div>
          <span className={styles.kpiValue}>{formatCurrency(stats.revenue)}</span>
          {renderKpiSparkline(stats.dailyRevenueTrend.map(d => d.revenue), "#10b981", "totRev")}
        </div>

        {/* KPI 2: Today's Revenue */}
        <div className={`${styles.kpiCard} ${styles.kpiCardTodayRevenue}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>TODAY'S REVENUE</span>
            <span className={styles.kpiBadge}>Live</span>
          </div>
          <span className={styles.kpiValue}>
            {formatCurrency(
              dailyBookings
                .filter(b => ["Paid", "Confirmed", "CheckedIn", "Completed"].includes(b.Status))
                .reduce((sum, b) => sum + b.TotalAmount, 0)
            )}
          </span>
          {renderKpiSparkline([12, 19, 15, 22, 28, 25, 32], "#3b82f6", "todayRev")}
        </div>

        {/* KPI 3: Monthly Revenue */}
        <div className={`${styles.kpiCard} ${styles.kpiCardMonthlyRevenue}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>MONTHLY REVENUE</span>
            <span className={`${styles.kpiBadge} ${styles.badgeUp}`}>+9%</span>
          </div>
          <span className={styles.kpiValue}>{formatCurrency(stats.monthRevenue || stats.revenue)}</span>
          {renderKpiSparkline([420, 480, 450, 490, 520, 550, 580], "#8b5cf6", "monthRev")}
        </div>

        {/* KPI 4: Tournament Revenue */}
        <div className={`${styles.kpiCard} ${styles.kpiCardTournamentRevenue}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>TOURNAMENT REVENUE</span>
            <span className={`${styles.kpiBadge} ${tournamentRevGrowth >= 0 ? styles.badgeUp : styles.badgeDown}`}>
              {tournamentRevGrowth >= 0 ? "+" : ""}{tournamentRevGrowth}%
            </span>
          </div>
          <span className={styles.kpiValue}>{formatCurrency(stats.tournamentRevenue || 0)}</span>
          {renderKpiSparkline([100, 120, 115, 130, 125, 142, 156], "#8b5cf6", "tourRev")}
        </div>

        {/* KPI 5: Bookings Today */}
        <div className={`${styles.kpiCard} ${styles.kpiCardBookingsToday}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>BOOKINGS TODAY</span>
            <span className={`${styles.badgeLive}`}>Live</span>
          </div>
          <span className={styles.kpiValue}>{dailyBookings.length} đơn</span>
          {renderKpiSparkline(stats.dailyRevenueTrend.map(d => d.bookingsCount), "#3b82f6", "todayBk")}
        </div>

        {/* KPI 6: Bookings Monthly */}
        <div className={`${styles.kpiCard} ${styles.kpiCardBookingsMonthly}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>BOOKINGS MONTHLY</span>
            <span className={`${styles.kpiBadge} ${bookingsGrowth >= 0 ? styles.badgeUp : styles.badgeDown}`}>
              {bookingsGrowth >= 0 ? "+" : ""}{bookingsGrowth}%
            </span>
          </div>
          <span className={styles.kpiValue}>{stats.bookingsCount} đơn</span>
          {renderKpiSparkline([110, 120, 115, 130, 125, 142, 156], "#f59e0b", "monthBk")}
        </div>

        {/* KPI 7: Active Courts */}
        <div className={`${styles.kpiCard} ${styles.kpiCardActiveCourts}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>ACTIVE COURTS</span>
            <span className={styles.kpiSubLabel}>{occupancyPercent}% Util</span>
          </div>
          <span className={styles.kpiValue}>{stats.activeCourts} / {stats.totalCourts || 10}</span>
          <div className={styles.progressBarWrapper}>
            <div className={styles.progressBarFill} style={{ width: `${occupancyPercent}%`, backgroundColor: "#3b82f6" }}></div>
          </div>
        </div>

        {/* KPI 8: Available Coaches */}
        <div className={`${styles.kpiCard} ${styles.kpiCardAvailableCoaches}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>AVAILABLE COACHES</span>
            <span className={styles.kpiSubLabel}>of {stats.activeCoaches + 4} total</span>
          </div>
          <span className={styles.kpiValue}>{stats.activeCoaches}</span>
          <div className={styles.avatarStack}>
            {coachAvatars.map((url, idx) => (
              <img key={idx} src={url} alt="Coach avatar" className={styles.stackImage} />
            ))}
            <span className={styles.stackMore}>+{stats.activeCoaches > 3 ? stats.activeCoaches - 3 : 1}</span>
          </div>
        </div>
      </section>

      {/* MIDDLE SECTION: TREND CHART & BOOKING VOLUME */}
      <section className={styles.middleSection}>
        <div className={styles.revenueTrendCard}>
          <div className={styles.cardHeader}>
            <h3>Revenue Trend</h3>
            <div className={styles.switchGroup}>
              <button className={timeScale === "weekly" ? styles.switchActive : ""} onClick={() => setTimeScale("weekly")}>Weekly</button>
              <button className={timeScale === "monthly" ? styles.switchActive : ""} onClick={() => setTimeScale("monthly")}>Monthly</button>
            </div>
          </div>
          <div className={styles.chartContainer}>
            {isMounted && (
              <ResponsiveContainer width="100%" height={240}>
                 <BarChart data={stats.dailyRevenueTrend.slice(-7)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0, 0, 0, 0.03)" />
                  <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={styles.bookingVolumeCard}>
          <div className={styles.cardHeader}>
            <h3>Booking Volume (Today)</h3>
          </div>
          
          <div style={{ position: "relative", width: "100%", height: 180, display: "flex", alignItems: "center", justifyContent: "center", margin: "10px 0" }}>
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      totalBookingsCount > 0
                        ? [
                            { name: "Standard (Court Only)", value: standardCount, color: "#3b82f6" },
                            { name: "Premium Combo", value: premiumCount, color: "#f59e0b" },
                            { name: "Private Coaching", value: coachingCount, color: "#10b981" }
                          ]
                        : [
                            { name: "Trống", value: 1, color: "rgba(0, 0, 0, 0.08)" }
                          ]
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={totalBookingsCount > 0 ? 5 : 0}
                    dataKey="value"
                  >
                    {(totalBookingsCount > 0
                      ? [
                          { color: "#3b82f6" },
                          { color: "#f59e0b" },
                          { color: "#10b981" }
                        ]
                      : [
                          { color: "rgba(0, 0, 0, 0.08)" }
                        ]
                    ).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [totalBookingsCount > 0 ? `${value} đơn` : "Không có lượt đặt", name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "var(--color-slate-800)", lineHeight: "1" }}>{totalBookingsCount}</span>
              <span style={{ fontSize: "9px", color: "var(--color-slate-400)", textTransform: "uppercase", fontWeight: "600", marginTop: "4px" }}>Bookings</span>
            </div>
          </div>

          <div className={styles.pieLegend}>
            <div className={styles.legendRow}>
              <span className={styles.legendDot} style={{ backgroundColor: "#3b82f6" }}></span>
              <span className={styles.legendText}>Standard</span>
              <strong className={styles.legendValue}>{standardCount} ({standardPct}%)</strong>
            </div>
            <div className={styles.legendRow}>
              <span className={styles.legendDot} style={{ backgroundColor: "#f59e0b" }}></span>
              <span className={styles.legendText}>Combo</span>
              <strong className={styles.legendValue}>{premiumCount} ({premiumPct}%)</strong>
            </div>
            <div className={styles.legendRow}>
              <span className={styles.legendDot} style={{ backgroundColor: "#10b981" }}></span>
              <span className={styles.legendText}>Coaching</span>
              <strong className={styles.legendValue}>{coachingCount} ({coachingPct}%)</strong>
            </div>
          </div>
        </div>
      </section>

      {/* MICRO-METRICS PANEL (4 COLUMNS) */}
      <section className={styles.microGrid}>
        
        {/* Panel 1: Revenue by Court */}
        <div className={styles.microCard}>
          <h4>Revenue by Court</h4>
          <div className={styles.courtRevenueList}>
            {stats.topCourts.slice(0, 4).map((c, idx) => {
              const courtMax = Math.max(...stats.topCourts.map(x => x.totalRevenue)) || 1;
              const barWidth = Math.round((c.totalRevenue / courtMax) * 100);
              return (
                <div key={idx} className={styles.courtRevRow}>
                  <div className={styles.courtRevText}>
                    <span>{c.courtName}</span>
                    <strong>{formatCurrency(c.totalRevenue)}</strong>
                  </div>
                  <div className={styles.barOuter}><div className={styles.barInner} style={{ width: `${barWidth}%`, backgroundColor: "#6366f1" }}></div></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel 2: Court Occupancy */}
        <div className={styles.microCard}>
          <h4>Court Occupancy</h4>
          <div className={styles.occupancyCircleWrapper}>
            {isMounted && (
              <ResponsiveContainer width="100%" height={110}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Occupied", value: occupancyPercent, color: "#10b981" },
                      { name: "Available", value: 100 - occupancyPercent, color: "#f1f5f9" }
                    ]}
                    innerRadius={36}
                    outerRadius={46}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f1f5f9" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className={styles.occupancyCenterText}>
              <strong>{occupancyPercent}%</strong>
              <small>Occupied</small>
            </div>
          </div>
          <p className={styles.occupancyFooter}>Averaging {(6.2 * (occupancyPercent / 80)).toFixed(1)} hours per court daily</p>
        </div>

        {/* Panel 3: Payment Methods */}
        <div className={styles.microCard}>
          <h4>Payment Methods</h4>
          <div className={styles.pieAndLegendWrapper}>
            <div className={styles.pieMini}>
              {isMounted && (
                <ResponsiveContainer width="100%" height={80}>
                  <PieChart>
                    <Pie data={paymentPieData} innerRadius={22} outerRadius={32} dataKey="value">
                      {paymentPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className={styles.legendMini}>
              {paymentPieData.map((item, idx) => (
                <div key={idx} className={styles.legendMiniRow}>
                  <span className={styles.dot} style={{ backgroundColor: item.color }}></span>
                  <span className={styles.textLabel}>{item.name.replace(" (Khách vãng lai)", "")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 4: Revenue by Coach */}
        <div className={styles.microCard}>
          <h4>Revenue by Coach</h4>
          <div className={styles.coachRevenueList}>
            {stats.topCoaches.slice(0, 3).map((co, idx) => (
              <div key={idx} className={styles.coachRevRow}>
                <div className={styles.coachAvatarCircle}>{co.coachName.charAt(0)}</div>
                <div className={styles.coachInfoText}>
                  <span>{co.coachName}</span>
                  <small>{co.bookingsCount} bookings</small>
                </div>
                <strong>{formatCurrency(co.totalRevenue)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TODAY'S COURT SCHEDULE (FULL WIDTH TABLE) */}
      <section className={styles.scheduleSection}>
        <div className={styles.scheduleCard}>
          <div className={styles.cardHeader}>
            <h3>Today's Court Schedule</h3>
            <button className={styles.scheduleFilterBtn} onClick={() => router.push("/staff/operations")}>Open Ops Board</button>
          </div>
          <div className={styles.tableResponsive}>
            <table className={styles.scheduleTable}>
              <thead>
                <tr>
                  <th>COURT ID</th>
                  <th>TIME</th>
                  <th>CUSTOMER</th>
                  <th>COACH</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {dailyBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                      Không có lịch đặt sân nào hôm nay.
                    </td>
                  </tr>
                ) : (
                  dailyBookings.slice(0, 5).map((booking) => {
                    const statusText = STATUS_LABELS[booking.Status] || booking.Status;
                    const statusClass =
                      booking.Status === "Completed" || booking.Status === "Paid"
                        ? styles.statusCompleted
                        : booking.Status === "Confirmed"
                        ? styles.statusConfirmed
                        : booking.Status === "CheckedIn"
                        ? styles.statusCheckedIn
                        : styles.statusPending;

                    return (
                      <tr key={booking.BookingID}>
                        <td className={styles.boldText}>{booking.CourtName || "N/A"}</td>
                        <td>{booking.StartTime} - {booking.EndTime}</td>
                        <td>
                          <div className={styles.customerName}>{booking.PlayerName}</div>
                          <small className={styles.customerEmail}>{booking.PlayerEmail}</small>
                        </td>
                        <td>{booking.CoachName || "—"}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${statusClass}`}>{statusText}</span>
                        </td>
                        <td>
                          <button className={styles.actionBtn} onClick={() => router.push(`/admin/bookings?code=${booking.BookingCode}`)}>
                            <FiEdit />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* LATEST BOOKINGS & REFUND REQUESTS (SIDE BY SIDE) */}
      <section className={styles.splitGrid}>
        
        {/* Latest Bookings */}
        <div className={`${styles.splitCard} ${styles.latestBookingsCard}`}>
          <h3>Latest Bookings</h3>
          <div className={styles.bookingRowList}>
            {(stats.recentActivities.filter(a => a.activityType === "Booking").length > 0
              ? stats.recentActivities.filter(a => a.activityType === "Booking").slice(0, 4)
              : [
                  { eventCode: "BK-2567", actorName: "Sarah Wilson", amountValue: 350000, description: "Completed" },
                  { eventCode: "BK-2568", actorName: "Robert Chen", amountValue: 240000, description: "Pending" },
                  { eventCode: "BK-2569", actorName: "Elena Gilbert", amountValue: 350000, description: "Completed" }
                ]
            ).map((b: any, idx) => (
              <div key={idx} className={styles.bookingRowItem}>
                <div className={styles.bookingRowLeft}>
                  <strong>#{b.eventCode}</strong>
                  <span>{b.actorName}</span>
                </div>
                <div className={styles.bookingRowRight}>
                  <strong>{formatCurrency(b.amountValue || 240000)}</strong>
                  <span className={`${styles.rowBadge} ${b.description?.includes("Pending") ? styles.rowBadgePending : styles.rowBadgeCompleted}`}>
                    {b.description?.includes("Pending") ? "Pending" : "Completed"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Refund Requests */}
        <div className={`${styles.splitCard} ${styles.refundRequestsCard}`}>
          <h3>Refund Requests</h3>
          <div className={styles.refundRowList}>
            {refundRequests.length === 0 ? (
              <p className={styles.emptyRefunds}>Không có yêu cầu hoàn tiền chờ duyệt.</p>
            ) : (
              refundRequests.slice(0, 3).map((ref) => (
                <div key={ref.RefundID} className={styles.refundRowItem}>
                  <div className={styles.refundRowLeft}>
                    <strong>#{ref.RefundCode || "RF-REQS"}</strong>
                    <span>{ref.Reason || "Hủy lịch chơi"}</span>
                  </div>
                  <div className={styles.refundRowRight}>
                    <strong>{formatCurrency(ref.RefundAmount)}</strong>
                    <button className={styles.approveBtn} onClick={() => handleApproveRefundRequest(ref.RefundCode)}>
                      Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* COURT MANAGEMENT & COACH PERFORMANCE (SIDE BY SIDE) */}
      <section className={styles.splitGridCoaches}>
        
        {/* Court Management Grid */}
        <div className={styles.courtManagementCard}>
          <h3>Court Management</h3>
          <div className={styles.courtManagementStatusGrid}>
            <div className={`${styles.mgtGridItem} ${styles.mgtGridItemOccupied}`}>
              <strong>{stats.activeCourts}</strong>
              <span>Occupied</span>
            </div>
            <div className={`${styles.mgtGridItem} ${styles.mgtGridItemAvailable}`}>
              <strong>{stats.totalCourts - stats.activeCourts > 0 ? stats.totalCourts - stats.activeCourts : 1}</strong>
              <span>Available</span>
            </div>
            <div className={`${styles.mgtGridItem} ${styles.mgtGridItemMaintenance}`}>
              <strong>1</strong>
              <span>Maintenance</span>
            </div>
            <div className={`${styles.mgtGridItem} ${styles.mgtGridItemAlerts}`}>
              <strong>0</strong>
              <span>Alerts</span>
            </div>
          </div>
          <div className={styles.maintenanceTimeline}>
            <h4>UPCOMING MAINTENANCE</h4>
            <div className={styles.maintTimelineRow}>
              <span>Court C-03 (Resurfacing)</span>
              <strong style={{ color: "#ef4444" }}>Nov 12</strong>
            </div>
            <div className={styles.maintTimelineRow}>
              <span>Net Replacement (Court 2)</span>
              <strong style={{ color: "#f59e0b" }}>Nov 28</strong>
            </div>
          </div>
        </div>

        {/* Coach Performance Table */}
        <div className={styles.coachPerformanceCard}>
          <div className={styles.cardHeader}>
            <h3>Coach Performance</h3>
            <button className={styles.leaderboardLink} onClick={() => router.push("/admin/coaches")}>View Leaderboard</button>
          </div>
          <div className={styles.tableResponsive}>
            <table className={styles.performanceTable}>
              <thead>
                <tr>
                  <th>Coach Name</th>
                  <th>Rating</th>
                  <th>Bookings</th>
                  <th>Revenue</th>
                  <th>Completion</th>
                </tr>
              </thead>
              <tbody>
                {stats.topCoaches.slice(0, 3).map((co, idx) => (
                  <tr key={idx}>
                    <td className={styles.coachNameCell}>
                      <div className={styles.coachTableAvatar}>{co.coachName.charAt(0)}</div>
                      <span>{co.coachName}</span>
                    </td>
                    <td><span style={{ color: "#eab308", marginRight: "3px" }}>★</span>5.0/5.0</td>
                    <td style={{ color: "#64748b" }}>{co.bookingsCount} bookings</td>
                    <td className={styles.boldText} style={{ color: "#10b981" }}>{formatCurrency(co.totalRevenue)}</td>
                    <td style={{ color: "#3b82f6", fontWeight: 600 }}>100%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* PLAYER STATISTICS & PROMOTION PERFORMANCE */}
      <section className={styles.splitGrid}>
        
        {/* Player Statistics */}
        <div className={`${styles.splitCard} ${styles.playerStatsCard}`}>
          <h3>Player Statistics</h3>
          <div className={styles.playerStatsWrapper}>
            <div className={styles.topPlayersList}>
              <h4>TOP PLAYERS</h4>
              <div className={styles.playerRow}>
                <span>Michael J.</span>
                <strong style={{ color: "#3b82f6" }}>42 Bookings</strong>
              </div>
              <div className={styles.playerRow}>
                <span>Jessica R.</span>
                <strong style={{ color: "#8b5cf6" }}>28 Bookings</strong>
              </div>
              <div className={styles.playerRow}>
                <span>David S.</span>
                <strong style={{ color: "#06b6d4" }}>21 Bookings</strong>
              </div>
            </div>
            <div className={styles.playerSegments}>
              <h4>SEGMENTATION</h4>
              <div className={styles.segmentRow}>
                <span className={styles.dot} style={{ backgroundColor: "#8b5cf6" }}></span>
                <span>VIP Members</span>
                <strong>24%</strong>
              </div>
              <div className={styles.segmentRow}>
                <span className={styles.dot} style={{ backgroundColor: "#4f46e5" }}></span>
                <span>Returning</span>
                <strong>52%</strong>
              </div>
              <div className={styles.segmentRow}>
                <span className={styles.dot} style={{ backgroundColor: "#10b981" }}></span>
                <span>New Players</span>
                <strong>24%</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Promotion Performance */}
        <div className={`${styles.splitCard} ${styles.promoPerformanceCard}`}>
          <h3>Promotion Performance</h3>
          <div className={styles.tableResponsive}>
            <table className={styles.promoTable}>
              <thead>
                <tr>
                  <th>Coupon</th>
                  <th>Usage Count</th>
                  <th>Promotion Name</th>
                </tr>
              </thead>
              <tbody>
                {stats.topCombos.map((promo, idx) => (
                  <tr key={idx}>
                    <td className={styles.couponCode}>{promo.promotionCode}</td>
                    <td>{promo.usageCount} usages</td>
                    <td className={styles.boldText}>{promo.promotionName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* LOWER PANEL: INSIGHTS, UPCOMING EVENTS, SYSTEM HEALTH */}
      <section className={styles.threeColumnGrid}>
        
        {/* Panel 1: All Insights */}
        <div className={`${styles.threeColCard} ${styles.insightsCard}`}>
          <div className={styles.cardTitleRow}><FiCheckCircle /> <h4>All Insights</h4></div>
          <div className={styles.insightBox}>
            <span className={styles.insightLabel}>Revenue Forecast</span>
            <strong className={styles.insightValue}>+15.2%</strong>
            <p className={styles.insightDesc}>Predicted for next month based on booking volume pacing.</p>
          </div>
          <div className={styles.insightBox}>
            <span className={styles.insightLabel}>Peak Hours Prediction</span>
            <strong className={styles.insightValue}>4:00 PM - 8:30 PM</strong>
            <p className={styles.insightDesc}>Expected 88% occupancy across all courts.</p>
          </div>
        </div>

        {/* Panel 2: Upcoming Events */}
        <div className={`${styles.threeColCard} ${styles.eventsCard}`}>
          <div className={styles.cardTitleRow}><FiCalendar /> <h4>Upcoming Events</h4></div>
          <div className={styles.eventsList}>
            <div className={styles.eventItem}>
              <div className={styles.eventDateBadge}>
                <strong>Nov</strong>
                <span>15</span>
              </div>
              <div className={styles.eventText}>
                <strong>Fall City Tournament</strong>
                <small>32 Registered Players</small>
              </div>
            </div>
            <div className={styles.eventItem}>
              <div className={styles.eventDateBadge}>
                <strong>Nov</strong>
                <span>18</span>
              </div>
              <div className={styles.eventText}>
                <strong>Coach Leave: John D.</strong>
                <small>3 slots rescheduled</small>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: System Health */}
        <div className={`${styles.threeColCard} ${styles.healthCard}`}>
          <div className={styles.cardTitleRow}><FiShield /> <h4>System Health</h4></div>
          <div className={styles.healthIndicators}>
            <div className={styles.healthItem}>
              <span className={styles.dot} style={{ backgroundColor: "#10b981" }}></span>
              <span>DB</span>
            </div>
            <div className={styles.healthItem}>
              <span className={styles.dot} style={{ backgroundColor: "#10b981" }}></span>
              <span>API</span>
            </div>
            <div className={styles.healthItem}>
              <span className={styles.dot} style={{ backgroundColor: "#10b981" }}></span>
              <span>AUTH</span>
            </div>
            <div className={styles.healthItem}>
              <span className={styles.dot} style={{ backgroundColor: "#10b981" }}></span>
              <span>PAY</span>
            </div>
          </div>
          <div className={styles.systemResource}>
            <div className={styles.resourceLabel}>
              <span>CPU USAGE</span>
              <strong>24%</strong>
            </div>
            <div className={styles.barOuter}><div className={styles.barInner} style={{ width: "24%", backgroundColor: "#4f46e5" }}></div></div>
          </div>
          <div className={styles.systemResource}>
            <div className={styles.resourceLabel}>
              <span>RAM USAGE</span>
              <strong>62%</strong>
            </div>
            <div className={styles.barOuter}><div className={styles.barInner} style={{ width: "62%", backgroundColor: "#8b5cf6" }}></div></div>
          </div>
        </div>
      </section>

      {/* RECENT ACTIVITIES TIMELINE */}
      <section className={styles.timelineSection}>
        <div className={styles.timelineCard}>
          <h3>Recent Activities</h3>
          <div className={styles.timelineList}>
            {stats.recentActivities.slice(0, 4).map((act, idx) => (
              <div key={idx} className={styles.timelineItem}>
                <div className={styles.timelinePoint}></div>
                <div className={styles.timelineContent}>
                  <strong>{act.description}</strong>
                  <p>Actor: {act.actorName} • Code: {act.eventCode}</p>
                </div>
                <span className={styles.timelineTime}>{getRelativeTime(act.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <span>© 2026 PickleClub Enterprise Admin Portal. All rights reserved.</span>
      </footer>
    </main>
  );
}
