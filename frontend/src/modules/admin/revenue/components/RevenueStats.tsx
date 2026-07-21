// frontend/src/modules/admin/revenue/components/RevenueStats.tsx

"use client";

import type { RevenueResponse } from "@/types/revenue.types";
import {
  FiCreditCard,
  FiDollarSign,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";
import styles from "../RevenuePage.module.css";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

interface RevenueStatsProps {
  data: RevenueResponse | null;
  loading: boolean;
  error: string | null;
}

export default function RevenueStats({
  data,
  loading,
  error,
}: RevenueStatsProps) {
  if (loading) {
    return <div className={styles.loadingText}>Đang tải thống kê doanh thu...</div>;
  }

  if (error || !data) {
    return <div className={styles.errorText}>{error || "Không có dữ liệu"}</div>;
  }

  const stats = [
    {
      title: "Tổng doanh thu",
      value: formatCurrency(data.summary.totalRevenue),
      icon: <FiDollarSign />,
    },
    {
      title: "Doanh thu hôm nay",
      value: formatCurrency(data.summary.todayRevenue),
      icon: <FiTrendingUp />,
    },
    {
      title: "Doanh thu tháng này",
      value: formatCurrency(data.summary.monthRevenue),
      icon: <FiTrendingUp />,
    },
    {
      title: "Doanh thu giải đấu",
      value: formatCurrency(data.summary.tournamentRevenue ?? 0),
      icon: <FiDollarSign />,
    },
    {
      title: "Booking đã thanh toán",
      value: data.summary.paidBookings.toString(),
      icon: <FiCreditCard />,
    },
    {
      title: "Tổng hoàn tiền",
      value: formatCurrency(data.summary.refundAmount),
      icon: <FiRefreshCw />,
    },
  ];

  return (
    <section className={styles.statsGrid}>
      {stats.map((item) => (
        <div
          key={item.title}
          className={styles.statCard}
        >
          <div className={styles.statTop}>
            <div className={styles.statIcon}>{item.icon}</div>
            <p className={styles.statLabel}>{item.title}</p>
          </div>
          <p className={styles.statValue}>{item.value}</p>
        </div>
      ))}
    </section>
  );
}
