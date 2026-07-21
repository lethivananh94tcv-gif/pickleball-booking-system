import React, { useState } from "react";
import styles from "./ReviewList.module.css";
import { Review } from "@/types/review";

interface ReviewListProps {
  reviews: Review[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function HelpfulButton({ reviewId }: { reviewId: number }) {
  const [likes, setLikes] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`review_likes_${reviewId}`);
      if (saved) return parseInt(saved);
    }
    return Math.floor((reviewId * 7) % 12) + 2;
  });
  const [clicked, setClicked] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`review_liked_${reviewId}`) === "true";
    }
    return false;
  });

  const handleHelpfulClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clicked) {
      const newLikes = Math.max(0, likes - 1);
      setLikes(newLikes);
      setClicked(false);
      localStorage.setItem(`review_likes_${reviewId}`, String(newLikes));
      localStorage.removeItem(`review_liked_${reviewId}`);
    } else {
      const newLikes = likes + 1;
      setLikes(newLikes);
      setClicked(true);
      localStorage.setItem(`review_likes_${reviewId}`, String(newLikes));
      localStorage.setItem(`review_liked_${reviewId}`, "true");
    }
  };

  return (
    <button
      type="button"
      className={`${styles.helpfulBtn} ${clicked ? styles.helpfulBtnActive : ""}`}
      onClick={handleHelpfulClick}
    >
      Hữu ích ({likes})
    </button>
  );
}

export default function ReviewList({ reviews, loading, page, totalPages, onPageChange }: ReviewListProps) {
  if (loading) {
    return (
      <div className={styles.skeletonContainer}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeletonCard}>
            <div className={styles.skeletonLine} style={{ width: "30%", height: "16px" }} />
            <div className={styles.skeletonLine} style={{ width: "90%", height: "24px", marginTop: "12px" }} />
            <div className={styles.skeletonLine} style={{ width: "60%", height: "14px", marginTop: "8px" }} />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Chưa có đánh giá nào.</p>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      <div className={styles.premiumReviewsGrid}>
        {reviews.map((review) => {
          const isVerified = !!review.BookingID;
          const reviewDate = new Date(review.CreatedAt).toLocaleDateString("vi-VN");
          const isCoachReview = !!review.CoachID;

          return (
            <div className={styles.premiumReviewCard} key={review.ReviewID}>
              {/* Top Accent Gradient Line */}
              <div className={styles.cardAccentLine} />

              <div className={styles.cardHeaderRow}>
                <div className={styles.cardStars}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={i < review.Rating ? styles.starGold : styles.starGray}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className={styles.cardDate}>{reviewDate}</span>
              </div>

              {/* Decorative quote mark */}
              <span className={styles.quoteMark}>“</span>

              <p className={styles.premiumReviewComment}>
                {review.Comment}
              </p>

              <div className={styles.cardFooterRow}>
                <div className={styles.authorInfo}>
                  <div className={styles.authorAvatar}>
                    {review.AvatarURL ? (
                      <img src={review.AvatarURL} alt={review.FullName || "User"} />
                    ) : (
                      <span>{(review.FullName || "U").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles.authorText}>
                    <strong>{review.FullName || "Người dùng"}</strong>
                    <span className={styles.authorTarget}>
                      Học viên PickleClub
                    </span>
                  </div>
                </div>

                {/* Right metadata badges and Helpful button */}
                <div className={styles.cardMetaCol}>
                  <div className={styles.badgesWrap}>
                    {isVerified && <span className={styles.verifiedBadge}>✓ Đã xác thực</span>}
                    <span className={styles.serviceTag}>
                      {isCoachReview ? "Coach" : "Đặt sân"}
                    </span>
                  </div>
                  <HelpfulButton reviewId={review.ReviewID} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button 
            disabled={page === 1} 
            onClick={() => onPageChange(page - 1)}
            className={styles.pageBtn}
          >
            Trước
          </button>
          <span className={styles.pageInfo}>Trang {page} / {totalPages}</span>
          <button 
            disabled={page === totalPages} 
            onClick={() => onPageChange(page + 1)}
            className={styles.pageBtn}
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
