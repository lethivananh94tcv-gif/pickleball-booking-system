"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { getCourts, getAvailableCourts, getCourtSlots, type CourtSlot } from "@/services/courtApi";
import type { Court } from "@/types/court";
import { formatCurrency } from "@/utils/formatCurrency";
import StateBox from "@/components/common/StateBox";
import { getToken } from "@/utils/authStorage";
import { getFavorites, toggleFavorite } from "@/services/favoriteApi";
import BookingModal from "./BookingModal";
import styles from "./CourtsPage.module.css";

import { CourtScheduleDrawer } from "./CourtScheduleDrawer";

// ─────────────────────────────────────────────────────────────
// Trang danh sách sân — Player
// ─────────────────────────────────────────────────────────────
export default function CourtsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courts, setCourts] = useState<Court[]>([]);
  const [type, setType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  const dateParam = searchParams.get("date");
  const timeParam = searchParams.get("time");

  // Sync keyword state with URL search query parameter from home search bar
  useEffect(() => {
    const qSearch = searchParams.get("search");
    if (qSearch !== null) {
      setKeyword(qSearch);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Favorites state
  const [favoriteCourts, setFavoriteCourts] = useState<number[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    async function loadFavorites() {
      try {
        const favs = await getFavorites(token as string);
        const courtIds = favs
          .filter((f) => f.TargetType === "Court")
          .map((f) => f.TargetID);
        setFavoriteCourts(courtIds);
      } catch (err) {
        console.error("Failed to load favorite courts", err);
      }
    }
    loadFavorites();
  }, []);

  const handleToggleCourtFavorite = async (courtId: number) => {
    const token = getToken();
    if (!token) {
      alert("Vui lòng đăng nhập để thêm sân vào danh sách yêu thích!");
      return;
    }
    try {
      const isFav = await toggleFavorite(token, "Court", courtId);
      if (isFav) {
        setFavoriteCourts((prev) => [...prev, courtId]);
      } else {
        setFavoriteCourts((prev) => prev.filter((id) => id !== courtId));
      }
    } catch (err: any) {
      alert(err.message || "Không thể thực hiện yêu cầu.");
    }
  };

  // UC-12: Drawer lịch sân
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCourts() {
      try {
        setLoading(true);
        setError("");
        if (dateParam || timeParam) {
          const checkDate = dateParam || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
          let start = "";
          let end = "";
          if (timeParam && timeParam.includes("-")) {
            const parts = timeParam.split("-");
            start = parts[0];
            end = parts[1];
          }
          const availableSlots = await getAvailableCourts(checkDate, start, end);
          if (mounted) {
            const uniqueCourtsMap = new Map<number, Court>();
            (availableSlots || []).forEach((item: any) => {
              if (item.CourtID && !uniqueCourtsMap.has(item.CourtID)) {
                uniqueCourtsMap.set(item.CourtID, {
                  CourtID: item.CourtID,
                  CourtCode: item.CourtCode || `CRT-${item.CourtID}`,
                  CourtName: item.CourtName || "Sân Pickleball",
                  CourtType: item.CourtType || "Outdoor",
                  Location: item.Location || "Đà Nẵng",
                  Description: item.Description || "",
                  PricePerHour: item.PricePerHour || 100000,
                  CourtImage: item.CourtImage || "/images/courts/default.jpg",
                  Status: item.CourtStatus || item.Status || "Available",
                  OpenTime: item.OpenTime || "05:00",
                  CloseTime: item.CloseTime || "22:00",
                });
              }
            });
            setCourts(Array.from(uniqueCourtsMap.values()));
          }
        } else {
          const data = await getCourts();
          if (mounted) setCourts(data);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Không tải được sân.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCourts();
    return () => { mounted = false; };
  }, [dateParam, timeParam]);

  const filteredCourts = useMemo(() => {
    return (courts || []).filter((court) => {
      const matchType = type === "all" || court.CourtType === type;
      const matchStatus = statusFilter === "all" || court.Status === statusFilter;
      const searchText = [court.CourtName, court.CourtCode, court.Location, court.Description, court.CourtType]
        .filter(Boolean).join(" ").toLowerCase();
      return matchType && matchStatus && searchText.includes(keyword.toLowerCase());
    });
  }, [courts, keyword, type, statusFilter]);

  function resetFilter() { 
    setKeyword(""); 
    setType("all"); 
    setStatusFilter("all"); 
    if (dateParam || timeParam || searchParams.get("search")) {
      router.push("/courts");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <span className={styles.badge}>Find your perfect court</span>
              <h1>
                Chọn sân phù hợp <span>đặt lịch nhanh chóng</span>
              </h1>
              <p>
                Xem danh sách sân Pickleball, kiểm tra thông tin giá thuê,
                giờ hoạt động và đặt lịch chỉ trong vài bước.
              </p>
              <div className={styles.searchBox}>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm theo tên sân, khu vực, loại sân..."
                />
                <button type="button">🔍</button>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.heroImage}>
                <Image
                  src="/images/courts/c1.jpg"
                  alt="Pickleball court"
                  width={600}
                  height={400}
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`container ${styles.filterPanel}`}>
        <label>
          <span>Loại sân</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="Indoor">Sân trong nhà</option>
            <option value="Outdoor">Sân ngoài trời</option>
          </select>
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="Available">Còn trống</option>
            <option value="Maintenance">Bảo trì</option>
          </select>
        </label>
        <label>
          <span>Sắp xếp</span>
          <select defaultValue="popular">
            <option value="popular">Phổ biến nhất</option>
            <option value="priceAsc">Giá thấp đến cao</option>
            <option value="priceDesc">Giá cao đến thấp</option>
          </select>
        </label>
        <button type="button" onClick={resetFilter}>Bộ lọc</button>
      </section>

      <section className={`container ${styles.content}`}>
        {(dateParam || timeParam || keyword) && (
          <div style={{ marginBottom: "20px", padding: "14px 18px", backgroundColor: "#f0faf7", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1.5px solid #00a86b", boxShadow: "0 4px 12px rgba(0, 168, 107, 0.08)" }}>
            <div style={{ fontSize: "14px", color: "#073b2b", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              <span style={{ fontWeight: "700", color: "#00a86b" }}>⚡ Bộ lọc đang bật:</span>
              {keyword && <span style={{ backgroundColor: "#ffffff", padding: "4px 10px", borderRadius: "8px", border: "1px solid #d1ebd6", fontSize: "13px", fontWeight: "600" }}>🔍 &quot;{keyword}&quot;</span>}
              {dateParam && <span style={{ backgroundColor: "#ffffff", padding: "4px 10px", borderRadius: "8px", border: "1px solid #d1ebd6", fontSize: "13px", fontWeight: "600" }}>📅 Ngày: {dateParam.split("-").reverse().join("/")}</span>}
              {timeParam && <span style={{ backgroundColor: "#ffffff", padding: "4px 10px", borderRadius: "8px", border: "1px solid #d1ebd6", fontSize: "13px", fontWeight: "600" }}>🕒 Giờ: {timeParam.replace("-", " - ")}</span>}
            </div>
            <button
              type="button"
              onClick={resetFilter}
              style={{ padding: "8px 14px", backgroundColor: "#ef4444", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer", transition: "all 0.2s" }}
            >
              Xóa tất cả bộ lọc ✖
            </button>
          </div>
        )}

        <div className={styles.resultHeader}>
          <div>
            <h2>Danh sách sân</h2>
            <p>Hiển thị <strong>{filteredCourts.length}</strong> sân phù hợp</p>
          </div>
        </div>

        {loading ? (
          <StateBox variant="loading" title="Đang tải sân" description="Đang lấy dữ liệu sân từ backend." />
        ) : error ? (
          <StateBox variant="error" title="Không tải được dữ liệu" description={error} />
        ) : courts.length === 0 ? (
          <StateBox variant="empty" title="Chưa có sân nào trên hệ thống" description="Hệ thống hiện tại chưa có dữ liệu sân." />
        ) : filteredCourts.length === 0 ? (
          <StateBox variant="empty" title="Không có sân phù hợp" description="Bạn thử đổi bộ lọc hoặc từ khóa tìm kiếm." />
        ) : (
          <div className={styles.grid}>
            {filteredCourts.map((court) => (
              <article className={styles.card} key={court.CourtID}>
                <div className={styles.imageWrap}>
                  <Image
                    src={court.CourtImage || "/images/courts/c1.jpg"}
                    alt={court.CourtName}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    style={{ objectFit: 'cover' }}
                  />
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCourtFavorite(court.CourtID);
                    }}
                    className={`${styles.favoriteBtn} ${favoriteCourts.includes(court.CourtID) ? styles.isFavorite : ""}`}
                  >
                    {favoriteCourts.includes(court.CourtID) ? "♥" : "♡"}
                  </button>
                  <span className={`${styles.status} ${
                    court.Status === "Available" ? styles.statusAvailable
                      : court.Status === "Maintenance" ? styles.statusMaintenance
                      : styles.statusInactive
                  }`}>
                    {court.Status === "Available" ? "Đang hoạt động"
                      : court.Status === "Maintenance" ? "Bảo trì"
                      : "Tạm ngưng"}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <div>
                      <h3>{court.CourtName}</h3>
                      <p>📍 {court.Location || "Chưa cập nhật vị trí"}</p>
                    </div>
                    <strong>
                      {formatCurrency(court.PricePerHour)}
                      <small>/giờ</small>
                    </strong>
                  </div>

                  <p className={styles.desc}>
                    {court.Description || "Sân Pickleball tiêu chuẩn."}
                  </p>

                  <div className={styles.meta}>
                    <span>{court.CourtType === "Indoor" ? "Sân trong nhà" : "Sân ngoài trời"}</span>
                    <span>⏱ {court.OpenTime} - {court.CloseTime}</span>
                  </div>

                  <div className={styles.actions}>
                    {/* UC-12: Nút mở drawer lịch sân */}
                    {(() => {
                      const isCourtBookable = court.Status === "Available";

                      const buttonContent = (
                        <button
                          type="button"
                          onClick={() => isCourtBookable && setSelectedCourt(court)}
                          disabled={!isCourtBookable}
                          title={isCourtBookable ? "Xem lịch sân theo ngày" : undefined}
                          className={!isCourtBookable ? styles.disabledAction : undefined}
                        >
                          📅 Xem lịch & đặt sân
                        </button>
                      );

                      if (isCourtBookable) {
                        return buttonContent;
                      }

                      const disabledMessage =
                        court.Status === "Maintenance"
                          ? "Sân hiện đang bảo trì"
                          : "Sân hiện tạm ngưng hoạt động";

                      return (
                        <span
                          className={styles.disabledTooltip}
                          data-tooltip={disabledMessage}
                          aria-label={disabledMessage}
                          tabIndex={0}
                        >
                          {buttonContent}
                        </span>
                      );
                    })()}
                    <a href={`/courts/${court.CourtID}`} className={styles.outline} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                      Chi tiết
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* UC-12: Drawer xem lịch sân */}
      {selectedCourt && (
        <CourtScheduleDrawer
          court={selectedCourt}
          onClose={() => setSelectedCourt(null)}
        />
      )}
    </main>
  );
}