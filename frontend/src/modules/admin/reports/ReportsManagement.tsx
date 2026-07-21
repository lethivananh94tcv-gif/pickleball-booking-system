"use client";

import { useReports } from "./hooks/useReports";
import ReportFilter from "./components/ReportFilter";
import ReportHistoryTable from "./components/ReportHistoryTable";
import styles from "./ReportsManagement.module.css";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ReportsManagement() {
  const {
    history,
    error,
    revenueStats,
    revenueRange,
    isExporting,
    isLoadingHistory,
    isLoadingRevenueStats,
    exportReport,
    loadHistory,
    loadRevenueStats,
  } = useReports();

  const successCount = history.filter((item) => item.status === "SUCCESS").length;
  const failedCount = history.filter((item) => item.status === "FAILED").length;
  const totalRows = history
    .filter((item) => item.status === "SUCCESS")
    .reduce((sum, item) => sum + (item.rowCount || 0), 0);
  const successRate = history.length > 0 ? Math.round((successCount / history.length) * 100) : 0;
  const totalCourtRevenue =
    revenueStats?.topCourts.reduce(
      (sum, court) => sum + court.totalRevenue,
      0
    ) || 0;
  const topCourts =
    revenueStats?.topCourts ?? [];
  const dailyRevenue =
    revenueStats?.dailyRevenueTrend ?? [];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (value: string) => {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return value;
  };

  return (
    <main className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.headerTitle}>Thống kê và xuất báo cáo</h1>
        </div>
        <p className={styles.headerSubtitle}>
          Lọc dữ liệu theo khoảng thời gian, xuất báo cáo CSV hoặc Excel và theo dõi lịch sử xuất báo cáo. 
          Tổng số lần xuất: <strong>{history.length}</strong>
        </p>
      </header>

      {/* Stats Grid */}
      <section className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.stat_blue}`}>
          <div className={styles.statHeader}>
            <div className={styles.statIconBox}><FileIcon /></div>
          </div>
          <p className={styles.statCardLabel}>Tổng số lần xuất</p>
          <h2 className={styles.statCardValue}>{history.length}</h2>
          <p className={styles.statCardDescription}>Tổng báo cáo đã tạo</p>
          <div className={styles.sparklineWrap}>
            <svg className={styles.sparkline} viewBox="0 0 100 30" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spark-grad-rep-1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.05"/>
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,20 C15,10 30,25 45,15 C60,5 75,25 90,18 L100,22 L100,30 L0,30 Z" fill="url(#spark-grad-rep-1)" />
              <path d="M0,20 C15,10 30,25 45,15 C60,5 75,25 90,18 L100,22" fill="none" stroke="#2563eb" strokeWidth="1.2" />
            </svg>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.stat_green}`}>
          <div className={styles.statHeader}>
            <div className={styles.statIconBox}><CheckIcon /></div>
          </div>
          <p className={styles.statCardLabel}>Xuất thành công</p>
          <h2 className={styles.statCardValue}>{successCount}</h2>
          <p className={styles.statCardDescription}>
            Báo cáo hoàn thành • {successRate}% thành công
          </p>
          <div className={styles.sparklineWrap}>
            <svg className={styles.sparkline} viewBox="0 0 100 30" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spark-grad-rep-2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity="0.05"/>
                  <stop offset="100%" stopColor="#16a34a" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,15 C20,10 40,25 60,15 C80,5 90,20 100,10 L100,30 L0,30 Z" fill="url(#spark-grad-rep-2)" />
              <path d="M0,15 C20,10 40,25 60,15 C80,5 90,20 100,10" fill="none" stroke="#16a34a" strokeWidth="1.2" />
            </svg>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.stat_red}`}>
          <div className={styles.statHeader}>
            <div className={styles.statIconBox}><XIcon /></div>
          </div>
          <p className={styles.statCardLabel}>Xuất thất bại</p>
          <h2 className={styles.statCardValue}>{failedCount}</h2>
          <p className={styles.statCardDescription}>Báo cáo gặp lỗi</p>
          <div className={styles.sparklineWrap}>
            <svg className={styles.sparkline} viewBox="0 0 100 30" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spark-grad-rep-3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.05"/>
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,22 C15,12 30,28 45,18 C60,8 75,28 90,20 L100,25 L100,30 L0,30 Z" fill="url(#spark-grad-rep-3)" />
              <path d="M0,22 C15,12 30,28 45,18 C60,8 75,28 90,20 L100,25" fill="none" stroke="#ef4444" strokeWidth="1.2" />
            </svg>
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.stat_purple}`}>
          <div className={styles.statHeader}>
            <div className={styles.statIconBox}><DatabaseIcon /></div>
          </div>
          <p className={styles.statCardLabel}>Tổng số dòng</p>
          <h2 className={styles.statCardValue}>{totalRows.toLocaleString()}</h2>
          <p className={styles.statCardDescription}>Dữ liệu đã xuất</p>
          <div className={styles.sparklineWrap}>
            <svg className={styles.sparkline} viewBox="0 0 100 30" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spark-grad-rep-4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.05"/>
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,25 C20,15 40,28 60,18 C80,8 90,22 100,12 L100,30 L0,30 Z" fill="url(#spark-grad-rep-4)" />
              <path d="M0,25 C20,15 40,28 60,18 C80,8 90,22 100,12" fill="none" stroke="#8b5cf6" strokeWidth="1.2" />
            </svg>
          </div>
        </div>
      </section>

      {/* Revenue Overview */}
      <section className={styles.revenueSection}>
        <div className={styles.revenueSectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Báo cáo doanh thu</p>
            <h2>Thống kê doanh thu 7 ngày gần nhất</h2>
            <span>
              {revenueRange.startDate} - {revenueRange.endDate}
            </span>
          </div>
          <button
            type="button"
            disabled={isLoadingRevenueStats}
            onClick={() => void loadRevenueStats()}
            className={styles.secondaryRefreshBtn}
          >
            <RefreshIcon spinning={isLoadingRevenueStats} />
            {isLoadingRevenueStats ? "Đang tải..." : "Làm mới"}
          </button>
        </div>

        <div className={styles.revenueKpiGrid}>
          <div className={`${styles.revenueKpiCard} ${styles.rev_green}`}>
            <div className={styles.revKpiHeader}>
              <p>Tổng doanh thu</p>
              <div className={styles.revKpiIcon}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
              </div>
            </div>
            <strong>{formatCurrency(revenueStats?.revenue ?? 0)}</strong>
            <span>Doanh thu từ các booking đã thanh toán/xác nhận</span>
          </div>

          <div className={`${styles.revenueKpiCard} ${styles.rev_orange}`}>
            <div className={styles.revKpiHeader}>
              <p>Doanh thu giải đấu</p>
              <div className={styles.revKpiIcon}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
            </div>
            <strong>{formatCurrency(revenueStats?.tournamentRevenue ?? 0)}</strong>
            <span>Doanh thu từ đăng ký giải đấu đã thanh toán</span>
          </div>

          <div className={`${styles.revenueKpiCard} ${styles.rev_blue}`}>
            <div className={styles.revKpiHeader}>
              <p>Tổng lượt đặt</p>
              <div className={styles.revKpiIcon}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z" />
                </svg>
              </div>
            </div>
            <strong>{(revenueStats?.bookingsCount ?? 0).toLocaleString("vi-VN")}</strong>
            <span>Số booking trong khoảng thời gian thống kê</span>
          </div>
        </div>

        <div className={styles.revenueDetailGrid}>
          <div className={styles.revenuePanel}>
            <div className={styles.revenuePanelHeader}>
              <h3>Doanh thu theo ngày</h3>
              <span>{dailyRevenue.length} ngày có dữ liệu</span>
            </div>
            <div className={styles.chartBox}>
              {dailyRevenue.length === 0 ? (
                <p className={styles.emptyText}>Chưa có dữ liệu doanh thu theo ngày.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dailyRevenue} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tickLine={false}
                      axisLine={false}
                      stroke="#6B7280"
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(value) => `${Number(value) / 1000000}M`}
                      tickLine={false}
                      axisLine={false}
                      stroke="#6B7280"
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), "Doanh thu"]}
                      labelFormatter={(label) => `Ngày ${formatDate(String(label))}`}
                    />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={styles.revenuePanel}>
            <div className={styles.revenuePanelHeader}>
              <h3>Doanh thu theo sân</h3>
              <span>Top sân có doanh thu cao</span>
            </div>
            <div className={styles.courtRevenueList}>
              {topCourts.length === 0 ? (
                <p className={styles.emptyText}>Chưa có dữ liệu doanh thu theo sân.</p>
              ) : (
                topCourts.map((court, index) => {
                  const percent =
                    totalCourtRevenue > 0
                      ? Math.round((court.totalRevenue / totalCourtRevenue) * 100)
                      : 0;

                  return (
                    <div key={court.courtId} className={styles.courtRevenueItem}>
                      <div className={styles.courtRevenueTop}>
                        <div>
                          <span className={styles.courtRank}>#{index + 1}</span>
                          <strong>{court.courtName}</strong>
                        </div>
                        <span>{formatCurrency(court.totalRevenue)}</span>
                      </div>
                      <div className={styles.courtRevenueMeta}>
                        <span>{court.bookingsCount} lượt đặt</span>
                        <span>{percent}% doanh thu sân</span>
                      </div>
                      <div className={styles.courtProgress}>
                        <div style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Error Alert */}
      {error && (
        <div className={styles.error}>
          <div className={styles.errorIcon}>!</div>
          <div className={styles.errorContent}>
            <h3>Không thể xử lý yêu cầu</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderText}>
            <h2>Xuất báo cáo mới</h2>
            <p>Chọn loại báo cáo, định dạng và khoảng thời gian</p>
          </div>
        </div>
        <ReportFilter loading={isExporting} onExport={exportReport} />
      </section>

      {/* History Table */}
      <section className={styles.historySection}>
        <div className={styles.historyHeader}>
          <div className={styles.historyHeaderLeft}>
            <div className={styles.historyHeaderText}>
              <h2>Lịch sử xuất báo cáo</h2>
              <p>Theo dõi người xuất, loại báo cáo, bộ lọc và trạng thái xử lý</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isLoadingHistory}
            onClick={() => void loadHistory()}
            className={styles.refreshBtn}
          >
            <RefreshIcon spinning={isLoadingHistory} />
            {isLoadingHistory ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
        <ReportHistoryTable history={history} loading={isLoadingHistory} />
      </section>
    </main>
  );
}

// Icons
function ChartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18M7 16l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface RefreshIconProps {
  spinning: boolean;
}

function RefreshIcon({ spinning }: RefreshIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={spinning ? styles.spinning : ""}
    >
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
