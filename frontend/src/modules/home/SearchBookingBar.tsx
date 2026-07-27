"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import styles from "./HomePage.module.css";

function todayVN() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function SearchBookingBar() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);

  const timeBoxRef = useRef<HTMLDivElement>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const toggleTimePicker = () => {
    if (showTimePicker) {
      setShowTimePicker(false);
    } else if (timeBoxRef.current) {
      const rect = timeBoxRef.current.getBoundingClientRect();
      setPopoverCoords({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 260),
      });
      setShowTimePicker(true);
    }
  };

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (showTimePicker && timeBoxRef.current) {
        const rect = timeBoxRef.current.getBoundingClientRect();
        setPopoverCoords({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: Math.max(rect.width, 260),
        });
      }
    };
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [showTimePicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword) params.append("search", keyword);
    if (date) params.append("date", date);
    if (startTime && endTime) {
      params.append("time", `${startTime}-${endTime}`);
    }
    
    router.push(`/courts?${params.toString()}`);
  };

  return (
    <div className={styles.searchBarWrapper}>
      <div className={styles.searchBarInner}>
        <div className={styles.searchBarTitle}>
          <span>⚡ ĐẶT LỊCH NHANH CHÓNG • TÌM KIẾM SÂN PICKLEBALL TRỐNG</span>
        </div>
        <form onSubmit={handleSubmit} className={styles.searchForm}>
          {/* Keyword Search */}
          <div className={styles.searchGroup}>
            <label htmlFor="searchKeyword">Địa điểm / Tên sân</label>
            <div className={styles.searchFieldWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                id="searchKeyword"
                type="text"
                placeholder="Tìm tên sân hoặc khu vực..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Date Selector */}
          <div className={styles.searchGroup}>
            <label htmlFor="searchDate">Ngày chơi</label>
            <div className={styles.searchFieldWrap}>
              <span className={styles.searchIcon}>📅</span>
              <input
                id="searchDate"
                type="date"
                value={date}
                min={todayVN()}
                onChange={(e) => setDate(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Time Selector */}
          <div className={styles.searchGroup} ref={timeBoxRef}>
            <label>Khung giờ</label>
            <div className={styles.searchFieldWrap}>
              <span className={styles.searchIcon}>🕒</span>
              <div
                onClick={toggleTimePicker}
                className={styles.searchInput}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  userSelect: "none",
                  paddingRight: "16px",
                }}
              >
                <span style={{ color: startTime && endTime ? "#073b2b" : "#64748b", fontWeight: startTime && endTime ? "600" : "500" }}>
                  {startTime && endTime ? `${startTime} - ${endTime}` : "Tất cả giờ"}
                </span>
                <span style={{ fontSize: "12px", color: "#00a86b" }}>▼</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" className={styles.searchSubmitBtn}>
            Tìm sân trống ➜
          </button>
        </form>
      </div>

      {/* Portal Popover for Start & End Time (escapes overflow:hidden of searchBarWrapper) */}
      {showTimePicker && typeof window !== "undefined" && createPortal(
        <>
          <div
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 }}
            onClick={() => setShowTimePicker(false)}
          />
          <div
            style={{
              position: "absolute",
              top: `${popoverCoords?.top || 0}px`,
              left: `${popoverCoords?.left || 0}px`,
              minWidth: `${popoverCoords?.width || 260}px`,
              backgroundColor: "#ffffff",
              border: "1.5px solid #00a86b",
              borderRadius: "16px",
              padding: "16px",
              boxShadow: "0 15px 35px rgba(0, 0, 0, 0.15)",
              zIndex: 99999,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#073b2b" }}>⏳ Chọn giờ chơi</span>
              <button
                type="button"
                onClick={() => {
                  setStartTime("");
                  setEndTime("");
                  setShowTimePicker(false);
                }}
                style={{ fontSize: "12px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: "600", padding: 0 }}
              >
                Đặt lại
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#617b70", marginBottom: "6px" }}>BẮT ĐẦU</label>
                <select
                  value={startTime}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartTime(newStart);
                    if (!endTime || endTime <= newStart) {
                      const startHour = parseInt(newStart.split(":")[0], 10);
                      const endHour = Math.min(23, startHour + 1);
                      setEndTime(`${endHour < 10 ? "0" : ""}${endHour}:00`);
                    }
                  }}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #d1ebd6", fontSize: "13px", color: "#073b2b", outline: "none", fontWeight: "600", backgroundColor: "#ffffff", cursor: "pointer" }}
                >
                  <option value="">Chọn giờ</option>
                  {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => {
                    const timeStr = `${h < 10 ? "0" : ""}${h}:00`;
                    return <option key={timeStr} value={timeStr}>{timeStr}</option>;
                  })}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#617b70", marginBottom: "6px" }}>KẾT THÚC</label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={!startTime}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #d1ebd6", fontSize: "13px", color: "#073b2b", outline: "none", fontWeight: "600", backgroundColor: !startTime ? "#f8fafc" : "#ffffff", cursor: !startTime ? "not-allowed" : "pointer" }}
                >
                  <option value="">Chọn giờ</option>
                  {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => {
                    const timeStr = `${h < 10 ? "0" : ""}${h}:00`;
                    const isAfterStart = !startTime || timeStr > startTime;
                    if (!isAfterStart) return null;
                    return <option key={timeStr} value={timeStr}>{timeStr}</option>;
                  })}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTimePicker(false)}
              style={{ width: "100%", padding: "10px", borderRadius: "10px", backgroundColor: "#00a86b", color: "#ffffff", border: "none", fontWeight: "700", fontSize: "13.5px", cursor: "pointer", marginTop: "4px", transition: "all 0.2s" }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#073b2b")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#00a86b")}
            >
              Xác nhận
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
