"use client";

import { useEffect, useState, useCallback } from "react";
import { getCourtSlots, type CourtSlot } from "@/services/courtApi";
import type { Court } from "@/types/court";
import { formatCurrency } from "@/utils/formatCurrency";
import BookingModal from "./BookingModal";
import styles from "./CourtsPage.module.css";

const AUTO_REFRESH_SEC = 30;

export function todayVN() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

export function CourtScheduleDrawer({
  court,
  onClose,
}: {
  court: Court;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayVN());
  const [slots, setSlots] = useState<CourtSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SEC);
  const [bookingSlot, setBookingSlot] = useState<CourtSlot | null>(null);

  const loadSlots = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const data = await getCourtSlots(court.CourtID, date);
        setSlots(data);
      } catch {
        if (!silent) setSlots([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [court.CourtID, date]
  );

  useEffect(() => {
    loadSlots();
    setCountdown(AUTO_REFRESH_SEC);
  }, [loadSlots]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadSlots(true);
          return AUTO_REFRESH_SEC;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [loadSlots]);

  const visibleSlots = slots.filter((s) => {
    if (s.Status === "Cancelled") return false;

    const now = new Date();
    const vnDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const todayStr = vnDate.toLocaleDateString("sv-SE");
    
    if (date === todayStr) {
      const currentHour = vnDate.getHours();
      const currentMin = vnDate.getMinutes();
      const currentVNTime = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;
      
      if (s.StartTime < currentVNTime) {
        return false;
      }
    }

    return true;
  });

  function getSlotClass(status: string) {
    if (status === "Available") return styles.slotAvailable;
    if (status === "Booked" || status === "Holding") return styles.slotBooked;
    return styles.slotBlocked;
  }

  function getSlotLabel(status: string) {
    const map: Record<string, string> = {
      Available:   "Còn trống",
      Blocked:     "Đã khóa",
      Booked:      "Đã đặt",
      Holding:     "Đang giữ chỗ",
      Maintenance: "Bảo trì",
    };
    return map[status] ?? status;
  }

  function handleBookSlot(slot: CourtSlot) {
    setBookingSlot(slot);
  }

  const availableCount = visibleSlots.filter((s) => s.Status === "Available").length;

  return (
    <div className={styles.scheduleOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.schedulePanel}>

        <div className={styles.schedulePanelHeader}>
          <div className={styles.schedulePanelInfo}>
            <h2 className={styles.schedulePanelTitle}>{court.CourtName}</h2>
            <p className={styles.schedulePanelSub}>
              {court.CourtCode} · {court.CourtType === "Indoor" ? "Trong nhà" : "Ngoài trời"} · ⏱ {court.OpenTime}–{court.CloseTime}
            </p>
          </div>
          <div className={styles.scheduleHeaderRight}>
            <span className={styles.scheduleRefreshBadge} title="Tự động làm mới">
              🔄 {countdown}s
            </span>
            <button onClick={onClose} className={styles.scheduleCloseBtn}>×</button>
          </div>
        </div>

        <div className={styles.scheduleDateRow}>
          <div className={styles.scheduleDateLeft}>
            <label className={styles.scheduleDateLabel}>📅 Chọn ngày xem lịch:</label>
            <input
              type="date"
              value={date}
              min={todayVN()}
              onChange={(e) => setDate(e.target.value)}
              className={styles.scheduleDateInput}
            />
          </div>
          {!loading && visibleSlots.length > 0 && (
            <div className={styles.scheduleAvailCount}>
              <span>{availableCount}</span>
              <small>slot còn trống</small>
            </div>
          )}
        </div>

        <div className={styles.scheduleLegend}>
          <span className={styles.legendItem}>
            <i className={styles.dotAvailable} /> Còn trống
          </span>
          <span className={styles.legendItem}>
            <i className={styles.dotBooked} /> Đã đặt / Đang giữ
          </span>
          <span className={styles.legendItem}>
            <i className={styles.dotBlocked} /> Không khả dụng
          </span>
        </div>

        <div className={styles.scheduleSlotList}>
          {loading ? (
            <div className={styles.scheduleEmpty}>
              <span className={styles.scheduleEmptyIcon}>⏳</span>
              <p>Đang tải lịch sân...</p>
            </div>
          ) : visibleSlots.length === 0 ? (
            <div className={styles.scheduleEmpty}>
              <span className={styles.scheduleEmptyIcon}>📭</span>
              <p>Chưa có lịch sân trong ngày này.</p>
              <small>Quản trị viên sẽ sớm mở slot cho ngày bạn chọn.</small>
            </div>
          ) : (
            <div className={styles.slotGrid}>
              {visibleSlots.map((slot) => {
                const isAvailable = slot.Status === "Available";
                return (
                  <div
                    key={slot.SlotID}
                    className={`${styles.slotCard} ${getSlotClass(slot.Status)}`}
                  >
                    {slot.HasPromo && slot.DiscountPercent && slot.DiscountPercent > 0 ? (
                      <span className={styles.slotPromoBadge}>
                        -{Math.round(slot.DiscountPercent)}%
                      </span>
                    ) : null}
                    <div className={styles.slotCardTime}>
                      {slot.StartTime} – {slot.EndTime}
                    </div>
                    <div className={styles.slotCardPrice}>
                      {slot.HasPromo && slot.OriginalPrice && slot.OriginalPrice > slot.Price ? (
                        <div className={styles.priceContainer}>
                          <span className={styles.originalPrice}>
                            {formatCurrency(slot.OriginalPrice)}
                          </span>
                          <span className={styles.discountedPrice}>
                            {formatCurrency(slot.Price)}
                          </span>
                        </div>
                      ) : (
                        formatCurrency(slot.Price)
                      )}
                    </div>
                    <div className={styles.slotCardStatusLabel}>
                      {getSlotLabel(slot.Status)}
                    </div>
                    {isAvailable && (
                      <button
                        className={styles.slotBookBtn}
                        onClick={() => handleBookSlot(slot)}
                      >
                        Đặt sân →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.scheduleFooter}>
          <p className={styles.scheduleFooterNote}>
            💡 Giá hiển thị là giá mỗi slot. Nhấn <strong>Đặt sân</strong> trên slot còn trống để tiến hành đặt lịch.
          </p>
        </div>
      </div>

      {bookingSlot && (
        <BookingModal
          courtId={court.CourtID}
          courtName={court.CourtName}
          slot={bookingSlot}
          bookingDate={date}
          courtType={court.CourtType}
          onClose={() => setBookingSlot(null)}
          onSuccess={() => {
            setBookingSlot(null);
            loadSlots();
          }}
        />
      )}
    </div>
  );
}
