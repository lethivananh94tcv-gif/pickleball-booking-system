"use client";

import React, { useState, useEffect, useRef } from "react";
import * as api from "@/services/matchingApi";
import styles from "./MatchingLayout.module.css";

interface TeammatesTabProps {
  token: string;
  userProfile: api.PlayerProfile | null;
  showToast: (msg: string, type?: "success" | "error") => void;
  // Lifted state props
  teammates: any[];
  loading: boolean;
  isAiLoading: boolean;
  aiTeammateResults: api.AITeammateResult[];
  aiTeammateFallback: boolean;
  aiTeammateFallbackReason: string;
}

export default function TeammatesTab({
  token,
  userProfile,
  showToast,
  teammates,
  loading,
  isAiLoading,
  aiTeammateResults,
  aiTeammateFallback,
  aiTeammateFallbackReason,
}: TeammatesTabProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [inviteMsg, setInviteMsg] = useState("Chào bạn, mình cùng ghép cặp đánh Pickleball nhé!");
  const [sendingInvite, setSendingInvite] = useState(false);

  // Tinder & View Mode states
  const [viewMode, setViewMode] = useState<"tinder" | "list">("tinder");
  const [tinderIndex, setTinderIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const hasCompleteProfile =
    userProfile &&
    userProfile.AvailableStartTime &&
    userProfile.AvailableEndTime;

  function formatTime(timeVal: any): string {
    if (!timeVal) return "";
    const str = String(timeVal);
    if (str.includes("T")) {
      const parts = str.split("T")[1];
      return parts ? parts.substring(0, 5) : str.substring(0, 5);
    }
    return str.substring(0, 5);
  }

  const triggerSwipeRight = () => {
    setSwipeDirection("right");
    setTimeout(() => {
      setTinderIndex(prev => prev + 1);
      setSwipeDirection(null);
    }, 350);
  };

  const handlePass = () => {
    if (swipeDirection) return;
    setSwipeDirection("left");
    setTimeout(() => {
      setTinderIndex(prev => prev + 1);
      setSwipeDirection(null);
    }, 350);
  };

  const handleResetDeck = () => {
    setTinderIndex(0);
    setSwipeDirection(null);
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) return;

    try {
      setSendingInvite(true);
      await api.sendInvitation(token, {
        receiverId: selectedPlayer.UserID,
        groupId: null,
        invitationType: "InviteToPlay",
        message: inviteMsg,
      });
      showToast(`Gửi lời mời ghép cặp tới ${selectedPlayer.FullName} thành công!`);
      setSelectedPlayer(null);
      if (viewMode === "tinder") {
        triggerSwipeRight();
      }
    } catch (err: any) {
      showToast(err.message || "Gửi lời mời thất bại. Có thể hai người đã có lời mời chờ xử lý hoặc đã ghép cặp.", "error");
    } finally {
      setSendingInvite(false);
    }
  };




  const sortedTeammates = React.useMemo(() => {
    const items = [...teammates];
    return items.map(item => {
      const player = item.profile || {};
      const aiResult = aiTeammateResults.find(r => r.player?.UserID === player.UserID);
      const scoreVal = aiResult && typeof aiResult.score === "number" 
        ? Math.round(aiResult.score) 
        : (typeof item.matchingScore !== "undefined" ? Math.round(item.matchingScore) : 0);
      return {
        ...item,
        finalScore: scoreVal
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }, [teammates, aiTeammateResults]);

  if (!hasCompleteProfile) {
    return (
      <div className={styles.alertWarning}>
        <strong>⚠️ Yêu cầu thông tin:</strong> Vui lòng cập nhật và hoàn thiện thời gian rảnh (giờ bắt đầu và kết thúc) của bạn trong tab <strong>Hồ sơ chơi bóng</strong> trước khi tìm đồng đội.
      </div>
    );
  }

  return (
    <div>
      {/* Page Title & View Mode Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Tìm kiếm đồng đội & Đối thủ</h3>
          <p style={{ fontSize: "14px", color: "var(--pcs-neutral-600)", marginTop: "0.25rem" }}>Kết nối, ghép cặp và thách đấu bằng công cụ thông minh AI của Pickle Club.</p>
        </div>
        <div className={styles.viewModeToggle}>
          <button 
            type="button" 
            className={`${styles.toggleBtn} ${viewMode === "tinder" ? styles.toggleBtnActive : ""}`}
            onClick={() => setViewMode("tinder")}
          >
            🔥 Ghép cặp nhanh
          </button>
          <button 
            type="button" 
            className={`${styles.toggleBtn} ${viewMode === "list" ? styles.toggleBtnActive : ""}`}
            onClick={() => setViewMode("list")}
          >
            📋 Danh sách
          </button>
        </div>
      </div>

      {/* Redesigned Premium AI Loading State */}
      {isAiLoading && (
        <div className={styles.aiLoadingCard}>
          <div className={styles.aiLoadingLeft}>
            {/* White circle robot icon */}
            <div className={styles.aiAvatarCircle}>
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Robot head */}
                <rect x="7" y="10" width="34" height="28" rx="14" fill="#f8fafc" stroke="#10b981" strokeWidth="2.5" />
                {/* Ears */}
                <rect x="3" y="20" width="4" height="8" rx="2" fill="#10b981" />
                <rect x="41" y="20" width="4" height="8" rx="2" fill="#10b981" />
                {/* Antenna */}
                <rect x="23" y="4" width="2" height="6" fill="#10b981" />
                <circle cx="24" cy="4" r="2.5" fill="#10b981" />
                {/* Face screen */}
                <rect x="12" y="17" width="24" height="14" rx="7" fill="#0f172a" />
                {/* Eyes */}
                <circle cx="18" cy="24" r="2.5" fill="#34d399" />
                <circle cx="30" cy="24" r="2.5" fill="#34d399" />
                {/* Mouth line */}
                <path d="M21 28H27" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            
            <div className={styles.aiLoadingInfo}>
              <h4 className={styles.aiLoadingTitle}>AI đang phân tích hồ sơ của bạn...</h4>
              <p className={styles.aiLoadingSub}>Tìm kiếm người chơi phù hợp nhất</p>
              
              {/* Progress bar with percentage */}
              <div className={styles.aiProgressContainer}>
                <div className={styles.aiProgressBar}>
                  <div className={styles.aiProgressFill} style={{ width: "82%" }} />
                </div>
                <span className={styles.aiProgressPercent}>82%</span>
              </div>
            </div>
          </div>

          {/* Radar Scanning Graphic */}
          <div className={styles.radarContainer}>
            <svg width="90" height="90" viewBox="0 0 100 100" className={styles.radarSvg}>
              {/* Concentric circles */}
              <circle cx="50" cy="50" r="42" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="1" fill="none" />
              <circle cx="50" cy="50" r="28" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="1" fill="none" />
              <circle cx="50" cy="50" r="14" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="1" fill="none" />
              {/* Crosshairs */}
              <line x1="8" y1="50" x2="92" y2="50" stroke="rgba(16, 185, 129, 0.1)" strokeWidth="1" />
              <line x1="50" y1="8" x2="50" y2="92" stroke="rgba(16, 185, 129, 0.1)" strokeWidth="1" />
              
              {/* Sweeper hand (with rotation animation) */}
              <g className={styles.radarSweep}>
                <line x1="50" y1="50" x2="80" y2="20" stroke="url(#radarGradient)" strokeWidth="3.5" strokeLinecap="round" />
              </g>
              
              {/* Target dots */}
              <circle cx="72" cy="32" r="3.5" fill="#10b981" className={styles.radarTarget} />
              <circle cx="34" cy="62" r="2.5" fill="#34d399" className={styles.radarTargetDelay} />
              {/* Center dot */}
              <circle cx="50" cy="50" r="2" fill="#10b981" />
              
              <defs>
                <linearGradient id="radarGradient" x1="50" y1="50" x2="80" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(16, 185, 129, 0)" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      )}

      {/* Section: AI Indicator Badge */}
      {!isAiLoading && aiTeammateResults.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
          <span className={styles.aiGlowBadge}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px", verticalAlign: "middle" }}>
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
              <path d="M9 1v3" />
              <path d="M15 1v3" />
              <path d="M9 20v3" />
              <path d="M15 20v3" />
              <path d="M20 9h3" />
              <path d="M20 15h3" />
              <path d="M1 9h3" />
              <path d="M1 15h3" />
            </svg>
            Đã tối ưu hóa danh sách bằng AI
          </span>
          {aiTeammateFallback && (
            <span style={{ fontSize: "11px", backgroundColor: "var(--pcs-status-warning-bg, #fffbeb)", border: "1px solid var(--pcs-status-warning-border, #fef3c7)", color: "var(--pcs-status-warning)", padding: "0.25rem 0.5rem", borderRadius: "6px", fontWeight: "600" }} title={aiTeammateFallbackReason}>
              ⚠️ Gợi ý nội bộ (AI Offline)
            </span>
          )}
        </div>
      )}

      {/* Loading & Empty States */}
      {loading ? (
        <div className={styles.loadingInner}>Đang tìm kiếm đồng đội phù hợp...</div>
      ) : teammates.length === 0 ? (
        <div className={styles.emptyState}>Không tìm thấy đồng đội nào phù hợp trong khung giờ rảnh của bạn hiện tại.</div>
      ) : viewMode === "tinder" ? (
        /* Tinder Swiping Deck Mode */
        <div className={styles.tinderDeckContainer}>
          {tinderIndex < sortedTeammates.length ? (
            <>
              <div className={styles.deck}>
                {sortedTeammates.slice(tinderIndex, tinderIndex + 1).map((item, idx) => {
                  const player = item.profile || {};
                  const isTop = idx === 0;
                  const aiResult = aiTeammateResults.find(r => r.player?.UserID === player.UserID);
                  const scoreVal = aiResult && typeof aiResult.score === "number" 
                    ? Math.round(aiResult.score) 
                    : (typeof item.matchingScore !== "undefined" ? Math.round(item.matchingScore) : 0);

                  // Setup transition classes
                  let cardClass = styles.glassTinderCard;
                  if (isTop) {
                    cardClass += ` ${styles.tinderCardTop}`;
                    if (swipeDirection === "left") cardClass += ` ${styles.swipeLeft}`;
                    if (swipeDirection === "right") cardClass += ` ${styles.swipeRight}`;
                  } else {
                    cardClass += ` ${styles.tinderCardBelow}`;
                  }

                  // Render next card behind
                  if (!isTop && swipeDirection === null) {
                    cardClass += ` ${styles.tinderCardInactive}`;
                  }

                  return (
                    <div className={cardClass} key={player.PlayerProfileID}>
                      {/* Card Cover (Avatar & overlays) */}
                      <div className={styles.cardCover}>
                        {player.AvatarURL ? (
                          <img src={player.AvatarURL} alt={player.FullName} className={styles.cardCoverImage} />
                        ) : (
                          <div className={styles.avatarCircleLarge}>
                            {player.FullName ? player.FullName.charAt(0).toUpperCase() : "P"}
                          </div>
                        )}
                        <div className={styles.cardOverlayInfo}>
                          <div style={{ textAlign: "left" }}>
                            <h4 className={styles.tinderName}>{player.FullName}</h4>
                            <span className={styles.tinderRole}>{player.PlayingRole}</span>
                          </div>
                          <div className={styles.tinderMatchBadge}>{scoreVal}% Match</div>
                        </div>
                      </div>

                      {/* Card Profile Details */}
                      <div className={styles.tinderDetails}>
                        <div className={styles.tinderRow}>
                          <span className={styles.tinderLabel}>Trình độ:</span>
                          <span className={styles.tinderValue}>{player.SkillLevel}</span>
                        </div>
                        <div className={styles.tinderRow}>
                          <span className={styles.tinderLabel}>Kinh nghiệm:</span>
                          <span className={styles.tinderValue}>{player.ExperienceYears} năm</span>
                        </div>
                        <div className={styles.tinderRow}>
                          <span className={styles.tinderLabel}>Khung giờ rảnh:</span>
                          <span className={`${styles.tinderValue} ${styles.tinderValueHighlight}`}>
                            {formatTime(player.AvailableStartTime)} - {formatTime(player.AvailableEndTime)}
                          </span>
                        </div>
                        {player.PlayStyle && (
                          <div className={styles.tinderRow} style={{ flexDirection: "column", gap: "2px", alignItems: "flex-start", border: "none", paddingBottom: 0 }}>
                            <span className={styles.tinderLabel}>Phong cách chơi:</span>
                            <span style={{ fontSize: "13px", color: "var(--pcs-neutral-600)", fontWeight: "500", marginTop: "2px", textAlign: "left" }}>
                              {player.PlayStyle}
                            </span>
                          </div>
                        )}

                        {/* AI Match Explanation Box */}
                        {aiResult && aiResult.reasons && aiResult.reasons.length > 0 && (
                          <div className={styles.tinderAiBox}>
                            <span className={styles.tinderAiTitle}>🤖 Phân tích AI:</span>
                            <p className={styles.tinderAiReason}>{aiResult.reasons[0]}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tinder Buttons */}
              <div className={styles.tinderButtonBar}>
                <button 
                  type="button" 
                  onClick={handlePass} 
                  className={`${styles.circleBtn} ${styles.btnPass}`}
                  title="Bỏ qua (Swipe Left)"
                >
                  ✕
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    const topPlayer = sortedTeammates[tinderIndex]?.profile;
                    if (topPlayer) setSelectedPlayer(topPlayer);
                  }} 
                  className={`${styles.circleBtn} ${styles.btnLike}`}
                  title="Ghép cặp (Swipe Right)"
                >
                  ♥
                </button>
              </div>
            </>
          ) : (
            <div className={styles.tinderEmpty}>
              <div className={styles.tinderEmptyIcon}>🎉</div>
              <h4 style={{ fontWeight: 700, fontSize: "18px", margin: "0 0 8px 0" }}>Đã xem hết danh sách gợi ý!</h4>
              <p style={{ fontSize: "14px", color: "var(--pcs-neutral-600)", margin: "0 0 20px 0" }}>
                Hãy quay lại từ đầu hoặc chuyển sang chế độ danh sách để xem tất cả.
              </p>
              <button type="button" onClick={handleResetDeck} className={styles.primaryBtn}>
                Quay lại từ đầu
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Classic List Grid Mode */
        <>
          <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
            <h4 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "var(--pcs-neutral-700)" }}>
              👥 Danh sách đồng đội phù hợp
            </h4>
          </div>
          <div className={styles.gridList}>
            {sortedTeammates.map((item) => {
              const player = item.profile || {};
              const aiResult = aiTeammateResults.find(r => r.player?.UserID === player.UserID);
              const hasScore = aiResult ? typeof aiResult.score === "number" : typeof item.matchingScore !== "undefined";
              const scoreVal = aiResult && typeof aiResult.score === "number" 
                ? Math.round(aiResult.score) 
                : (typeof item.matchingScore !== "undefined" ? Math.round(item.matchingScore) : null);
              const scores = item.scores || {};

              return (
                <div 
                  className={styles.card} 
                  key={player.PlayerProfileID} 
                  style={aiResult ? { border: "1px solid var(--pcs-brand-primary)", boxShadow: "0 4px 6px -1px rgba(168, 85, 247, 0.1)" } : undefined}
                >
                  <div>
                    <div className={styles.cardHeader}>
                      <div className={styles.avatarWrap}>
                        {player.AvatarURL ? (
                          <img src={player.AvatarURL} alt={player.FullName} className={styles.avatar} />
                        ) : (
                          <div className={styles.avatarPlaceholder} style={aiResult ? { backgroundColor: "var(--pcs-brand-primary-light)", color: "var(--pcs-brand-primary-hover)" } : undefined}>
                            {player.FullName ? player.FullName.charAt(0).toUpperCase() : "P"}
                          </div>
                        )}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                            <h4 className={styles.cardName}>{player.FullName}</h4>
                            {aiResult && (
                              <span style={{ 
                                fontSize: "10px", 
                                backgroundColor: "var(--pcs-brand-primary-light)",
                                color: "var(--pcs-brand-primary-hover)",
                                border: "1px solid var(--pcs-brand-primary-light)",
                                padding: "0.15rem 0.35rem", 
                                borderRadius: "4px", 
                                fontWeight: "600",
                                marginLeft: "0.4rem",
                                display: "inline-block"
                              }}>
                                ✨ AI
                              </span>
                            )}
                          </div>
                          <span className={styles.cardTag} style={aiResult ? { backgroundColor: "var(--pcs-brand-primary-light)", color: "var(--pcs-brand-primary-hover)" } : undefined}>
                            {player.PlayingRole}
                          </span>
                        </div>
                      </div>
                      {hasScore && (
                        <div className={styles.scoreBadge} style={aiResult ? { backgroundColor: "var(--pcs-brand-primary-light)", borderColor: "var(--pcs-brand-primary)" } : undefined}>
                          <span className={styles.scoreVal} style={aiResult ? { color: "var(--pcs-brand-primary-hover)" } : undefined}>{scoreVal}%</span>
                          <span className={styles.scoreText} style={aiResult ? { color: "var(--pcs-brand-primary-hover)" } : undefined}>Match</span>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar for AI scores */}
                    {aiResult && scoreVal !== null && (
                      <div style={{ width: "100%", height: "6px", backgroundColor: "var(--pcs-neutral-200)", borderRadius: "3px", overflow: "hidden", marginBottom: "1rem", marginTop: "-0.5rem" }}>
                        <div style={{ width: `${scoreVal}%`, height: "100%", backgroundColor: scoreVal >= 80 ? "#10b981" : scoreVal >= 60 ? "#f59e0b" : "var(--pcs-status-error)" }} />
                      </div>
                    )}

                    <div className={styles.cardBody}>
                      <div className={styles.cardMetaItem}>
                        <strong>Trình độ:</strong>
                        <span>{player.SkillLevel}</span>
                      </div>
                      <div className={styles.cardMetaItem}>
                        <strong>Kinh nghiệm:</strong>
                        <span>{player.ExperienceYears} năm</span>
                      </div>
                      <div className={styles.cardMetaItem}>
                        <strong>Khung giờ rảnh:</strong>
                        <span style={{ color: "var(--pcs-brand-primary-hover)", fontWeight: "600" }}>
                          {formatTime(player.AvailableStartTime)} - {formatTime(player.AvailableEndTime)}
                        </span>
                      </div>
                      {player.PlayStyle && (
                        <div className={styles.cardMetaItem} style={{ flexDirection: "column", gap: "0.125rem", marginTop: "0.25rem" }}>
                          <strong>Phong cách chơi:</strong>
                          <span style={{ color: "var(--pcs-neutral-600)", fontSize: "13px" }}>{player.PlayStyle}</span>
                        </div>
                      )}

                      {/* AI Reasons & Explanation */}
                      {aiResult && aiResult.reasons && aiResult.reasons.length > 0 && (
                        <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", backgroundColor: "var(--pcs-neutral-50)", borderRadius: "8px", border: "1px dashed var(--pcs-brand-primary-light)" }}>
                          <strong style={{ fontSize: "12px", color: "var(--pcs-brand-primary-hover)", display: "block", marginBottom: "0.25rem" }}>🤖 Phân tích từ AI:</strong>
                          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "12px", color: "var(--pcs-brand-primary-hover)", lineHeight: "1.4", textAlign: "left" }}>
                            {aiResult.reasons.map((r, idx) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {!aiResult && scores && (
                      <div className={styles.scoreDetailsGrid}>
                        <div className={styles.scoreDetailMini}>
                          <span>Trình độ:</span>
                          <strong>{Math.round(scores.skillScore || 0)}%</strong>
                        </div>
                        <div className={styles.scoreDetailMini}>
                          <span>Vai trò:</span>
                          <strong>{Math.round(scores.roleScore || 0)}%</strong>
                        </div>
                        <div className={styles.scoreDetailMini}>
                          <span>Lịch rảnh:</span>
                          <strong>{Math.round(scores.scheduleScore || 0)}%</strong>
                        </div>
                        <div className={styles.scoreDetailMini}>
                          <span>Kinh nghiệm:</span>
                          <strong>{Math.round(scores.experienceScore || 0)}%</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: "1rem" }}>
                    <button
                      onClick={() => setSelectedPlayer(player)}
                      className={styles.primaryBtn}
                      style={{ width: "100%", background: aiResult ? "var(--pcs-brand-primary-hover)" : undefined }}
                    >
                      Ghép cặp
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedPlayer && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>Gửi lời mời ghép cặp</h4>
              <button className={styles.closeBtn} onClick={() => setSelectedPlayer(null)}>×</button>
            </div>
            <form onSubmit={handleSendInvitation}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Gửi tới:</label>
                <input
                  type="text"
                  value={selectedPlayer.FullName}
                  disabled
                  className={styles.input}
                  style={{ backgroundColor: "var(--pcs-neutral-50)" }}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Lời nhắn mời chơi:</label>
                <textarea
                  value={inviteMsg}
                  onChange={(e) => setInviteMsg(e.target.value)}
                  className={styles.textarea}
                  rows={4}
                  required
                />
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setSelectedPlayer(null)}
                  className={styles.secondaryBtn}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className={styles.primaryBtn}
                >
                  {sendingInvite ? "Đang gửi..." : "Gửi lời mời"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
