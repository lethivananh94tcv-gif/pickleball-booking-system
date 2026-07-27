"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPaymentStatus } from "@/services/paymentApi";
import type { PaymentStatusResult } from "@/services/paymentApi";
import { getToken } from "@/utils/authStorage";
import { formatCurrency } from "@/utils/formatCurrency";
import styles from "./PaymentResultPage.module.css";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  Paid: "Đã thanh toán",
  Pending: "Đang chờ xác nhận",
  Failed: "Thanh toán thất bại",
  Refunded: "Đã hoàn tiền",
  Expired: "Hết hạn",
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PendingPayment: "Chờ thanh toán",
  Confirmed: "Đã xác nhận",
  CheckedIn: "Đã Check-in",
  Completed: "Hoàn thành",
  Cancelled: "Đã hủy",
  Refunded: "Đã hoàn tiền",
};

// Hiển thị icon theo payment method
function methodIcon(method: string | null) {
  if (method === "PayOS") return "📲";
  return "💳";
}

/**
 * Trang /payment/success
 *
 * Hỗ trợ gateway: PayOS.
 *
 * Flow:
 * 1. Đọc bookingId hoặc orderCode (PayOS) từ query string.
 * 2. Gọi GET /api/payments/status?bookingId=... để lấy trạng thái THẬT từ backend.
 * 3. Nếu status = Pending → polling mỗi 4 giây tối đa 30 lần (2 phút).
 * 4. Hiển thị trạng thái – KHÔNG tự set Confirmed ở frontend.
 *
 * Trạng thái thật do backend xử lý sau khi verify IPN/webhook (BR-68).
 */
