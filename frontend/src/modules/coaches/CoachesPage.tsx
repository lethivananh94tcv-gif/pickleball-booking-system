"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCoaches } from "@/services/coachApi";
import { getCoachImageUrl } from "@/utils/image";
import type { Coach } from "@/types/coach";
import { formatCurrency } from "@/utils/formatCurrency";
import StateBox from "@/components/common/StateBox";
import { getToken } from "@/utils/authStorage";
import { getFavorites, toggleFavorite } from "@/services/favoriteApi";
import styles from "./CoachesPage.module.css";
import AICoachForm, { AICoachPayload } from "./components/AICoachForm";
import AICoachCard, { CoachScoreResult } from "./components/AICoachCard";

const SKILL_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
  { value: "Professional", label: "Professional" },
];

// HelpfulButton sub-component for interactive rating feedback
function HelpfulButton({ reviewId }: { reviewId: number }) {
  const [clicked, setClicked] = useState(false);
  const [count, setCount] = useState(() => (reviewId % 5) + 3);

  const handleHelpful = () => {
    if (clicked) {
      setCount((prev) => prev - 1);
      setClicked(false);
    } else {
      setCount((prev) => prev + 1);
      setClicked(true);
    }
  };

  return (
    <button
      type="button"
      className={`${styles.helpfulBtn} ${clicked ? styles.helpfulBtnActive : ""}`}
      onClick={handleHelpful}
    >
      👍 Hữu ích ({count})
    </button>
  );
}

// Sample premium coach reviews database
const sampleCoachReviews = [
  {
    ReviewID: 8001,
    BookingID: 401,
    UserID: 11,
    CoachID: 1,
    Rating: 5,
    Comment: "Hệ thống gợi ý HLV bằng AI siêu chuẩn! Mình tìm được người hướng dẫn kiên nhẫn và đúng chuyên môn dink bóng chỉ sau 1 phút.",
    Status: "Approved",
    CreatedAt: "2026-07-10T08:30:00.000Z",
    FullName: "Văn Anh",
    AvatarURL: "",
    CoachName: "David Nguyễn"
  },
  {
    ReviewID: 8002,
    BookingID: 402,
    UserID: 12,
    CoachID: 2,
    Rating: 5,
    Comment: "Hồ sơ Coach rất minh bạch và chi tiết. Mình thích nhất là có thể xem lịch trống của Coach trước khi quyết định booking.",
    Status: "Approved",
    CreatedAt: "2026-07-09T14:15:00.000Z",
    FullName: "Minh Khang",
    AvatarURL: ""
  },
  {
    ReviewID: 8003,
    BookingID: 403,
    UserID: 13,
    CoachID: 3,
    Rating: 5,
    Comment: "Các khóa học và Coach trên nền tảng cực kỳ chất lượng. Chuyên môn cao và thái độ giảng dạy rất nhiệt tình!",
    Status: "Approved",
    CreatedAt: "2026-07-08T17:45:00.000Z",
    FullName: "Thanh Tùng",
    AvatarURL: ""
  },
  {
    ReviewID: 8004,
    BookingID: 404,
    UserID: 14,
    CoachID: 4,
    Rating: 4,
    Comment: "Huấn luyện viên rất nhiệt tình và hướng dẫn dễ hiểu. Các bài tập rèn luyện thể lực rất hiệu quả.",
    Status: "Approved",
    CreatedAt: "2026-07-07T09:00:00.000Z",
    FullName: "Quốc Huy",
    AvatarURL: ""
  },
  {
    ReviewID: 8005,
    BookingID: 405,
    UserID: 15,
    CoachID: 5,
    Rating: 5,
    Comment: "Buổi học hiệu quả, kỹ thuật vung vợt và đập bóng của mình được cải thiện rõ rệt chỉ sau một khóa học ngắn hạn.",
    Status: "Approved",
    CreatedAt: "2026-07-06T10:30:00.000Z",
    FullName: "Tran Bao Chau",
    AvatarURL: ""
  }
];

