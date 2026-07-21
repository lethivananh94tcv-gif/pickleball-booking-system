"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./HomePage.module.css";

function todayVN() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function SearchBookingBar() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword) params.append("search", keyword);
    if (date) params.append("date", date);
    if (time) params.append("time", time);
    
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
          <div className={styles.searchGroup}>
            <label htmlFor="searchTime">Khung giờ</label>
            <div className={styles.searchFieldWrap}>
              <span className={styles.searchIcon}>🕒</span>
              <select
                id="searchTime"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={styles.searchSelect}
              >
                <option value="">Tất cả giờ</option>
                <option value="05:00-07:00">05:00 - 07:00</option>
                <option value="07:00-09:00">07:00 - 09:00</option>
                <option value="09:00-11:00">09:00 - 11:00</option>
                <option value="11:00-13:00">11:00 - 13:00</option>
                <option value="13:00-15:00">13:00 - 15:00</option>
                <option value="15:00-17:00">15:00 - 17:00</option>
                <option value="17:00-19:00">17:00 - 19:00</option>
                <option value="19:00-21:00">19:00 - 21:00</option>
                <option value="21:00-23:00">21:00 - 23:00</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" className={styles.searchSubmitBtn}>
            Tìm sân trống ➜
          </button>
        </form>
      </div>
    </div>
  );
}