export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const bookingIdStr = searchParams.get("bookingId");
  const paymentCode = searchParams.get("paymentCode");
  const orderCode = searchParams.get("orderCode"); // PayOS
  const method = searchParams.get("method"); // "PayOS" khi redirect từ payos-return

  const isTournament = searchParams.get("type") === "tournament";
  const tournamentIdStr = searchParams.get("tournamentId");
  const tournamentId = Number(tournamentIdStr);

  const registrationIdStr = searchParams.get("registrationId");
  const registrationId = Number(registrationIdStr);

  const [status, setStatus] = useState<PaymentStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lấy bookingId: từ query hoặc từ gatewayOrderId nếu chỉ có orderCode
  const bookingId = Number(bookingIdStr);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadStatus = useCallback(
    async (token: string, bid: number): Promise<PaymentStatusResult | null> => {
      try {
        if (isTournament) {
          const { tournamentApi } = await import("@/services/tournamentApi");
          const regs = await tournamentApi.getMyRegistration(tournamentId);
          if (!regs || regs.length === 0) {
            setError("Không tìm thấy thông tin đăng ký giải đấu.");
            return null;
          }
          // Tìm registration khớp với registrationId từ URL, nếu không thấy thì lấy cái mới nhất (đầu tiên)
          const reg = registrationId
            ? (regs.find((r: any) => r.RegistrationID === registrationId) || regs[0])
            : regs[0];

          // Map tournament registration status to synthetic PaymentStatusResult
          const synthStatus: PaymentStatusResult = {
            bookingId: reg.RegistrationID,
            bookingStatus: reg.RegistrationStatus, // "Confirmed" or "PendingPayment"
            paymentId: reg.RegistrationID,
            paymentStatus: reg.PaymentStatus, // "Paid" or "Pending"
            paymentMethod: (method as any) || "PayOS",
            paymentCode: paymentCode || `#${orderCode}`,
            amount: reg.RegistrationFee || 0,
            expiredAt: reg.PaymentExpiredAt || null,
            paidAt: reg.PaymentStatus === "Paid" ? (reg.UpdatedAt || new Date().toISOString()) : null,
            failedAt: null,
            gatewayOrderId: orderCode,
          };
          setStatus(synthStatus);
          return synthStatus;
        } else {
          const data = await getPaymentStatus(token, bid);
          setStatus(data);
          return data;
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không thể tải trạng thái thanh toán."
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [isTournament, tournamentId, method, paymentCode, orderCode, registrationId]
  );

  useEffect(() => {
    if (isTournament) {
      if (isNaN(tournamentId)) {
        setError("Không tìm thấy thông tin giải đấu.");
        setLoading(false);
        return;
      }
    } else {
      if (!bookingId || isNaN(bookingId)) {
        setError("Không tìm thấy thông tin booking.");
        setLoading(false);
        return;
      }
    }

    const token = getToken();
    if (!token) {
      setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      setLoading(false);
      return;
    }

    const idToLoad = isTournament ? tournamentId : bookingId;

    // Load lần đầu
    loadStatus(token, idToLoad).then((data) => {
      // Nếu Pending → bắt đầu polling (tối đa 30 lần × 4s = 2 phút)
      if (data?.paymentStatus === "Pending") {
        let count = 0;
        pollRef.current = setInterval(async () => {
          count++;
          setPollCount(count);
          const latest = await loadStatus(token, idToLoad);
          // Dừng polling nếu đã có kết quả cuối hoặc đủ số lần
          if (latest?.paymentStatus !== "Pending" || count >= 30) {
            stopPolling();
          }
        }, 4000);
      }
    });

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingIdStr, tournamentIdStr, isTournament]);

  // ── Loading ───────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p>Đang kiểm tra trạng thái thanh toán...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────

  if (error || !status) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.iconWrap} style={{ background: "var(--pcs-brand-primary)" }}>
            <span className={styles.icon}>❌</span>
          </div>
          <h1 className={styles.title} style={{ color: "var(--pcs-status-error)" }}>
            Không tải được trạng thái
          </h1>
          <p className={styles.subtitle}>{error || "Có lỗi xảy ra."}</p>
          {isTournament ? (
            <Link href={`/tournaments/${tournamentId || ""}`} className={styles.btnPrimary}>
              Quay lại trang giải đấu →
            </Link>
          ) : (
            <Link href="/bookings" className={styles.btnPrimary}>
              Xem lịch sử booking →
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Determine display state ───────────────────────────

  const isPaid = status.paymentStatus === "Paid";
  const isPending = status.paymentStatus === "Pending";
  const isFailed = ["Failed", "Expired"].includes(status.paymentStatus ?? "");
  const isPayOS = status.paymentMethod === "PayOS" || method === "PayOS";

  // Khi đang polling – hiển thị countdown nhỏ
  const isPolling = isPending && pollRef.current !== null;

  const getPaidSuccessSubtitle = () => {
    if (isTournament) {
      return "Thanh toán thành công. Thông tin đăng ký giải đấu của bạn đã được xác nhận chính thức.";
    }
    if (status?.bookingType === "Coach") {
      return "Thanh toán thành công. Thông tin đặt HLV đã được gửi về email của bạn. Bạn cũng có thể xem thông báo trong mục chuông thông báo.";
    }
    if (status?.bookingType === "Combo") {
      return "Thanh toán thành công. Thông tin đặt combo sân & HLV đã được gửi về email của bạn. Bạn cũng có thể xem thông báo trong mục chuông thông báo.";
    }
    return "Thanh toán thành công. Thông tin đặt sân đã được gửi về email của bạn. Bạn cũng có thể xem thông báo trong mục chuông thông báo.";
  };

  const getSecondaryBtnProps = () => {
    if (status?.bookingType === "Coach") {
      return { href: "/courts", label: "Đặt thêm sân" };
    }
    if (status?.bookingType === "Combo") {
      return { href: "/combo", label: "Đặt thêm combo" };
    }
    if (status?.bookingType === "Court") {
      return { href: "/coaches", label: "Đặt thêm coach" };
    }
    return { href: "/courts", label: "Đặt thêm sân" };
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Icon */}
        <div
          className={styles.iconWrap}
          style={
            isPaid
              ? undefined
              : isPending
              ? { background: "var(--pcs-brand-primary)" }
              : { background: "var(--pcs-brand-primary)" }
          }
        >
          <span className={styles.icon}>
            {isPaid ? "✅" : isPending ? "⏳" : "⚠️"}
          </span>
        </div>

        {/* Title */}
        <h1
          className={styles.title}
          style={
            isPaid
              ? { color: "var(--pcs-status-success)" }
              : isPending
              ? { color: "var(--pcs-status-warning)" }
              : { color: "var(--pcs-status-error)" }
          }
        >
          {isPaid
            ? "Thanh toán thành công!"
            : isPending
            ? "Đang chờ xác nhận..."
            : "Thanh toán chưa xác nhận"}
        </h1>

        <p className={styles.subtitle}>
          {isPaid
            ? getPaidSuccessSubtitle()
            : isPending && isPayOS
            ? "Nếu bạn đã chuyển khoản, hệ thống đang xác nhận. Thường mất 30 giây – 2 phút."
            : isPending
            ? "Hệ thống đang xác nhận giao dịch. Vui lòng kiểm tra lại sau vài phút."
            : isFailed
            ? isTournament
              ? "Giao dịch đăng ký không thành công. Bạn có thể thử thanh toán lại từ trang chi tiết giải đấu."
              : "Giao dịch không thành công. Bạn có thể thử thanh toán lại từ lịch sử booking."
            : "Trạng thái giao dịch đang được cập nhật."}
        </p>

        <div className={styles.infoCard}>
          {status.bookingCode && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Mã booking</span>
              <span className={`${styles.infoValue} ${styles.bookingCode}`}>
                {status.bookingCode}
              </span>
            </div>
          )}
          {(paymentCode || orderCode) && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Mã giao dịch</span>
              <span className={`${styles.infoValue} ${styles.bookingCode}`}>
                {paymentCode || `#${orderCode}`}
              </span>
            </div>
          )}
          {status.amount !== null && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>💰 Số tiền</span>
              <span className={`${styles.infoValue} ${styles.amount}`}>
                {formatCurrency(Number(status.amount))}
              </span>
            </div>
          )}
          {status.paymentMethod && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Cổng thanh toán</span>
              <span className={styles.infoValue}>
                {methodIcon(status.paymentMethod)} {status.paymentMethod === "PayOS" ? "VietQR / PayOS" : status.paymentMethod}
              </span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{isTournament ? "Trạng thái đăng ký" : "Trạng thái booking"}</span>
            <span
              className={`${styles.statusBadge} ${
                status.bookingStatus === "Confirmed" ? "" : styles.statusPending
              }`}
            >
              {BOOKING_STATUS_LABELS[status.bookingStatus] || status.bookingStatus}
            </span>
          </div>
          {status.paymentStatus && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Trạng thái thanh toán</span>
              <span className={styles.infoValue}>
                {PAYMENT_STATUS_LABELS[status.paymentStatus] || status.paymentStatus}
              </span>
            </div>
          )}
          {status.paidAt && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Thời gian</span>
              <span className={styles.infoValue}>
                {new Date(status.paidAt).toLocaleString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Notice for pending */}
        {isPending && (
          <div className={styles.notice}>
            <span>ℹ️</span>
            <p>
              {isPolling
                ? `Đang tự động kiểm tra trạng thái... (${pollCount}/30)`
                : "Giao dịch đang được xác nhận từ cổng thanh toán."}{" "}
              {isPayOS
                ? "Nếu bạn đã quét QR và chuyển khoản thành công, hãy chờ vài giây."
                : "Thường mất 1–2 phút. Hãy refresh hoặc kiểm tra lại trong lịch sử booking."}
            </p>
          </div>
        )}

        {/* CTA buttons */}
        {isTournament ? (
          <>
            <Link href={`/tournaments/${tournamentId}`} className={styles.btnPrimary}>
              Quay lại trang giải đấu →
            </Link>
            <Link href="/tournaments" className={styles.btnSecondary}>
              Khám phá giải đấu khác
            </Link>
          </>
        ) : (
          <>
            <Link href="/bookings" className={styles.btnPrimary}>
              Xem lịch sử booking →
            </Link>
            <Link href={getSecondaryBtnProps().href} className={styles.btnSecondary}>
              {getSecondaryBtnProps().label}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