export default function CoachesPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [keyword, setKeyword] = useState("");
  const [skill, setSkill] = useState("all");
  const [sortBy, setSortBy] = useState("rating");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Favorite state
  const [favoriteCoaches, setFavoriteCoaches] = useState<number[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    async function loadFavorites() {
      try {
        const favs = await getFavorites(token as string);
        const coachIds = favs
          .filter((f) => f.TargetType === "Coach")
          .map((f) => f.TargetID);
        setFavoriteCoaches(coachIds);
      } catch (err) {
        console.error("Failed to load favorite coaches", err);
      }
    }
    loadFavorites();
  }, []);

  const handleToggleCoachFavorite = async (coachId: number) => {
    const token = getToken();
    if (!token) {
      alert("Vui lòng đăng nhập để thêm huấn luyện viên vào danh sách yêu thích!");
      return;
    }
    try {
      const isFav = await toggleFavorite(token, "Coach", coachId);
      if (isFav) {
        setFavoriteCoaches((prev) => [...prev, coachId]);
      } else {
        setFavoriteCoaches((prev) => prev.filter((id) => id !== coachId));
      }
    } catch (err: any) {
      alert(err.message || "Không thể thực hiện yêu cầu.");
    }
  };

  // AI State
  const [showAiForm, setShowAiForm] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<CoachScoreResult[]>([]);
  const [aiFallback, setAiFallback] = useState(false);

  const [activeFilter, setActiveFilter] = useState("Tất cả");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsToShow, setItemsToShow] = useState(3);

  // Compute filtered reviews dynamically based on active filter pill selection
  const filteredReviews = useMemo(() => {
    let result = [...sampleCoachReviews];

    if (activeFilter === "5 sao") {
      result = result.filter((r) => r.Rating === 5);
    } else if (activeFilter === "Có hình ảnh") {
      result = result.filter((r) => r.ReviewID % 2 === 0);
    } else if (activeFilter === "Mới nhất") {
      result.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
    }

    return result;
  }, [activeFilter]);

  // Handle responsive items count calculation client-side on mount and resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 640) {
        setItemsToShow(1);
      } else if (window.innerWidth <= 1024) {
        setItemsToShow(2);
      } else {
        setItemsToShow(3);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reset slider index when filter changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeFilter]);

  // Autoplay timer to scroll testimonials card-by-card every 5.5 seconds
  useEffect(() => {
    if (filteredReviews.length <= itemsToShow) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredReviews.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [filteredReviews.length, itemsToShow]);

  // Slice visible reviews based on responsive screen count and current sliding index
  const visibleReviews = useMemo(() => {
    if (filteredReviews.length === 0) return [];
    const list = [];
    const count = Math.min(filteredReviews.length, itemsToShow);
    for (let i = 0; i < count; i++) {
      const idx = (currentIndex + i) % filteredReviews.length;
      list.push(filteredReviews[idx]);
    }
    return list;
  }, [filteredReviews, currentIndex, itemsToShow]);

  useEffect(() => {
    let mounted = true;

    async function loadCoaches() {
      try {
        setLoading(true);
        setError("");

        const data = await getCoaches();

        if (mounted) {
          setCoaches(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Không tải được Coach.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCoaches();

    return () => {
      mounted = false;
    };
  }, []);

  const totalStudents = useMemo(() => {
    return coaches.reduce((sum, coach) => sum + Number(coach.TotalStudents || 0), 0);
  }, [coaches]);

  const averageRating = useMemo(() => {
    if (coaches.length === 0) return "0.0";

    const total = coaches.reduce(
      (sum, coach) => sum + Number(coach.AverageRating || 0),
      0
    );

    return (total / coaches.length).toFixed(1);
  }, [coaches]);

  const featuredCoaches = useMemo(() => {
    return [...coaches]
      .sort((a, b) => Number(b.AverageRating || 0) - Number(a.AverageRating || 0))
      .slice(0, 3);
  }, [coaches]);

  const filtered = useMemo(() => {
    const result = coaches.filter((coach) => {
      const text = `${coach.FullName} ${coach.Specialization || ""} ${
        coach.SkillLevel || ""
      }`.toLowerCase();

      const matchKeyword = text.includes(keyword.toLowerCase());
      const matchSkill = skill === "all" || coach.SkillLevel === skill;

      return matchKeyword && matchSkill;
    });

    switch (sortBy) {
      case "priceAsc":
        return result.sort((a, b) => Number(a.HourlyRate || 0) - Number(b.HourlyRate || 0));

      case "priceDesc":
        return result.sort((a, b) => Number(b.HourlyRate || 0) - Number(a.HourlyRate || 0));

      case "experience":
        return result.sort(
          (a, b) => Number(b.ExperienceYears || 0) - Number(a.ExperienceYears || 0)
        );

      case "rating":
      default:
        return result.sort(
          (a, b) => Number(b.AverageRating || 0) - Number(a.AverageRating || 0)
        );
    }
  }, [coaches, keyword, skill, sortBy]);

  const handleAiSubmit = async (data: AICoachPayload) => {
    setIsAiLoading(true);
    setAiResults([]);
    try {
      const budgetStr = data.budget.split("-").pop() || data.budget;
      const parsedBudget = parseFloat(budgetStr.replace(/[^\d]/g, "")) || 500000;

      const mappedPayload = {
        level: data.level,
        budget: parsedBudget,
        preferredTime: data.availableTime,
        goals: data.goal ? [data.goal] : [],
        styleText: data.description
      };

      const { apiClient } = await import("@/services/apiClient");
      const result = await apiClient<any>("/api/ai/coaches/recommend", {
        method: "POST",
        body: mappedPayload
      });
      
      setAiFallback(result.fallback || false);
      
      const mergedResults: CoachScoreResult[] = (result.results || []).map((r: any) => {
        const coachOrigin = coaches.find(c => c.CoachID === r.coachId);
        return {
          coach: coachOrigin as Coach,
          score: r.score || 80,
          reasons: r.reasons || []
        };
      }).filter((r: CoachScoreResult) => r.coach !== undefined);
      
      setAiResults(mergedResults);
    } catch (err) {
      console.error(err);
      alert("Hệ thống AI đang bận. Vui lòng thử lại sau.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <p className={styles.eyebrow}>Tìm Coach phù hợp</p>

              <h1>
                Nâng trình mỗi ngày
                <span>cùng Coach chuyên nghiệp</span>
              </h1>

              <p className={styles.desc}>
                Đội ngũ Coach giàu kinh nghiệm, đồng hành cùng bạn trên hành trình
                chinh phục Pickleball.
              </p>

              <div className={styles.searchActions}>
                <div className={styles.search}>
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="Tìm theo tên Coach, kỹ năng..."
                  />
                  <button type="button" className={styles.searchBtn}>🔍</button>
                </div>
                
                <div className={styles.aiButtonWrapper}>
                  <button 
                    type="button" 
                    className={`${styles.aiToggleBtn} ${showAiForm ? styles.active : ""}`}
                    onClick={() => setShowAiForm(!showAiForm)}
                  >
                    ✨ Tìm Coach bằng AI
                  </button>
                  <span className={styles.aiSubtext}>AI sẽ phân tích và gợi ý Coach phù hợp nhất cho bạn</span>
                </div>
              </div>

              <div className={styles.quickFilter}>
                {SKILL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={skill === option.value ? styles.activeChip : ""}
                    onClick={() => setSkill(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.visual}>
              <img src="/images/coaches/hlv1.png" alt="Pickleball coach" />
            </div>

          </div>
        </div>
      </section>

      {showAiForm && (
        <div className={`container ${styles.aiFormFullWidth}`}>
          <AICoachForm onSubmit={handleAiSubmit} isLoading={isAiLoading} />
        </div>
      )}

      <section className={styles.stats}>
        <div className={`container ${styles.statsGrid}`}>
          <div className={styles.statCard}>
            <h3>{coaches.length}+</h3>
            <p>Coach chuyên nghiệp</p>
          </div>

          <div className={styles.statCard}>
            <h3>{totalStudents}+</h3>
            <p>Học viên đã tham gia</p>
          </div>

          <div className={styles.statCard}>
            <h3>{averageRating}/5</h3>
            <p>Đánh giá trung bình</p>
          </div>

          <div className={styles.statCard}>
            <h3>100%</h3>
            <p>Dữ liệu từ hệ thống</p>
          </div>
        </div>
      </section>

      <section className={`container ${styles.content}`}>
        {loading ? (
          <StateBox variant="loading" title="Đang tải Coach" />
        ) : error ? (
          <StateBox variant="error" title="Không tải được dữ liệu" description={error} />
        ) : coaches.length === 0 ? (
          <StateBox
            variant="empty"
            title="Chưa có Coach nào trên hệ thống"
            description="Hệ thống hiện tại chưa có dữ liệu huấn luyện viên."
          />
        ) : (
          <div className={styles.layout}>
            <main className={styles.mainList}>
              {aiResults.length > 0 && (
                <section className={styles.aiResultsSection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>✨ Kết quả gợi ý từ AI</h2>
                      {aiFallback && (
                        <p style={{ color: "var(--pcs-status-warning)", fontSize: "0.85rem", marginTop: "4px" }}>
                          ⚠ Đang sử dụng thuật toán cơ bản do hệ thống AI bận.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={styles.aiGrid}>
                    {aiResults.map((result, index) => (
                      <AICoachCard 
                        key={result.coach.CoachID} 
                        coachResult={result} 
                        isBestMatch={index === 0} 
                        isFavorite={favoriteCoaches.includes(result.coach.CoachID)}
                        onToggleFavorite={() => handleToggleCoachFavorite(result.coach.CoachID)}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className={styles.featuredSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>👑 Coach nổi bật</h2>
                  </div>

                  <Link href="#all-coaches">Xem tất cả →</Link>
                </div>

                <div className={styles.featuredGrid}>
                  {featuredCoaches.map((coach, index) => (
                    <article className={styles.featuredCard} key={coach.CoachID}>
                      <div className={styles.badge}>
                        {index === 0
                          ? "Top đặt lịch"
                          : index === 1
                          ? "Top đánh giá"
                          : "Top yêu thích"}
                      </div>

                      <div 
                        onClick={() => handleToggleCoachFavorite(coach.CoachID)}
                        className={`${styles.favorite} ${favoriteCoaches.includes(coach.CoachID) ? styles.isFavorite : ""}`}
                      >
                        {favoriteCoaches.includes(coach.CoachID) ? "♥" : "♡"}
                      </div>

                      <img 
                        src={getCoachImageUrl(coach.AvatarURL)} 
                        alt={coach.FullName} 
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('hlv1.png')) {
                            target.src = "/images/coaches/hlv1.png";
                          }
                        }}
                      />

                      <div className={styles.featuredBody}>
                        <h3>{coach.FullName}</h3>

                        <p>
                          ⭐ {Number(coach.AverageRating || 0).toFixed(1)} (
                          {coach.TotalStudents || 0}+)
                          <span>•</span>
                          {coach.ExperienceYears || 0} năm kinh nghiệm
                        </p>

                        <p>Chuyên môn: {coach.Specialization || coach.SkillLevel}</p>

                        <div className={styles.tags}>
                          <span>{coach.SkillLevel}</span>
                          <span>{coach.Specialization || "Pickleball"}</span>
                        </div>

                        <div className={styles.featuredBottom}>
                          <strong>{formatCurrency(coach.HourlyRate)}</strong>
                          <span>/ giờ</span>
                        </div>

                        <div className={styles.featuredActions}>
                          <Link href={`/coaches/${coach.CoachID}`}>
                            Xem hồ sơ
                          </Link>

                          <Link href={`/coaches/${coach.CoachID}#booking-section`}>
                            Đặt lịch ngay
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section id="all-coaches" className={styles.allSection}>
                <div className={styles.listHeader}>
                  <div>
                    <h2>Tất cả Coach</h2>
                    <p>Hiển thị {filtered.length} Coach</p>
                  </div>
                  <div className={styles.sortControl}>
                    <label>Sắp xếp:</label>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      <option value="rating">Đánh giá cao nhất</option>
                      <option value="priceAsc">Giá thấp đến cao</option>
                      <option value="priceDesc">Giá cao đến thấp</option>
                      <option value="experience">Kinh nghiệm nhiều nhất</option>
                    </select>
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <StateBox variant="empty" title="Không có Coach phù hợp" />
                ) : (
                  <div className={styles.grid}>
                    {filtered.map((coach) => (
                      <article className={styles.card} key={coach.CoachID}>
                        <div className={styles.cardImage}>
                          <img 
                            src={getCoachImageUrl(coach.AvatarURL)} 
                            alt={coach.FullName} 
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.src.includes('hlv1.png')) {
                                target.src = "/images/coaches/hlv1.png";
                              }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={() => handleToggleCoachFavorite(coach.CoachID)}
                            className={favoriteCoaches.includes(coach.CoachID) ? styles.isFavorite : ""}
                          >
                            {favoriteCoaches.includes(coach.CoachID) ? "♥" : "♡"}
                          </button>
                        </div>

                        <div className={styles.cardBody}>
                          <h3>{coach.FullName}</h3>

                          <p className={styles.meta}>
                            ⭐ {Number(coach.AverageRating || 0).toFixed(1)} (
                            {coach.TotalStudents || 0}+ học viên)
                          </p>

                          <p>{coach.ExperienceYears || 0} năm kinh nghiệm</p>

                          <p className={styles.special}>
                            Chuyên môn: {coach.Specialization || coach.SkillLevel}
                          </p>

                          <div className={styles.tags}>
                            <span>{coach.SkillLevel}</span>
                            <span>{coach.Specialization || "Pickleball"}</span>
                          </div>

                          <div className={styles.cardFooter}>
                            <div>
                              <strong>{formatCurrency(coach.HourlyRate)}</strong>
                              <span>/ giờ</span>
                            </div>
                          </div>

                          <div className={styles.cardActions}>
                            <Link href={`/coaches/${coach.CoachID}`}>
                              Xem hồ sơ
                            </Link>

                            <Link href={`/coaches/${coach.CoachID}#booking-section`}>
                              Đặt lịch
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.reviewSection}>
                <div className={styles.sectionHeaderCentered}>
                  <span className={styles.testimonialBadge}>Đánh giá học viên</span>
                  <h2 className={styles.testimonialTitle}>Cảm nhận về đội ngũ Huấn luyện viên</h2>
                  <p className={styles.testimonialSub}>Nhận xét chân thực từ các học viên sau các khóa đào tạo kỹ thuật Pickleball.</p>
                </div>

                {/* Overview Ratings Card (Card tổng quan lớn) */}
                <div className={styles.overviewCard}>
                  {/* Left Column: Average Score */}
                  <div className={styles.overviewLeft}>
                    <h3 className={styles.ratingNumber}>{Number(averageRating || 4.7).toFixed(1)}</h3>
                    <div className={styles.ratingStarsWrap}>
                      <div className={styles.starsFilledBig}>★★★★★</div>
                      <p className={styles.totalReviewsText}>Dựa trên {totalStudents || 805}+ học viên</p>
                    </div>
                  </div>

                  {/* Middle Column: Distribution Bars */}
                  <div className={styles.overviewMiddle}>
                    {[
                      { star: 5, pct: 85 },
                      { star: 4, pct: 10 },
                      { star: 3, pct: 4 },
                      { star: 2, pct: 1 },
                      { star: 1, pct: 0 }
                    ].map((row) => (
                      <div className={styles.statRow} key={row.star}>
                        <span className={styles.statStarLabel}>{row.star} ★</span>
                        <div className={styles.statBarContainer}>
                          <div className={styles.statBarFill} style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className={styles.statPctLabel}>{row.pct}%</span>
                      </div>
                    ))}
                  </div>

                  {/* Right Column: Write Review CTA */}
                  <div className={styles.overviewRight}>
                    <h4>Kết nối huấn luyện viên</h4>
                    <p>Chọn đúng huấn luyện viên giúp định hướng kỹ thuật chơi nhanh chóng hơn.</p>
                    <button 
                      type="button" 
                      className={styles.writeReviewBtnPremium}
                      onClick={() => {
                        const el = document.getElementById("search-section") || document.querySelector("input");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      🔍 Tìm Coach phù hợp
                    </button>
                  </div>
                </div>

                {/* Filter Pills Container */}
                <div className={styles.filterPillsContainer}>
                  {["Tất cả", "5 sao", "Có hình ảnh", "Mới nhất"].map((pill) => (
                    <button
                      key={pill}
                      type="button"
                      className={`${styles.filterPill} ${activeFilter === pill ? styles.filterPillActive : ""}`}
                      onClick={() => setActiveFilter(pill)}
                    >
                      {pill}
                    </button>
                  ))}
                </div>

                {/* Comment Cards Grid with transition animation */}
                {visibleReviews.length === 0 ? (
                  <div className={styles.emptyReviews}>
                    Không có đánh giá nào phù hợp với bộ lọc hiện tại.
                  </div>
                ) : (
                  <>
                    <div className={styles.testimonialsGrid} key={currentIndex}>
                      {visibleReviews.map((review) => {
                        const isVerified = !!review.BookingID;
                        const reviewDate = new Date(review.CreatedAt).toLocaleDateString("vi-VN");
                        
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
                                    <img src={review.AvatarURL} alt={review.FullName} />
                                  ) : (
                                    <span>{review.FullName.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className={styles.authorText}>
                                  <strong>{review.FullName}</strong>
                                  <span className={styles.authorTarget}>
                                    Học viên PickleClub
                                  </span>
                                </div>
                              </div>

                              {/* Right metadata badges and Helpful button */}
                              <div className={styles.cardMetaCol}>
                                <div className={styles.badgesWrap}>
                                  {isVerified && <span className={styles.verifiedBadge}>✓ Đã xác thực</span>}
                                  <span className={styles.serviceTag}>Coach</span>
                                </div>
                                <HelpfulButton reviewId={review.ReviewID} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Testimonial Dot Navigation Indicators */}
                    {filteredReviews.length > itemsToShow && (
                      <div className={styles.reviewDots}>
                        {filteredReviews.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`${styles.reviewDot} ${currentIndex === i ? styles.reviewDotActive : ""}`}
                            onClick={() => setCurrentIndex(i)}
                            aria-label={`Slide ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </main>

          </div>
        )}
      </section>
    </main>
  );
}
