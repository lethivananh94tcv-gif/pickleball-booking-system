"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getCourtById, getCourtSlots, type CourtSlot } from "@/services/courtApi";
import { reviewApi } from "@/services/reviewApi";
import type { Court } from "@/types/court";
import type { Review, ReviewStats } from "@/types/review";
import { formatCurrency } from "@/utils/formatCurrency";
import StateBox from "@/components/common/StateBox";
import BookingModal from "./BookingModal";
import ReviewList from "@/components/reviews/ReviewList";
import ReviewStatsView from "@/components/reviews/ReviewStatsView";
import ReviewModal from "@/components/reviews/ReviewModal";
import { getToken } from "@/utils/authStorage";
import { getFavorites, toggleFavorite } from "@/services/favoriteApi";
import styles from "./CourtDetailPage.module.css";

function todayVN() {
  const d = new Date();
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function CourtDetailPage({ courtId }: { courtId: string }) {
  const router = useRouter();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);

  // Booking UI State
  const [date, setDate] = useState(todayVN());
  const [slots, setSlots] = useState<CourtSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<CourtSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingSlot, setBookingSlot] = useState<CourtSlot | null>(null);

  // Review State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | undefined>(undefined);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const displayImages = court
    ? [
        court.CourtImage || "/images/courts/c1.jpg",
        "/images/courts/c2.jpg",
        "/images/courts/c3.jpg",
        "/images/courts/c4.jpg",
        "/images/courts/c5.jpg",
      ]
    : [];

  const openLightbox = (index: number) => {
    setActiveImageIndex(index);
    setLightboxOpen(true);
  };

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : displayImages.length - 1));
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveImageIndex((prev) => (prev < displayImages.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || displayImages.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (diff > 50) {
      handleNextImage(); // Swipe left -> next
    } else if (diff < -50) {
      handlePrevImage(); // Swipe right -> prev
    }
    setTouchStartX(null);
  };

  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") handlePrevImage();
      if (e.key === "ArrowRight") handleNextImage();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, activeImageIndex]); // activeImageIndex needed so handlers use latest state

  useEffect(() => {
    async function fetchCourt() {
      try {
        setLoading(true);
        const data = await getCourtById(courtId);
        setCourt(data);
      } catch (err) {
        setError("Không thể tải thông tin sân. Sân có thể không tồn tại.");
      } finally {
        setLoading(false);
      }
    }
    fetchCourt();
  }, [courtId]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    async function checkFavorite() {
      try {
        const favs = await getFavorites(token as string);
        const exists = favs.some((f) => f.TargetType === "Court" && f.TargetID === Number(courtId));
        setIsFavorite(exists);
      } catch (err) {
        console.error("Failed to check court favorites", err);
      }
    }
    checkFavorite();
  }, [courtId]);

  const handleToggleFavorite = async () => {
    const token = getToken();
    if (!token) {
      alert("Vui lòng đăng nhập để thêm sân vào danh sách yêu thích!");
      router.push("/login");
      return;
    }
    try {
      const newState = await toggleFavorite(token, "Court", Number(courtId));
      setIsFavorite(newState);
    } catch (err: any) {
      alert(err.message || "Không thể thực hiện yêu cầu.");
    }
  };

  useEffect(() => {
    async function fetchReviews() {
      try {
        setLoadingReviews(true);
        const data = await reviewApi.getCourtReviews(Number(courtId), reviewPage, 5);
        setReviews(data.data);
        setReviewStats(data.stats);
        setReviewTotalPages(data.totalPages);
      } catch (err) {
        console.error("Failed to load reviews");
      } finally {
        setLoadingReviews(false);
      }
    }
    fetchReviews();
  }, [courtId, reviewPage]);

  useEffect(() => {
    if (!court) return;
    const currentCourtId = court.CourtID;

    async function loadSlots() {
      try {
        setLoadingSlots(true);
        const data = await getCourtSlots(currentCourtId, date);
        setSlots(data);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [court, date]);

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

  const handleBookNow = () => {
    if (!court || court.Status !== "Available") return;
    if (!selectedSlot) return;
    setBookingSlot(selectedSlot);
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <div className="container" style={{ padding: "100px 0" }}>
          <StateBox variant="loading" title="Đang tải thông tin sân..." />
        </div>
      </main>
    );
  }

  if (error || !court) {
    return (
      <main className={styles.page}>
        <div className="container" style={{ padding: "100px 0" }}>
          <StateBox variant="error" title="Lỗi" description={error} />
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <button className={styles.backBtn} onClick={() => router.push("/courts")}>
              ← Quay lại danh sách sân
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isCourtBookable = court.Status === "Available";

  return (
    <main className={styles.page}>
      <div className={`container ${styles.container}`}>
        {/* Breadcrumb Navigation */}
        <nav className={styles.breadcrumb}>
          <span className={styles.breadcrumbLink} onClick={() => router.push("/")}>Trang chủ</span>
          <span className={styles.breadcrumbDivider}>&gt;</span>
          <span className={styles.breadcrumbLink} onClick={() => router.push("/courts")}>Sân</span>
          <span className={styles.breadcrumbDivider}>&gt;</span>
          <span className={styles.breadcrumbActive}>{court.CourtName}</span>
        </nav>

        {/* Two-Column Grid */}
        <div className={styles.mainGrid}>
          {/* Left Column: Details & Media */}
          <div className={styles.leftCol}>
            {/* Gallery Section */}
            <section className={styles.gallery}>
              <div className={styles.mainImage} onClick={() => openLightbox(0)}>
                <Image
                  src={displayImages[0]}
                  alt={court.CourtName}
                  fill
                  priority
                  style={{ objectFit: "cover" }}
                />
                <span className={styles.locationBadge}>
                  {court.CourtType === "Indoor" ? "Sân trong nhà" : "Ngoài trời"}
                </span>
              </div>
              <div className={styles.thumbnails}>
                {displayImages.slice(1, 5).map((img, idx) => (
                  <div key={idx} className={styles.thumbItem} onClick={() => openLightbox(idx + 1)}>
                    <Image src={img} alt={`${court.CourtName} view ${idx + 1}`} fill style={{ objectFit: "cover" }} />
                    {idx === 3 && displayImages.length >= 5 && (
                      <div className={styles.moreOverlay}>
                        <span>Xem tất cả ({displayImages.length})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Header info */}
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>{court.CourtName}</h1>
              <div className={styles.metaRow}>
                <span className={styles.location}>📍 {court.Location || "Đà Nẵng"}</span>
                <span className={styles.rating}>⭐ {reviewStats?.AverageRating ? reviewStats.AverageRating.toFixed(1) : "0.0"} <span className={styles.reviewCount}>({reviewStats?.TotalReviews || 0} đánh giá)</span></span>
                <span className={styles.metaDivider}>•</span>
                <span className={styles.bookingsCount}>Đã đặt 1.2k+ lượt</span>
              </div>
            </div>

            {/* Core Specs badges */}
            <div className={styles.features}>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>👥</span>
                <div className={styles.featureDetails}>
                  <small>Sức chứa tối đa</small>
                  <strong>8 người</strong>
                </div>
              </div>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>🏟️</span>
                <div className={styles.featureDetails}>
                  <small>Loại sân</small>
                  <strong>{court.CourtType === "Indoor" ? "Trong nhà" : "Ngoài trời"}</strong>
                </div>
              </div>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>🧱</span>
                <div className={styles.featureDetails}>
                  <small>Mặt sân</small>
                  <strong>Acrylic</strong>
                </div>
              </div>
            </div>

            {/* Description */}
            <section className={styles.section}>
              <h2>Giới thiệu</h2>
              <p className={styles.description}>
                {court.Description || `${court.CourtName} là sân pickleball ngoài trời với view hướng biển tuyệt đẹp, không khí trong lành và không gian thoáng mát. Sân đạt chuẩn thi đấu, mặt sân Acrylic cao cấp giúp bóng nảy tốt, mang lại trải nghiệm tuyệt vời cho người chơi.`}
              </p>
            </section>

            {/* Amenities Grid */}
            <section className={styles.section}>
              <h2>Tiện ích</h2>
              <div className={styles.amenitiesGrid}>
                <div className={styles.amenityItem}>
                  <span className={styles.greenIcon}>🚿</span> Phòng tắm
                </div>
                <div className={styles.amenityItem}>
                  <span className={styles.greenIcon}>🅿️</span> Bãi đỗ xe
                </div>
                <div className={styles.amenityItem}>
                  <span className={styles.greenIcon}>📶</span> Wifi miễn phí
                </div>
                <div className={styles.amenityItem}>
                  <span className={styles.greenIcon}>☕</span> Cafe
                </div>
                <div className={styles.amenityItem}>
                  <span className={styles.greenIcon}>🥤</span> Nước uống
                </div>
                <div className={styles.amenityItem}>
                  <span className={styles.greenIcon}>💡</span> Đèn LED
                </div>
                <div className={styles.amenityItem}>
                  <span className={styles.greenIcon}>🛋️</span> Khu nghỉ
                </div>
                <div className={styles.amenityItem}>
                  <span className={styles.greenIcon}>🔒</span> Locker
                </div>
              </div>
            </section>

            {/* Map Address & map visual */}
            <section className={styles.section}>
              <h2>Vị trí</h2>
              <p className={styles.address}>12 Hoàng Sa, Thọ Quang, Sơn Trà, Đà Nẵng</p>
              <div className={styles.mapContainer}>
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3833.802446506307!2d108.243579!3d16.075739!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3142177f1966a457%3A0xf69f41b212f4df81!2zQsOjaSBiaeG7g24gTeG7uSBLaMOq!5e0!3m2!1svi!2s!4v1700000000000!5m2!1svi!2s"
                  width="100%"
                  height="220"
                  style={{ border: 0, borderRadius: "16px" }}
                  allowFullScreen={false}
                  loading="lazy"
                />
              </div>
            </section>

            {/* Ratings Breakdown */}
            <section className={styles.section} style={{ position: "relative" }}>
              <h2>Đánh giá</h2>
              <button 
                onClick={async () => {
                  const token = getToken();
                  if (!token) {
                    alert("Vui lòng đăng nhập để viết đánh giá.");
                    return;
                  }
                  try {
                    const res = await reviewApi.checkEligibility({ courtId: court.CourtID }, token);
                    if (res && res.canReview) {
                      setReviewModalOpen(true);
                    } else {
                      alert("Bạn chỉ có thể đánh giá sân này sau khi đã đặt lịch và hoàn thành giờ chơi tại đây.");
                    }
                  } catch (err: any) {
                    alert(err.message || "Đã xảy ra lỗi khi kiểm tra quyền đánh giá.");
                  }
                }}
                style={{ position: "absolute", top: "0px", right: "0px", background: "#1677ff", color: "white", padding: "8px 16px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 500 }}
              >
                Viết Đánh giá
              </button>
              
              <ReviewModal
                isOpen={reviewModalOpen}
                onClose={() => setReviewModalOpen(false)}
                title={`Đánh giá sân ${court.CourtName}`}
                courtId={court.CourtID}
                onSuccess={() => {
                  setReviewModalOpen(false);
                  // Reload reviews
                  setReviewPage(1);
                  reviewApi.getCourtReviews(court.CourtID, 1, 5).then(data => {
                    setReviews(data.data);
                    setReviewStats(data.stats);
                    setReviewTotalPages(data.totalPages);
                  });
                }}
              />

              <ReviewStatsView stats={reviewStats} />
              <ReviewList
                reviews={reviews}
                loading={loadingReviews}
                page={reviewPage}
                totalPages={reviewTotalPages}
                onPageChange={setReviewPage}
              />
            </section>
          </div>

          {/* Right Column: Sticky Booking Sidebar */}
          <div className={styles.rightCol}>
            <div className={styles.bookingCard}>
              <h3 className={styles.cardTitle}>Đặt sân ngay</h3>
              
              {!isCourtBookable && (
                <div className={styles.maintenanceNotice}>
                  <strong>{court.Status === "Maintenance" ? "Sân đang bảo trì" : "Sân tạm ngưng hoạt động"}</strong>
                  <p>Hiện tại sân chưa thể nhận lịch đặt. Vui lòng chọn sân khác hoặc quay lại sau.</p>
                </div>
              )}

              <div className={styles.priceRow}>
                <span className={styles.price}>{formatCurrency(court.PricePerHour)}</span>
                <span className={styles.unit}>/ giờ</span>
              </div>
              <span className={styles.vatNote}>Giá đã bao gồm VAT</span>

              <div className={styles.hoursRow}>
                <span>⏱ Giờ hoạt động:</span>
                <strong>{court.OpenTime} - {court.CloseTime}</strong>
              </div>

              {/* Date selection field */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Chọn ngày</label>
                <div className={styles.dateInputWrapper}>
                  <input
                    type="date"
                    value={date}
                    min={todayVN()}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setSelectedSlot(null);
                    }}
                    className={styles.dateInput}
                    disabled={!isCourtBookable}
                  />
                </div>
              </div>

              {/* Hourly Slot selector buttons */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Chọn giờ</label>
                {loadingSlots ? (
                  <div className={styles.slotsLoading}>Đang tải khung giờ...</div>
                ) : visibleSlots.length === 0 ? (
                  <div className={styles.slotsEmpty}>Hết slot trống trong ngày này.</div>
                ) : (
                  <div className={styles.slotsGrid}>
                    {visibleSlots.map((slot) => {
                      const isAvailable = isCourtBookable && slot.Status === "Available";
                      const isSelected = selectedSlot?.SlotID === slot.SlotID;
                      return (
                        <button
                          key={slot.SlotID}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => setSelectedSlot(slot)}
                          className={`${styles.slotBtn} ${
                            isSelected ? styles.slotSelected : ""
                          } ${!isAvailable ? styles.slotBooked : ""}`}
                          style={slot.HasPromo ? { position: "relative", borderColor: "#f87171" } : { position: "relative" }}
                        >
                          {slot.StartTime.substring(0, 5)}
                          {slot.HasPromo && slot.DiscountPercent && (
                            <span className={styles.promoTag}>-{slot.DiscountPercent}%</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Hours count picker (fixed/disabled for slot-based booking) */}
              <div className={styles.durationRow}>
                <label className={styles.fieldLabel}>Số giờ đặt</label>
                <div className={styles.counter}>
                  <button type="button" className={styles.counterBtn} disabled>-</button>
                  <span className={styles.counterValue}>1</span>
                  <button type="button" className={styles.counterBtn} disabled>+</button>
                </div>
              </div>

              {/* Subtotal calculation */}
              <div className={styles.subtotalRow}>
                <span>Tạm tính</span>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  {selectedSlot && selectedSlot.HasPromo && selectedSlot.DiscountPercent && selectedSlot.OriginalPrice ? (
                    <>
                      <span style={{ textDecoration: "line-through", color: "var(--pcs-neutral-400)", fontSize: "13px", marginRight: "4px" }}>
                        {formatCurrency(selectedSlot.OriginalPrice)}
                      </span>
                      <strong className={styles.subtotalPrice}>
                        {formatCurrency(selectedSlot.Price)}
                      </strong>
                      <span style={{ fontSize: "11px", color: "var(--pcs-status-success)", fontWeight: 600 }}>
                        (Tiết kiệm {formatCurrency(selectedSlot.OriginalPrice - selectedSlot.Price)})
                      </span>
                    </>
                  ) : (
                    <strong className={styles.subtotalPrice}>
                      {selectedSlot ? formatCurrency(selectedSlot.Price) : formatCurrency(court.PricePerHour)}
                    </strong>
                  )}
                </div>
              </div>

              {/* Primary action buttons */}
              <button
                type="button"
                onClick={handleBookNow}
                disabled={!isCourtBookable || !selectedSlot}
                className={`${styles.bookNowBtn} ${!isCourtBookable ? styles.bookingDisabled : ""}`}
              >
                📅 Đặt sân ngay
              </button>

              <button 
                type="button" 
                onClick={handleToggleFavorite} 
                className={`${styles.favoriteBtn} ${isFavorite ? styles.isFavorite : ""}`}
              >
                {isFavorite ? "❤️ Đã thêm vào yêu thích" : "💚 Thêm vào yêu thích"}
              </button>

              {/* Reassurance text */}
              <div className={styles.reassurance}>
                <span>✓ Xác nhận tức thì</span>
                <span>✓ Hủy miễn phí</span>
                <span>✓ Hỗ trợ 24/7</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BookingModal Trigger */}
      {bookingSlot && court && (
        <BookingModal
          courtId={court.CourtID}
          courtName={court.CourtName}
          slot={bookingSlot}
          bookingDate={date}
          courtType={court.CourtType}
          onClose={() => setBookingSlot(null)}
          onSuccess={() => {
            setBookingSlot(null);
            // Reload slots list
            const currentCourtId = court.CourtID;
            async function reload() {
              try {
                const data = await getCourtSlots(currentCourtId, date);
                setSlots(data);
                setSelectedSlot(null);
              } catch {}
            }
            reload();
          }}
        />
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && displayImages.length > 0 && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxOpen(false)} role="dialog" aria-modal="true">
          <div
            className={styles.lightboxContent}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button className={styles.lightboxClose} onClick={() => setLightboxOpen(false)} aria-label="Đóng">
              &times;
            </button>

            {displayImages.length > 1 && (
              <button className={styles.lightboxPrev} onClick={handlePrevImage} aria-label="Ảnh trước">
                &lt;
              </button>
            )}

            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <Image
                src={displayImages[activeImageIndex]}
                alt={`${court.CourtName} image ${activeImageIndex + 1}`}
                fill
                className={styles.lightboxImage}
              />
            </div>

            {displayImages.length > 1 && (
              <button className={styles.lightboxNext} onClick={handleNextImage} aria-label="Ảnh sau">
                &gt;
              </button>
            )}

            {displayImages.length > 1 && (
              <div className={styles.lightboxCounter}>
                {activeImageIndex + 1} / {displayImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
