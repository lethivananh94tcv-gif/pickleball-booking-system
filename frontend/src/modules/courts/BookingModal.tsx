"use client";

import { useState, useEffect } from "react";
import { bookCourt } from "@/services/bookingApi";
import type { Booking } from "@/services/bookingApi";
import type { CourtSlot } from "@/services/courtApi";
import { getToken, getUser } from "@/utils/authStorage";
import { formatCurrency } from "@/utils/formatCurrency";
import PaymentModal from "@/modules/payments/PaymentModal";
import styles from "./BookingModal.module.css";

type Props = {
  courtId: number;
  courtName: string;
  slot: CourtSlot;
  bookingDate: string;
  courtType?: string;
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
};

type Step = "confirm" | "paying" | "success" | "error";

function formatTime(timeStr: string) {
  if (!timeStr) return "";
  if (timeStr.includes("T")) {
    return timeStr.split("T")[1].slice(0, 5);
  }
  return timeStr.slice(0, 5);
}

export default function BookingModal({
  courtId,
  courtName,
  slot,
  bookingDate,
  courtType = "Trong nhà (Synthetic)",
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>("confirm");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [policyChecked, setPolicyChecked] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  useEffect(() => {
    if (step !== "confirm") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, onClose]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentUser = getUser();
  const totalFee = slot.Price;

  // Format Vietnam Date safely from YYYY-MM-DD
  const getVietnamFormattedDate = () => {
    if (!bookingDate) return "";
    const [y, m, d] = bookingDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  async function handleConfirmBooking() {
    const token = getToken();
    if (!token) {
      setErrorMsg("Bạn chưa đăng nhập. Vui lòng đăng nhập để đặt sân.");
      setStep("error");
      return;
    }

    setLoading(true);
    try {
      const created = await bookCourt(token, {
        courtId,
        bookingDate,
        startTime: formatTime(slot.StartTime),
        endTime: formatTime(slot.EndTime),
      });
      setBooking(created);
      setStep("paying");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Đặt sân thất bại. Vui lòng thử lại.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmClick() {
    if (!policyChecked) {
      setValidationError("Vui lòng đồng ý với chính sách và điều khoản hủy sân để tiếp tục.");
      return;
    }
    setValidationError("");
    handleConfirmBooking();
  }

  // Đóng toàn bộ modal – booking đã ở PendingPayment,
  // user có thể thanh toán lại từ /bookings
  function handlePaymentModalClose() {
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>

        {/* ── STEP: Xác nhận ── */}
        {step === "confirm" && (
          <>
            <button className={styles.closeBtnTop} onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <div className={styles.header}>
              <div className={styles.headerTitleRow}>
                <div className={styles.headerIconWrapper}>
                  <svg className={styles.headerIconSvg} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                    <polyline points="9 16 11 18 15 14"></polyline>
                  </svg>
                </div>
                <div className={styles.headerTitleArea}>
                  <div className={styles.titleRow}>
                    <h2>Xác nhận đặt sân của bạn</h2>
                    <span className={styles.statusBadge}>
                      <span className={styles.statusDot}></span>
                      Sẵn sàng
                    </span>
                  </div>
                  <p>Vui lòng kiểm tra lại thông tin để hoàn tất việc đặt sân.</p>
                </div>
              </div>
            </div>

            <div className={styles.gridContainer}>
              {/* Box 1: Sân */}
              <div className={styles.gridBox}>
                <div className={styles.boxLabel}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="12" y1="3" x2="12" y2="21"></line>
                  </svg>
                  <span>SÂN</span>
                </div>
                <div className={styles.boxContent}>
                  <span className={styles.courtNameText}>{courtName}</span>
                  <span className={styles.courtTypeSub}>
                    {courtType === "Indoor" ? "Trong nhà (Synthetic)" : courtType === "Outdoor" ? "Ngoài trời (Outdoor)" : courtType}
                  </span>
                </div>
              </div>

              {/* Box 2: Người đặt chính */}
              <div className={styles.gridBox}>
                <div className={styles.boxLabel}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span>NGƯỜI ĐẶT CHÍNH</span>
                </div>
                <div className={styles.boxContentUser}>
                  <div className={styles.avatarPlaceholder}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{currentUser?.FullName || currentUser?.fullName || "Khách hàng"}</span>
                    <span className={styles.userRole}>{currentUser?.RoleName || currentUser?.role || "Thành viên"}</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Lịch hẹn */}
              <div className={styles.gridBox}>
                <div className={styles.boxLabel}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span>LỊCH HẸN</span>
                </div>
                <div className={styles.boxContent}>
                  <span className={styles.appointmentDate}>{getVietnamFormattedDate()}</span>
                  <span className={styles.appointmentTime}>
                    {formatTime(slot.StartTime)} – {formatTime(slot.EndTime)}
                  </span>
                </div>
              </div>

              {/* Box 4: Tổng thanh toán */}
              <div className={styles.gridBox}>
                <div className={styles.boxLabel}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                    <line x1="12" y1="10" x2="12" y2="10"></line>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span>TỔNG THANH TOÁN</span>
                </div>
                <div className={styles.boxContentPrice}>
                  <span className={styles.totalPriceVal}>
                    {totalFee.toLocaleString("vi-VN")} <span className={styles.currencyUnderline}>đ</span>
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.holdingAlert}>
              <div className={styles.alertIconWrapper}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <p>Sân đang được giữ cho bạn. Vui lòng hoàn tất việc đặt sân trong vòng <strong className={styles.alertTimer}>{formatCountdown(timeLeft)} phút</strong> nữa để đảm bảo chỗ của mình.</p>
            </div>

            <div className={styles.policyRow}>
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={policyChecked}
                  onChange={(e) => setPolicyChecked(e.target.checked)}
                />
                <span className={styles.customCheckbox}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span className={styles.policyText}>
                  Tôi đồng ý với <a href="#" onClick={(e) => e.preventDefault()} className={styles.policyLink}>Chính sách của PickleClub</a> và các điều khoản hủy sân.
                </span>
              </label>
            </div>

            {validationError && (
              <div className={styles.validationErrorMsg}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{validationError}</span>
              </div>
            )}

            <div className={styles.actionsRow}>
              <button className={styles.btnCancelNew} onClick={onClose}>
                Hủy bỏ
              </button>
              <button
                className={styles.btnConfirmGreen}
                onClick={handleConfirmClick}
                disabled={loading}
              >
                {loading ? "Đang xử lý..." : "Xác nhận đặt sân →"}
              </button>
            </div>
          </>
        )}

        {/* ── STEP: Thanh toán – PaymentModal thật ── */}
        {step === "paying" && booking && (
          <PaymentModal
            bookingId={booking.BookingID}
            bookingCode={booking.BookingCode}
            totalAmount={Number(booking.TotalAmount)}
            onClose={handlePaymentModalClose}
          />
        )}

        {/* ── STEP: Thành công ── */}
        {step === "success" && booking && (
          <>
            <div className={styles.successHeader}>
              <div className={styles.successIcon}>✅</div>
              <h2>Đặt sân thành công!</h2>
              <p>Booking của bạn đã được xác nhận</p>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Mã booking</span>
                <span className={`${styles.infoValue} ${styles.bookingCode}`}>
                  {booking.BookingCode}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Sân</span>
                <span className={styles.infoValue}>{courtName}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Ngày</span>
                <span className={styles.infoValue}>
                  {new Date(bookingDate).toLocaleDateString("vi-VN")}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Giờ</span>
                <span className={styles.infoValue}>
                  {slot.StartTime} – {slot.EndTime}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Thanh toán</span>
                <span className={`${styles.infoValue} ${styles.paidBadge}`}>
                  {formatCurrency(Number(booking.TotalAmount))}
                </span>
              </div>

            </div>

            <div className={styles.notice}>
              <span>📋</span>
              <p>Vui lòng đến sân trước giờ chơi <strong>30 phút</strong> để check-in.</p>
            </div>

            <button className={styles.btnFullSuccess} onClick={onClose}>
              Hoàn thành →
            </button>
          </>
        )}

        {/* ── STEP: Lỗi ── */}
        {step === "error" && (
          <>
            <div className={styles.errorHeader}>
              <div className={styles.errorIcon}>❌</div>
              <h2>Có lỗi xảy ra</h2>
              <p>{errorMsg}</p>
            </div>
            <div className={styles.actions}>
              <button className={styles.btnCancel} onClick={onClose}>
                Đóng
              </button>
              <button
                className={styles.btnConfirm}
                onClick={() => { setStep("confirm"); setErrorMsg(""); }}
              >
                Thử lại
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
