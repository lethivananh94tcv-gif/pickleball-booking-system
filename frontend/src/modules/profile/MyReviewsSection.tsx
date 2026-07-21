import React, { useEffect, useState } from "react";
import { reviewApi } from "@/services/reviewApi";
import type { Review } from "@/types/review";
import ReviewList from "@/components/reviews/ReviewList";
import styles from "./MyReviewsSection.module.css";
import { getToken } from "@/utils/authStorage";

export default function MyReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchReviews() {
      const token = getToken();
      if (!token) return;

      try {
        setLoading(true);
        // Note: reviewApi needs to support token if it's an authenticated request.
        // Assuming the apiClient automatically attaches the token from local storage.
        const data = await reviewApi.getMyReviews(page, 5, token);
        setReviews(data.data);
        setTotalPages(data.totalPages);
      } catch (err) {
        console.error("Failed to load my reviews");
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, [page]);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2>Đánh giá của tôi</h2>
          <p>Lịch sử các đánh giá bạn đã viết</p>
        </div>
      </div>
      <div className={styles.content}>
        <ReviewList
          reviews={reviews}
          loading={loading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </section>
  );
}
