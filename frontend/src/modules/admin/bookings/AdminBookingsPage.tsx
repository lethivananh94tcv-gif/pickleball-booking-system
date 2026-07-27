"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDailyBookings, checkInBooking, cancelBooking } from "@/services/bookingApi";
import type { DailyBooking } from "@/services/bookingApi";
import { getToken, getUser } from "@/utils/authStorage";
import StateBox from "@/components/common/StateBox";
import { formatCurrency } from "@/utils/formatCurrency";
import styles from "./AdminBookingsPage.module.css";

// Dùng locale sv-SE để có format YYYY-MM-DD theo múi giờ VN
function todayStr() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

// ── Status & Styles Mapping ──────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PendingPayment: "Chờ thanh toán",
  Paid: "Đã thanh toán",
  Confirmed: "Chờ check-in",
  CheckedIn: "Đang sử dụng",
  Completed: "Hoàn thành",
  Cancelled: "Đã hủy",
  Refunded: "Đã hoàn tiền",
  NoShow: "Vắng mặt",
};

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Paid: styles.badgeSuccess,
    Confirmed: styles.badgeWarning,
    CheckedIn: styles.badgeCheckedIn,
    Completed: styles.badgeCompleted,
    PendingPayment: styles.badgeWarning,
    Cancelled: styles.badgeError,
    Refunded: styles.badgeError,
    NoShow: styles.badgeError,
  };
  return (
    <span className={`${styles.badge} ${cls[status] ?? styles.badgeDefault}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ── StatCard component with Sparkline SVG ────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  sparklinePath: string;
  sparklineStroke: string;
  sparklineColor: string;
}

function StatCard({
  icon,
  label,
  value,
  color,
  sparklinePath,
  sparklineStroke,
  sparklineColor,
}: StatCardProps) {
  const gradientId = `spark-grad-booking-${color}`;
  
  const renderValue = (val: string | number) => {
    const valStr = String(val);
    if (valStr.includes("/")) {
      const parts = valStr.split("/");
      return (
        <span>
          {parts[0].trim()}
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", marginLeft: "2px" }}>
            /{parts[1].trim()}
          </span>
        </span>
      );
    }
    return valStr;
  };

  return (
    <div className={`${styles.statCard} ${styles[`stat_${color}`]}`}>
      <div className={styles.statHeader}>
        <div className={styles.statIconBox}>{icon}</div>
      </div>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{renderValue(value)}</span>

      {/* Mini sparkline visualization at the bottom */}
      <div className={styles.sparklineWrap}>
        <svg className={styles.sparkline} viewBox="0 0 100 30" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sparklineColor} stopOpacity="0.05"/>
              <stop offset="100%" stopColor={sparklineColor} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={sparklinePath} fill={`url(#${gradientId})`} />
          <path d={sparklineStroke} fill="none" stroke={sparklineColor} strokeWidth="1.2" />
        </svg>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export default function AdminBookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());
  const [bookings, setBookings] = useState<DailyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<string>("Tất cả");

  // Real-time search query
  const [searchQuery, setSearchQuery] = useState("");

  // Credentials for avatar initials
  const [userName, setUserName] = useState("Admin");
  const [userEmail, setUserEmail] = useState("");

  // Verify Role and Fetch Data
  useEffect(() => {
    const userToken = getToken();
    const user = getUser();
    const role = String(
      user?.RoleName || user?.role || user?.roles?.[0] || ""
    ).toLowerCase();

    if (!userToken || (!role.includes("admin") && !role.includes("staff"))) {
      router.push("/login");
      return;
    }

    setToken(userToken);
    if (user) {
      setUserName(user.FullName || user.fullName || "Admin");
      setUserEmail(user.Email || user.email || "admin@pickleclub.vn");
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      loadBookings();
    }
  }, [token, date]);

  useEffect(() => {
    const query = searchParams.get("search") || searchParams.get("code") || "";
    if (query) {
      setSearchQuery(query);
    }
  }, [searchParams]);

  async function loadBookings(silent = false) {
    if (!token) return;
    try {
      if (!silent) setLoading(true);
      setError("");
      const data = await getDailyBookings(token, date);
      setBookings(data);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách booking.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Confirm modal state
  const [confirm, setConfirm] = useState<{
    booking: DailyBooking;
    type: "checkin" | "cancel";
  } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  function openConfirm(booking: DailyBooking, type: "checkin" | "cancel") {
    setConfirm({ booking, type });
    setCancelReason("");
    setConfirmError("");
  }

  async function submitConfirm() {
    if (!confirm || !token) return;
    const { booking, type } = confirm;
    
    if (type === "cancel" && !cancelReason.trim()) {
      setConfirmError("Vui lòng nhập lý do hủy.");
      return;
    }
    
    setConfirmLoading(true);
    setConfirmError("");
    try {
      setActioningId(booking.BookingID);
      if (type === "checkin") {
        await checkInBooking(token, booking.BookingID);
      } else if (type === "cancel") {
        await cancelBooking(token, booking.BookingID, cancelReason.trim());
      }
      setConfirm(null);
      await loadBookings(true);
    } catch (err: any) {
      setConfirmError(err.message || "Thao tác thất bại. Vui lòng thử lại.");
    } finally {
      setConfirmLoading(false);
      setActioningId(null);
    }
  }

  // Derived filtered bookings based on court selector AND search query
  const filteredBookings = useMemo(() => {
    let result = bookings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b =>
        (b.BookingCode || "").toLowerCase().includes(q) ||
        (b.PlayerName || "").toLowerCase().includes(q) ||
        (b.PlayerPhone || "").toLowerCase().includes(q) ||
        (b.PlayerEmail || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [bookings, searchQuery]);

  // Derived counts for StatsCards
  const counts = useMemo(() => {
    const total = bookings.length;
    const waitingCheckIn = bookings.filter(b => ["Confirmed", "Paid"].includes(b.Status)).length;
    const checkedIn = bookings.filter(b => b.Status === "CheckedIn").length;
    const completed = bookings.filter(b => b.Status === "Completed").length;
    const cancelled = bookings.filter(b => ["Cancelled", "Refunded", "NoShow"].includes(b.Status)).length;
    return { total, waitingCheckIn, checkedIn, completed, cancelled };
  }, [bookings]);

  // Group by court
  const groupedBookings = useMemo(() => {
    const groups: Record<string, DailyBooking[]> = {};
    filteredBookings.forEach((b) => {
      const courtName = b.CourtName || "Khu vực HLV";
      if (!groups[courtName]) {
        groups[courtName] = [];
      }
      groups[courtName].push(b);
    });
    return groups;
  }, [filteredBookings]);

  // Extract initials safely
  const userInitials = useMemo(() => {
    const parts = userName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "AD";
    return parts.map(n => n[0]).join("").slice(0, 2).toUpperCase();
  }, [userName]);

  return (
    <div className={styles.wrapper}>
      {/* ── Sticky Top Header Bar ── */}
      <header className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumbs}>
            <span>Quản trị</span>
            <span className={styles.chevron}>/</span>
            <span className={styles.currentCrumb}>Quản lý Booking</span>
          </div>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.searchBar}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Tìm mã booking, tên khách, số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.headerRight}>
          {/* Date Picker */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={styles.datePicker}
          />

          {/* Refresh Page */}
          <button className={styles.btnIcon} onClick={() => loadBookings(false)} title="Tải lại dữ liệu">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>

          {/* User Initials Avatar */}
          <div className={styles.avatar} title={`${userName} (${userEmail})`}>
            {userInitials}
          </div>
        </div>
      </header>

      {/* ── Main content area with gray background ── */}
      <div className={styles.contentArea}>
        
        {/* Stat Grid with SVG Sparklines */}
        <div className={styles.statGrid}>
          <StatCard
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
            }
            label="Tổng Booking"
            value={counts.total}
            color="blue"
            sparklinePath="M0,25 C20,15 40,28 60,18 C80,8 90,22 100,12 L100,30 L0,30 Z"
            sparklineStroke="M0,25 C20,15 40,28 60,18 C80,8 90,22 100,12"
            sparklineColor="#2563eb"
          />

          <StatCard
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
            }
            label="Chờ Check-in"
            value={counts.waitingCheckIn}
            color="orange"
            sparklinePath="M0,20 C15,10 30,25 45,15 C60,5 75,25 90,18 L100,22 L100,30 L0,30 Z"
            sparklineStroke="M0,20 C15,10 30,25 45,15 C60,5 75,25 90,18 L100,22"
            sparklineColor="#ea580c"
          />

          <StatCard
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M12 3v18M2 12h20" />
              </svg>
            }
            label="Đang sử dụng"
            value={counts.checkedIn}
            color="purple"
            sparklinePath="M0,22 C15,12 30,28 45,18 C60,8 75,28 90,20 L100,25 L100,30 L0,30 Z"
            sparklineStroke="M0,22 C15,12 30,28 45,18 C60,8 75,28 90,20 L100,25"
            sparklineColor="#8b5cf6"
          />

          <StatCard
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
            }
            label="Hoàn thành"
            value={counts.completed}
            color="green"
            sparklinePath="M0,15 C20,10 40,25 60,15 C80,5 90,20 100,10 L100,30 L0,30 Z"
            sparklineStroke="M0,15 C20,10 40,25 60,15 C80,5 90,20 100,10"
            sparklineColor="#16a34a"
          />

          <StatCard
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
            }
            label="Đã hủy / Vắng"
            value={counts.cancelled}
            color="red"
            sparklinePath="M0,24 C15,18 30,28 45,22 C60,16 75,26 90,22 L100,26 L100,30 L0,30 Z"
            sparklineStroke="M0,24 C15,18 30,28 45,22 C60,16 75,26 90,22 L100,26"
            sparklineColor="#dc2626"
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 12px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ fontSize: "14px", fontWeight: 600 }}>Đang tải...</p>
          </div>
        ) : error ? (
          <StateBox variant="error" title="Lỗi tải dữ liệu" description={error} />
        ) : bookings.length === 0 ? (
          <StateBox
            variant="empty"
            title={`Không có booking nào ngày ${new Date(date).toLocaleDateString("vi-VN")}`}
            description="Hiện tại chưa có khách hàng nào đặt lịch vào ngày này."
          />
        ) : (
          <>
            {/* Court Selection Tabs */}
            <div className={styles.tabsContainer}>
              <button
                className={`${styles.tabBtn} ${selectedCourt === "Tất cả" ? styles.tabActive : ""}`}
                onClick={() => setSelectedCourt("Tất cả")}
              >
                Tất cả các sân
              </button>
              {Object.keys(groupedBookings).map((courtName) => (
                <button
                  key={courtName}
                  className={`${styles.tabBtn} ${selectedCourt === courtName ? styles.tabActive : ""}`}
                  onClick={() => setSelectedCourt(courtName)}
                >
                  {courtName}
                </button>
              ))}
            </div>

            {/* Bookings Lists by Court */}
            {Object.entries(groupedBookings)
              .filter(([courtName]) => selectedCourt === "Tất cả" || selectedCourt === courtName)
              .sort(([a], [b]) => {
                // Sắp xếp các sân theo booking mới nhất trong sân đó
                const aLatest = groupedBookings[a][0]?.CreatedAt ?? "";
                const bLatest = groupedBookings[b][0]?.CreatedAt ?? "";
                return bLatest > aLatest ? 1 : -1;
              })
              .map(([courtName, courtBookings]) => (
                <div key={courtName} className={styles.courtSection}>
                  <h2 className={styles.courtTitle}>{courtName}</h2>
                  <div className={styles.tablePanel}>
                    <div className={styles.tableResponsive}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Mã & Thời gian</th>
                            <th>Khách hàng</th>
                            <th>Dịch vụ</th>
                            <th>Thanh toán</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courtBookings.map((b) => {
                            const isActioning = actioningId === b.BookingID;
                            const canCheckIn = ["Confirmed", "Paid"].includes(b.Status);
                            const canCancel = ["PendingPayment", "Confirmed", "Paid"].includes(b.Status);

                            return (
                              <tr key={b.BookingID} className={isActioning ? styles.rowActioning : ""}>
                                {/* Mã & Giờ */}
                                <td style={{ padding: "14px 18px" }}>
                                  <div className={styles.bookingCode}>{b.BookingCode}</div>
                                  <div className={styles.bookingTime}>
                                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                                    </svg>
                                    {b.StartTime} - {b.EndTime}
                                  </div>
                                </td>

                                {/* Khách hàng */}
                                <td style={{ padding: "14px 18px" }}>
                                  <div className={styles.playerName}>{b.PlayerName}</div>
                                  <div className={styles.playerContact}>
                                    {b.PlayerPhone || b.PlayerEmail}
                                  </div>
                                </td>

                                {/* Dịch vụ */}
                                <td style={{ padding: "14px 18px" }}>
                                  {b.BookingType === "Court" || b.BookingType === "Combo" ? (
                                    <div className={styles.serviceItem}>
                                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                                      </svg>
                                      Sân {b.CourtName}
                                    </div>
                                  ) : null}
                                  {b.BookingType === "Coach" || b.BookingType === "Combo" ? (
                                    <div className={styles.serviceItem}>
                                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="8" r="4"/>
                                        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                                      </svg>
                                      HLV: {b.CoachName}
                                    </div>
                                  ) : null}
                                </td>

                                {/* Thanh toán */}
                                <td style={{ padding: "14px 18px" }}>
                                  <div className={styles.amount}>{formatCurrency(b.TotalAmount)}</div>
                                  {b.PaymentMethod && (
                                    <div className={styles.paymentMethod}>{b.PaymentMethod}</div>
                                  )}
                                </td>

                                {/* Trạng thái */}
                                <td style={{ padding: "14px 18px" }}>
                                  <StatusBadge status={b.Status} />
                                  {b.CheckInTime && (
                                    <div className={styles.checkInTime}>
                                      Lúc {new Date(b.CheckInTime).toLocaleTimeString("vi-VN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        timeZone: "Asia/Ho_Chi_Minh"
                                      })}
                                    </div>
                                  )}
                                </td>

                                {/* Thao tác */}
                                <td style={{ padding: "14px 18px" }}>
                                  <div className={styles.actionCell}>
                                    {canCheckIn && (
                                      <button
                                        onClick={() => openConfirm(b, "checkin")}
                                        disabled={isActioning}
                                        className={styles.btnCheckIn}
                                        title="Đánh dấu khách đã đến"
                                      >
                                        {isActioning ? "..." : "Check-in"}
                                      </button>
                                    )}
                                    {canCancel && (
                                      <button
                                        onClick={() => openConfirm(b, "cancel")}
                                        disabled={isActioning}
                                        className={styles.btnCancel}
                                        title="Hủy booking"
                                      >
                                        {isActioning ? "..." : "Hủy ca"}
                                      </button>
                                    )}
                                    {!canCheckIn && !canCancel && !["Cancelled", "Refunded"].includes(b.Status) && (
                                      <span className={styles.noAction}>—</span>
                                    )}
                                    {["Cancelled", "Refunded"].includes(b.Status) && (
                                      b.RefundCode ? (
                                        <button
                                          onClick={() => router.push(`/admin/refunds?search=${b.RefundCode}`)}
                                          className={styles.btnCheckIn}
                                          style={{ background: "#f8fafc", color: "#6366f1", border: "1px solid #c7d2fe", fontWeight: 700 }}
                                          title="Xem chi tiết hoàn tiền"
                                        >
                                          Hoàn {b.RefundCode}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => router.push(`/admin/refunds?search=${b.BookingCode}`)}
                                          className={styles.btnCheckIn}
                                          style={{ background: "#3b82f6", color: "white", border: "none" }}
                                          title="Chuyển đến trang Hoàn tiền"
                                        >
                                          Hoàn tiền
                                        </button>
                                      )
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
          </>
        )}
        {/* ── Confirm Modal ── */}
        {confirm && (
          <div className={styles.modalOverlay} onClick={() => setConfirm(null)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {confirm.type === "checkin" && "Xác nhận Check-in"}
                  {confirm.type === "cancel" && "Xác nhận Hủy ca"}
                </h3>
                <button className={styles.modalClose} onClick={() => setConfirm(null)} disabled={confirmLoading}>×</button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.bookingCard}>
                  <div className={styles.bookingCardCode}>{confirm.booking.BookingCode}</div>
                  <div className={styles.bookingCardName}>{confirm.booking.PlayerName}</div>
                  {confirm.booking.PlayerPhone && (
                    <div className={styles.bookingCardSub}>SĐT: {confirm.booking.PlayerPhone}</div>
                  )}
                  <div className={styles.bookingCardSub}>
                    Sân: {confirm.booking.CourtName ?? "Khu vực HLV"} &nbsp;·&nbsp; Giờ: {confirm.booking.StartTime.substring(0, 5)} – {confirm.booking.EndTime.substring(0, 5)}
                  </div>
                </div>

                {confirm.type === "checkin" && (
                  <div className={styles.infoBox}>
                    Khách đã đến nhận sân/HLV. Xác nhận check-in để bắt đầu tính giờ chơi.
                  </div>
                )}

                {confirm.type === "cancel" && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Lý do hủy booking *</label>
                    <textarea
                      className={styles.formTextarea}
                      rows={3}
                      placeholder="Nhập lý do hủy tại đây..."
                      value={cancelReason}
                      onChange={e => { setCancelReason(e.target.value); setConfirmError(""); }}
                      disabled={confirmLoading}
                    />
                  </div>
                )}

                {confirmError && <div className={styles.modalError}>{confirmError}</div>}
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.btnCancelModal} onClick={() => setConfirm(null)} disabled={confirmLoading}>
                  Hủy
                </button>
                <button
                  className={confirm.type === "cancel" ? styles.btnDangerModal : styles.btnPrimaryModal}
                  onClick={submitConfirm}
                  disabled={confirmLoading}
                >
                  {confirmLoading ? "Đang xử lý..." : "Xác nhận"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
