"use client";

import { useState } from "react";
import Image from "next/image";
import { bookCoach } from "@/services/bookingApi";
import type { Booking } from "@/services/bookingApi";
import type { Coach, CoachSchedule } from "@/types/coach";
import { getToken } from "@/utils/authStorage";
import { formatCurrency } from "@/utils/formatCurrency";
import { getCoachImageUrl } from "@/utils/image";
import PaymentModal from "@/modules/payments/PaymentModal";
import styles from "./CoachBookingModal.module.css";
import { FiUser, FiCalendar, FiClock, FiTag, FiCheck, FiAlertCircle } from "react-icons/fi";

type Props = {
  coach: Coach;
  schedule: CoachSchedule;
  bookingDate: string;
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
};

type Step = "confirm" | "paying" | "success" | "error";

export default function CoachBookingModal({
  coach,
  schedule,
  bookingDate,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>("confirm");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Calculate hours duration, e.g. "08:00" to "10:00"
  const startH = parseInt(schedule.StartTime.split(":")[0]);
  const endH = parseInt(schedule.EndTime.split(":")[0]);
  const hours = Math.max(1, endH - startH);
  const totalFee = coach.HourlyRate * hours;

  async function handleConfirmBooking() {
    const token = getToken();
    if (!token) {
      setErrorMsg("Bạn chưa đăng nhập. Vui lòng đăng nhập để đặt lịch HLV.");
      setStep("error");
      return;
    }

    setLoading(true);
    try {
      const created = await bookCoach(token, {
        coachId: coach.CoachID,
        bookingDate,
        startTime: schedule.StartTime,
        endTime: schedule.EndTime,
      });
      setBooking(created);
      setStep("paying");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Đặt HLV thất bại. Vui lòng thử lại.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>

        {/* ── STEP: Xác nhận ── */}
        {step === "confirm" && (
          <>
            <div className={styles.headerBanner}>
              <div className={styles.avatarWrapper}>
                <Image
                  src={getCoachImageUrl(coach.AvatarURL)}
                  alt={coach.FullName}
                  width={90}
                  height={90}
                  className={styles.avatarImage}
                  priority
                />
                <div className={styles.shieldBadge}>
                  <FiCheck size={12} strokeWidth={4} />
                </div>
              </div>
            </div>

            <div className={styles.headerContent}>
              <h2>Xác nhận thuê HLV</h2>
              <p>Kiểm tra thông tin lịch học trước khi thanh toán</p>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoRow}>
                <div className={styles.labelArea}>
                  <div className={styles.iconWrapper}>
                    <FiUser />
                  </div>
                  <span>HLV</span>
                </div>
                <span className={styles.infoValue}>{coach.FullName}</span>
              </div>
              
              <div className={styles.infoRow}>
                <div className={styles.labelArea}>
                  <div className={styles.iconWrapper}>
                    <FiCalendar />
                  </div>
                  <span>Ngày</span>
                </div>
                <span className={styles.infoValue}>
                  {new Date(bookingDate).toLocaleDateString("vi-VN", {
                    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </span>
              </div>

              <div className={styles.infoRow}>
                <div className={styles.labelArea}>
                  <div className={styles.iconWrapper}>
                    <FiClock />
                  </div>
                  <span>Giờ học</span>
                </div>
                <span className={styles.infoValue}>
                  {schedule.StartTime} – {schedule.EndTime} ({hours} giờ)
                </span>
              </div>

              <div className={styles.infoRow}>
                <div className={styles.labelArea}>
                  <div className={styles.iconWrapper}>
                    <FiTag />
                  </div>
                  <span>Phí thuê</span>
                </div>
                <span className={`${styles.infoValue} ${styles.price}`}>
                  {formatCurrency(totalFee)}
                </span>
              </div>
            </div>

            <div className={styles.notice}>
              <div className={styles.noticeIcon}>
                <FiAlertCircle />
              </div>
              <p>Sau khi xác nhận, bạn có <strong>10 phút</strong> để hoàn tất thanh toán trước khi khung giờ bị hủy.</p>
            </div>

            <div className={styles.actions}>
              <button className={styles.btnCancel} onClick={onClose}>
                Hủy bỏ
              </button>
              <button
                className={styles.btnConfirm}
                onClick={handleConfirmBooking}
                disabled={loading}
              >
                {loading ? "Đang xử lý..." : "Xác nhận thuê HLV →"}
              </button>
            </div>
          </>
        )}

        {/* ── STEP: Thanh toán ── */}
        {step === "paying" && booking && (
          <PaymentModal
            bookingId={booking.BookingID}
            bookingCode={booking.BookingCode}
            totalAmount={Number(booking.TotalAmount)}
            onClose={onClose}
          />
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
