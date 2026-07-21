"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { tournamentApi, Tournament, TournamentDivision } from "@/services/tournamentApi";
import { getUser } from "@/utils/authStorage";
import "../tournaments.css";

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [divisionsMap, setDivisionsMap] = useState<Record<number, TournamentDivision[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [skillFilter, setSkillFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Hero Slides Carousel - Dynamically matches fetched tournaments from API
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const heroSlides = useMemo(() => {
    const bannerImages = [
      "/images/tournament_banner_2026_4_3.jpg",
      "/images/summer_cup_banner.png",
      "/images/tournament_banner_2026.png"
    ];

    if (tournaments.length === 0) {
      // Fallback preview slides if database list is empty or loading
      return [
        {
          title: <>GIẢI ĐẤU <br /><span>PICKLEBALL</span> <br />QUỐC GIA 2026</>,
          season: "SEASON 2026 • OPEN",
          desc: "Khởi động chiến dịch tranh tài lớn nhất năm cùng PickleClub. Nâng cao thứ hạng DUPR, cọ xát đỉnh cao cùng các vận động viên chuyên nghiệp và chinh phục ngôi vị vô địch quốc gia.",
          image: bannerImages[0],
          primaryBtnText: "Khám phá giải đấu",
          href: "#tournament-list-section"
        },
        {
          title: <>HÀ NỘI <br /><span>SUMMER OPEN</span> <br />CUP 2026</>,
          season: "SUMMER 2026 • CHAMPIONSHIP",
          desc: "Giải đấu mùa hè sôi động quy tụ các tay vợt hàng đầu tranh tài tại hệ thống sân ngoài trời chuẩn quốc tế của PickleClub.",
          image: bannerImages[1],
          primaryBtnText: "Đăng ký ngay",
          href: "#featured-tournament-section"
        },
        {
          title: <>PICKLECLUB <br /><span>CHAMPIONSHIP</span> <br />SERIES</>,
          season: "SERIES 2026 • DUPR RATED",
          desc: "Chuỗi giải đấu tính điểm DUPR chính thức định kỳ. Cơ hội cọ xát chuyên nghiệp và khẳng định thứ hạng của bạn.",
          image: bannerImages[2],
          primaryBtnText: "Xem bảng đấu",
          href: "#featured-tournament-section"
        }
      ];
    }

    // Map actual active tournaments dynamically to slides (up to 4)
    return tournaments.slice(0, 4).map((t, idx) => {
      const words = t.TournamentName.split(" ");
      let titleElement = <>{t.TournamentName}</>;
      if (words.length > 2) {
        const mid = Math.ceil(words.length / 2);
        titleElement = (
          <>
            {words.slice(0, mid).join(" ")} <br />
            <span>{words.slice(mid).join(" ")}</span>
          </>
        );
      }

      const isOpen = t.Status === "Open" || t.Status === "Published";
      const statusText = isOpen ? "Đăng ký tham gia ➜" : "Xem chi tiết giải ➜";
      const seasonText = `PC-SEASON 2026 • ${t.Status === "Open" ? "OPENING" : t.Status.toUpperCase()}`;

      return {
        title: titleElement,
        season: seasonText,
        desc: t.Description || `Giải đấu Pickleball ${t.TournamentName} chính thức khởi tranh tại ${t.Location}. Tranh tài hấp dẫn cùng hàng chục cặp vận động viên chuyên nghiệp.`,
        image: t.ImageURL || (t as any).BannerUrl || (t as any).bannerUrl || bannerImages[idx % 3],
        primaryBtnText: statusText,
        href: `/tournaments/${t.TournamentID}`
      };
    });
  }, [tournaments]);

  const nextHeroSlide = () => {
    setActiveHeroIndex((prev) => (prev + 1) % heroSlides.length);
  };

  const prevHeroSlide = () => {
    setActiveHeroIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  // Auto-play slides every 5.5 seconds
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    // Check Admin authorization from localStorage
    const currentUser = getUser();
    if (currentUser) {
      const role = String(currentUser.RoleName || currentUser.role || currentUser.roles?.[0] || "").toLowerCase();
      setIsAdmin(role.includes("admin"));
    }

    tournamentApi
      .getTournaments()
      .then(async (data) => {
        // Active tournaments for player view (including Completed, excluding Draft and Cancelled)
        const activeTourns = data.filter((t) => t.Status !== "Draft" && t.Status !== "Cancelled");
        setTournaments(activeTourns);

        // Fetch divisions for each tournament to show metadata tags
        const divPromises = activeTourns.map(async (t) => {
          try {
            const divs = await tournamentApi.getDivisions(t.TournamentID);
            return { id: t.TournamentID, divs };
          } catch {
            return { id: t.TournamentID, divs: [] };
          }
        });

        const resolvedDivs = await Promise.all(divPromises);
        const newMap: Record<number, TournamentDivision[]> = {};
        for (const item of resolvedDivs) {
          newMap[item.id] = item.divs;
        }
        setDivisionsMap(newMap);
      })
      .catch((err) => {
        console.error(err);
        setError("Không thể tải danh sách giải đấu. Vui lòng thử lại sau.");
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Chưa cập nhật";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Chưa cập nhật";
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
      case "Published":
        return <span className="tm-badge tm-badge-published">Đang mở đăng ký</span>;
      case "Closed":
        return <span className="tm-badge tm-badge-closed">Đóng đăng ký</span>;
      case "Ongoing":
        return <span className="tm-badge" style={{ background: "#dbeafe", color: "#1e40af", borderColor: "#bfdbfe", padding: "4px 12px", fontSize: "0.75rem", fontWeight: "600", borderRadius: "9999px", border: "1px solid" }}>Đang diễn ra</span>;
      case "Completed":
        return <span className="tm-badge" style={{ background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1", padding: "4px 12px", fontSize: "0.75rem", fontWeight: "600", borderRadius: "9999px", border: "1px solid" }}>Đã kết thúc</span>;
      case "Cancelled":
        return <span className="tm-badge tm-badge-cancelled">Đã hủy</span>;
      default:
        return <span className="tm-badge tm-badge-draft">{status}</span>;
    }
  };

  // Filter Logic
  const filtered = tournaments.filter((t) => {
    // Search keyword
    const matchKeyword =
      t.TournamentName.toLowerCase().includes(search.toLowerCase()) ||
      t.Location.toLowerCase().includes(search.toLowerCase());
    
    // Status
    let matchStatus = false;
    if (statusFilter === "ALL") {
      matchStatus = true;
    } else if (statusFilter === "RegistrationClosed" || statusFilter === "Closed") {
      matchStatus = t.Status === "RegistrationClosed" || t.Status === "Closed";
    } else {
      matchStatus = t.Status === statusFilter;
    }

    // Divisions properties
    const tDivs = divisionsMap[t.TournamentID] || [];
    
    // Format
    const matchFormat =
      formatFilter === "ALL" ||
      tDivs.some((d) => d.CompetitionFormat === formatFilter);

    // Skill level
    const matchSkill =
      skillFilter === "ALL" ||
      tDivs.some((d) => {
        if (skillFilter === "Under4.0") return (d.MaxDUPR || 0) < 4.0;
        if (skillFilter === "Above4.0") return (d.MinDUPR || 0) >= 4.0;
        return true;
      });

    // Date
    const matchDate =
      !dateFilter ||
      new Date(t.StartDate) >= new Date(dateFilter);

    return matchKeyword && matchStatus && matchFormat && matchSkill && matchDate;
  });

  const featuredTournament = filtered.find((t) => t.Status === "Open" || t.Status === "Published");

  return (
    <div className="tm-body min-h-screen pb-16">
      {/* Hero Banner Section */}
      <div className="tm-hero-custom">
        {/* Editorial Background Layers */}
        <div className="tm-hero-bg-glow"></div>
        <div className="tm-hero-bg-lines"></div>
        <div className="tm-hero-bg-mesh"></div>
        <div className="tm-hero-watermark">2026</div>
        <div className="tm-hero-watermark-sub">PICKLEBALL CHAMPIONSHIP</div>

        {/* Carousel Navigation Arrows */}
        {heroSlides.length > 1 && (
          <>
            <button className="tm-hero-arrow tm-hero-arrow-prev" onClick={prevHeroSlide} aria-label="Previous Slide">
              ‹
            </button>
            <button className="tm-hero-arrow tm-hero-arrow-next" onClick={nextHeroSlide} aria-label="Next Slide">
              ›
            </button>
          </>
        )}

        <div className="container tm-hero-container tm-hero-container-animate" key={activeHeroIndex}>
          <div className="tm-hero-left">
            <span className="tm-season-badge">{heroSlides[activeHeroIndex]?.season}</span>
            <h1 className="tm-hero-main-title">
              {heroSlides[activeHeroIndex]?.title}
            </h1>
            <p className="tm-hero-desc">
              {heroSlides[activeHeroIndex]?.desc}
            </p>
            <div className="tm-hero-buttons-container">
              {heroSlides[activeHeroIndex]?.href?.startsWith("#") ? (
                <button 
                  onClick={() => {
                    const el = document.getElementById(heroSlides[activeHeroIndex].href.replace("#", ""));
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="tm-hero-btn tm-hero-btn-primary" 
                >
                  {heroSlides[activeHeroIndex]?.primaryBtnText}
                </button>
              ) : (
                <Link 
                  href={heroSlides[activeHeroIndex]?.href || "/"}
                  className="tm-hero-btn tm-hero-btn-primary flex items-center justify-center" 
                >
                  {heroSlides[activeHeroIndex]?.primaryBtnText}
                </Link>
              )}
              <button 
                onClick={() => {
                  const el = document.getElementById("featured-tournament-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="tm-hero-btn tm-hero-btn-secondary" 
              >
                Xem giải nổi bật
              </button>
            </div>
          </div>
          <div className="tm-hero-right" onClick={nextHeroSlide} style={{ cursor: "pointer" }} title="Click để chuyển giải đấu khác">
            {/* Dynamic athlete container overlapping banner boundaries */}
            <div className="tm-hero-athlete-container">
              <div className="tm-hero-glow-lime"></div>
              <div className="tm-hero-angle-shard-1"></div>
              <div className="tm-hero-angle-shard-2"></div>
              <div className="tm-hero-img-wrap">
                <img 
                  src={heroSlides[activeHeroIndex]?.image} 
                  alt="Pickleball 2026" 
                  className="tm-hero-img"
                />
              </div>
              <div className="tm-hero-slide-hint">
                Chuyển giải khác ➜
              </div>
            </div>
          </div>
        </div>

        {/* Slide navigation dots */}
        <div className="tm-hero-dots">
          {heroSlides.map((_, idx) => (
            <button 
              key={idx} 
              className={`tm-hero-dot ${idx === activeHeroIndex ? "active" : ""}`}
              onClick={() => setActiveHeroIndex(idx)}
            />
          ))}
        </div>
      </div>

      <div className="container tm-main-content">
        
        {/* Featured Tournament Card Section */}
        {featuredTournament && (
          <div id="featured-tournament-section" className="tm-featured-container">
            <div className="tm-featured-grid">
              {/* Left Column: Information */}
              <div className="tm-featured-left">
                <div>
                  <div className="tm-featured-header">
                    <span className="tm-featured-star">★</span>
                    <span className="tm-featured-subtitle">
                      GIẢI ĐẤU NỔI BẬT
                    </span>
                  </div>
                  
                  <h2 className="tm-featured-title">
                    {featuredTournament.TournamentName}
                  </h2>
                  
                  <p className="tm-featured-desc">
                    {featuredTournament.Description || "Giải đấu quy tụ những vận động viên xuất sắc nhất khu vực, với giải thưởng lớn. Hệ thống tính điểm DUPR chuẩn quốc tế."}
                  </p>
                  
                  {/* Specs Grid */}
                  <div className="tm-featured-specs">
                    <div className="tm-featured-spec-item">
                      <div className="tm-featured-spec-icon">📍</div>
                      <div>
                        <div className="tm-featured-spec-label">Địa điểm</div>
                        <div className="tm-featured-spec-value">{featuredTournament.Location}</div>
                      </div>
                    </div>
                    <div className="tm-featured-spec-item">
                      <div className="tm-featured-spec-icon">📅</div>
                      <div>
                        <div className="tm-featured-spec-label">Thời gian</div>
                        <div className="tm-featured-spec-value">{formatDate(featuredTournament.StartDate)} - {formatDate(featuredTournament.EndDate)}</div>
                      </div>
                    </div>
                    <div className="tm-featured-spec-item">
                      <div className="tm-featured-spec-icon tm-featured-spec-icon-red">⏰</div>
                      <div>
                        <div className="tm-featured-spec-label">Hạn đăng ký</div>
                        <div className="tm-featured-spec-value tm-featured-spec-value-red">{formatDate(featuredTournament.RegistrationEnd)}</div>
                      </div>
                    </div>
                    <div className="tm-featured-spec-item">
                      <div className="tm-featured-spec-icon">👥</div>
                      <div>
                        <div className="tm-featured-spec-label">Nội dung</div>
                        <div className="tm-featured-spec-value">
                          {divisionsMap[featuredTournament.TournamentID]?.map(d => d.DivisionName).join(", ") || "Đơn & Đôi Nam/Nữ"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer of Left Column */}
                <div className="tm-featured-footer">
                  <div className="tm-featured-tags">
                    <span className="tm-featured-tag">DUPR 3.0+</span>
                    <span className="tm-featured-tag">OPEN</span>
                    <span className="tm-featured-tag">U35</span>
                  </div>
                  <Link 
                    href={`/tournaments/${featuredTournament.TournamentID}`} 
                    className="tm-hero-btn tm-hero-btn-primary tm-featured-btn" 
                  >
                    Đăng ký ngay
                  </Link>
                </div>
              </div>

              {/* Right Column: Image */}
              <div className="tm-featured-right">
                <img 
                  src={featuredTournament.ImageURL || "/images/tournament_banner_2026_4_3.jpg"} 
                  alt="Featured Tournament" 
                  className="tm-featured-img"
                />
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div id="tournament-list-section" className="tm-filter-container">
          {/* Search Input Row */}
          <div className="tm-filter-search-row">
            <div className="tm-filter-search-box">
              <span className="tm-filter-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Tìm kiếm tên giải đấu hoặc địa điểm..."
                className="tm-filter-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isAdmin && (
              <Link href="/admin/tournaments" className="tm-btn tm-btn-accent tm-filter-admin-btn">
                ⚙️ Bảng Quản Trị
              </Link>
            )}
          </div>

          {/* Selector Filters Row */}
          <div className="tm-filter-dropdowns-grid">
            <div className="tm-filter-group">
              <label className="tm-filter-label">Trạng thái</label>
              <select className="tm-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Open">Đang mở đăng ký</option>
                <option value="RegistrationClosed">Đã đóng đăng ký</option>
                <option value="Ongoing">Đang diễn ra</option>
                <option value="Completed">Đã kết thúc</option>
              </select>
            </div>
            <div className="tm-filter-group">
              <label className="tm-filter-label">Hình thức đấu</label>
              <select className="tm-filter-select" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
                <option value="ALL">Tất cả hình thức</option>
                <option value="MenSingles">Đơn Nam</option>
                <option value="WomenSingles">Đơn Nữ</option>
                <option value="MenDoubles">Đôi Nam</option>
                <option value="WomenDoubles">Đôi Nữ</option>
                <option value="MixedDoubles">Đôi Nam Nữ</option>
              </select>
            </div>
            <div className="tm-filter-group">
              <label className="tm-filter-label">Trình độ DUPR</label>
              <select className="tm-filter-select" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}>
                <option value="ALL">Tất cả trình độ</option>
                <option value="Under4.0">Dưới 4.0 DUPR</option>
                <option value="Above4.0">Từ 4.0 DUPR trở lên</option>
              </select>
            </div>
            <div className="tm-filter-group">
              <label className="tm-filter-label">Từ ngày</label>
              <input type="date" className="tm-filter-input-date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
            <div className="tm-filter-reset-wrapper">
              <button 
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setFormatFilter("ALL");
                  setSkillFilter("ALL");
                  setDateFilter("");
                }}
                className="tm-filter-reset-btn" 
              >
                🔄 Đặt lại bộ lọc
              </button>
            </div>
          </div>
        </div>

        {/* Results count indicator */}
        {!loading && (
          <span className="tm-filter-results-count">
            Tìm thấy {filtered.length} giải đấu
          </span>
        )}

        {error && (
          <div className="tm-state-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="tm-state-container">
            <div className="tm-spinner"></div>
            <p className="tm-card-description">Đang tải danh sách giải đấu...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="tm-state-empty">
            <p>Không tìm thấy giải đấu nào phù hợp với bộ lọc.</p>
          </div>
        ) : (
          <div className="tm-grid">
            {filtered.map((t) => {
              const tournDivs = divisionsMap[t.TournamentID] || [];
              const minFee = tournDivs.length > 0 ? Math.min(...tournDivs.map(d => d.RegistrationFee)) : 0;
              const isOpen = t.Status === "Open" || t.Status === "Published";
              const isOngoing = t.Status === "Ongoing";

              // Dynamic banner background illustration index
              const bannerImages = [
                "/images/tournament_banner_2026_4_3.jpg",
                "/images/summer_cup_banner.png",
                "/images/tournament_banner_2026.png"
              ];
              const bannerSrc = t.ImageURL || (t as any).BannerUrl || (t as any).bannerUrl || bannerImages[t.TournamentID % 3];

              let statusText = "Đã đóng đăng ký";
              let statusClass = "tm-status-closed";
              if (isOpen) {
                statusText = "Đang mở đăng ký";
                statusClass = "tm-status-open";
              } else if (isOngoing) {
                statusText = "Đang diễn ra";
                statusClass = "tm-status-ongoing";
              } else if (t.Status === "DrawGenerated") {
                statusText = "Đã chốt danh sách";
                statusClass = "tm-status-closed";
              } else if (t.Status === "Cancelled") {
                statusText = "Đã hủy";
                statusClass = "tm-status-closed";
              } else if (t.Status === "Completed") {
                statusText = "Đã kết thúc";
                statusClass = "tm-status-closed";
              }

              return (
                <div key={t.TournamentID} className="tm-card">
                  <div className="tm-card-body">
                    {/* Visual Tournament Banner Image */}
                    <div className="tm-card-image-wrap">
                      <img 
                        src={bannerSrc} 
                        alt={t.TournamentName} 
                        className="tm-card-banner-img"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/images/court_illustration.png";
                        }}
                      />
                      {/* Status Overlay Badge */}
                      <span className={`tm-card-status-badge ${statusClass}`}>
                        {statusText}
                      </span>
                      {/* ID tag overlay */}
                      <span className="tm-card-id-badge">
                        ID: PC2026-{String(t.TournamentID).padStart(3, "0")}
                      </span>
                    </div>



                    <h3 className="tm-card-title">
                      {t.TournamentName}
                    </h3>
                    
                    <p className="tm-card-description">
                      {t.Description || "Giải đấu phong trào định kỳ hàng tháng nhằm tạo sân chơi cọ xát cho cộng đồng Pickleball..."}
                    </p>

                    <div className="tm-card-info">
                      <div className="tm-card-info-item">
                        <span>📍</span>
                        <span>{t.Location}</span>
                      </div>
                      <div className="tm-card-info-item">
                        <span>📅</span>
                        <span>{formatDate(t.StartDate)} - {formatDate(t.EndDate)}</span>
                      </div>
                      <div className="tm-card-info-item">
                        <span>💰</span>
                        <span className={isOpen ? "tm-card-fee-open" : ""}>
                          {isOpen ? `Lệ phí từ: ${minFee.toLocaleString()} VNĐ` : (isOngoing ? "Đang thi đấu" : (t.Status === "DrawGenerated" ? "Đã chốt danh sách" : (t.Status === "Cancelled" ? "Đã hủy" : (t.Status === "Completed" ? "Đã kết thúc" : "Hết chỗ đăng ký"))))}
                        </span>
                      </div>
                    </div>

                    {tournDivs.length > 0 && (
                      <div className="tm-card-tags">
                        {tournDivs.slice(0, 3).map((d) => (
                          <span key={d.DivisionID} className="tm-card-tag">
                            {d.DivisionName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="tm-card-footer">
                    {isOpen ? (
                      <Link 
                        href={`/tournaments/${t.TournamentID}`} 
                        className="tm-card-btn-primary tm-card-actions" 
                      >
                        Chi tiết & Đăng ký →
                      </Link>
                    ) : (
                      <Link 
                        href={`/tournaments/${t.TournamentID}`} 
                        className="tm-card-btn-secondary tm-card-actions" 
                      >
                        Xem kết quả bốc thăm →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination bar */}
        {!loading && filtered.length > 0 && (
          <div className="tm-pagination">
            <button className="tm-page-btn">‹</button>
            <button className="tm-page-btn tm-page-btn-active">1</button>
            <button className="tm-page-btn">2</button>
            <button className="tm-page-btn">3</button>
            <button className="tm-page-btn">...</button>
            <button className="tm-page-btn">10</button>
            <button className="tm-page-btn">›</button>
          </div>
        )}
      </div>
    </div>
  );
}
