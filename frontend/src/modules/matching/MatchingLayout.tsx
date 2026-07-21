"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/utils/authStorage";
import * as api from "@/services/matchingApi";
import styles from "./MatchingLayout.module.css";

import ProfileTab from "./ProfileTab";
import TeammatesTab from "./TeammatesTab";
import GroupsTab from "./GroupsTab";
import OpponentsTab from "./OpponentsTab";
import InvitationsTab from "./InvitationsTab";

export default function MatchingLayout() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "teammates" | "groups" | "opponents" | "invitations">("profile");
  const [userProfile, setUserProfile] = useState<api.PlayerProfile | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Lifted teammates matching states to cache results on tab switch
  const [teammates, setTeammates] = useState<any[]>([]);
  const [teammatesLoading, setTeammatesLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTeammateResults, setAiTeammateResults] = useState<api.AITeammateResult[]>([]);
  const [aiTeammateFallback, setAiTeammateFallback] = useState(false);
  const [aiTeammateFallbackReason, setAiTeammateFallbackReason] = useState("");
  const lastRunProfileKeyRef = useRef<string>("");

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      // User is not logged in - show login modal instead of toast
      setShowLoginModal(true);
    } else {
      setToken(t);
      setCheckingAuth(false);
    }
  }, [router]);

  // Load player profile initially if token exists
  useEffect(() => {
    if (!token) return;
    async function loadUserProfile() {
      try {
        const data = await api.getPlayerProfile(token!);
        if (data) {
          setUserProfile(data);
        }
      } catch (err) {
        console.error("Failed to load user profile in layout initialization", err);
      }
    }
    loadUserProfile();
  }, [token]);

  // Load suitable teammates list
  useEffect(() => {
    if (!token || !userProfile) return;
    const hasCompleteProfile = userProfile && userProfile.AvailableStartTime && userProfile.AvailableEndTime;
    if (!hasCompleteProfile) return;

    async function loadTeammates() {
      try {
        setTeammatesLoading(true);
        const data = await api.getSuitableTeammates(token!);
        setTeammates(data || []);
      } catch (err: any) {
        showToast(err.message || "Không thể tải danh sách đồng đội gợi ý", "error");
      } finally {
        setTeammatesLoading(false);
      }
    }
    loadTeammates();
  }, [token, userProfile]);

  // Run AI matching when profile changes or matches are empty
  useEffect(() => {
    if (!token || !userProfile) return;

    const hasRequiredFields = !!(userProfile.PlayStyle?.trim() || userProfile.Goal?.trim());
    if (!hasRequiredFields) {
      setAiTeammateResults([]);
      return;
    }

    const profileKey = `${userProfile.PlayStyle || ""}|${userProfile.Goal || ""}|${userProfile.SkillLevel || ""}|${userProfile.PlayingRole || ""}|${userProfile.AvailableStartTime || ""}|${userProfile.AvailableEndTime || ""}`;

    // Skip rerun if profile hasn't changed AND we already have results
    if (lastRunProfileKeyRef.current === profileKey && aiTeammateResults.length > 0) {
      return;
    }

    lastRunProfileKeyRef.current = profileKey;

    async function runAiMatching() {
      try {
        setIsAiLoading(true);
        const data = await api.matchTeammatesByAI(token!);
        const results = data && Array.isArray(data.results) ? data.results : [];
        setAiTeammateResults(results);
        setAiTeammateFallback(!!data?.fallback);
        setAiTeammateFallbackReason(data?.fallbackReason || "");
      } catch (err: any) {
        console.error("AI teammate matching error:", err);
        setAiTeammateResults([]);
      } finally {
        setIsAiLoading(false);
      }
    }
    runAiMatching();
  }, [token, userProfile]);

  useEffect(() => {
    if (!token) return;

    async function fetchCounts() {
      try {
        const [pendingRes, unreadRes] = await Promise.all([
          api.getPendingInvitationCount(token!).catch(() => ({ count: 0 })),
          api.getUnreadGroupChatCounts(token!).catch(() => ({ totalUnread: 0, groups: [] }))
        ]);
        setPendingCount(pendingRes.count || 0);
        setUnreadChatCount(unreadRes.totalUnread || 0);
      } catch (err) {
        console.error("Failed to fetch counts", err);
      }
    }

    fetchCounts();

    window.addEventListener("invitation-count-change", fetchCounts);

    return () => {
      window.removeEventListener("invitation-count-change", fetchCounts);
    };
  }, [token, refreshTrigger]);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const renderToast = () => {
    if (!toast) return null;
    return (
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          backgroundColor: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          color: toast.type === "success" ? "#166534" : "#991b1b",
          padding: "12px 24px",
          borderRadius: "8px",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          zIndex: 9999,
          fontWeight: "500",
          fontSize: "14px",
          transition: "all 0.3s ease",
        }}
      >
        {toast.type === "success" ? "✅ " : "❌ "}
        {toast.message}
      </div>
    );
  };

  if (checkingAuth || !token) {
    return (
      <div className={styles.container} style={{ textAlign: "center", padding: "4rem 1rem", position: "relative" }}>
        {renderToast()}
        
        {/* Render centered login modal if showLoginModal is true */}
        {showLoginModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10000,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{
              backgroundColor: "#fff", padding: "32px", borderRadius: "12px",
              width: "90%", maxWidth: "400px", textAlign: "center",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
            }}>
              <h3 style={{ margin: "0 0 16px", color: "#1e293b", fontSize: "20px", fontWeight: "600" }}>
                Yêu cầu đăng nhập
              </h3>
              <p style={{ margin: "0 0 24px", color: "#475569", fontSize: "15px", lineHeight: "1.5" }}>
                Vui lòng đăng nhập để sử dụng tính năng ghép cặp và tìm kiếm đồng đội.
              </p>
              <button
                onClick={() => router.push("/login")}
                style={{
                  backgroundColor: "#10b981", color: "#fff", border: "none",
                  padding: "12px 32px", borderRadius: "8px", fontSize: "16px",
                  fontWeight: "600", cursor: "pointer", transition: "background-color 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#059669"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#10b981"}
              >
                Đăng nhập (OK)
              </button>
            </div>
          </div>
        )}

        {!showLoginModal && (
          <p style={{ color: "#64748b" }}>Đang kiểm tra thông tin đăng nhập...</p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Toast Alert overlay */}
      {renderToast()}

      <div className={styles.titleArea}>
        <div style={{ textAlign: "left" }}>
          <h1 className={styles.title}>Player Matching & Teams</h1>
          <p className={styles.subtitle}>
            Kết nối những người chơi cùng đam mê, thiết lập nhóm đánh và tổ chức các trận đấu Pickleball giao hữu.
          </p>
        </div>
        {/* Beautiful sports matching vector illustration on the right */}
        <svg viewBox="0 0 450 150" className={styles.headerIllustration}>
          <defs>
            {/* Glow filter for avatar bubbles and stars */}
            <filter id="illustrationGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Ball trail gradient */}
            <linearGradient id="trailGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(253, 224, 71, 0)" />
              <stop offset="60%" stopColor="rgba(253, 224, 71, 0.3)" />
              <stop offset="100%" stopColor="rgba(253, 224, 71, 0.7)" />
            </linearGradient>
          </defs>

          {/* Concentric wave rings (behind net and paddle) */}
          <circle cx="320" cy="75" r="80" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
          <circle cx="320" cy="75" r="55" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" fill="none" />
          <circle cx="320" cy="75" r="30" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1" fill="none" />

          {/* Dotted bezier connection lines */}
          <path d="M 120 100 Q 180 30 250 50" stroke="rgba(255, 255, 255, 0.22)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
          <path d="M 150 120 Q 210 50 280 60" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
          <path d="M 180 135 Q 240 70 310 70" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />

          {/* Net */}
          <g transform="translate(240, 80)">
            {/* Grid mesh */}
            <rect x="0" y="5" width="160" height="40" fill="none" stroke="rgba(45, 212, 191, 0.3)" strokeWidth="1" />
            {/* Grid lines */}
            <line x1="0" y1="13" x2="160" y2="13" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="0" y1="21" x2="160" y2="21" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="0" y1="29" x2="160" y2="29" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="0" y1="37" x2="160" y2="37" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            
            <line x1="16" y1="5" x2="16" y2="45" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="32" y1="5" x2="32" y2="45" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="48" y1="5" x2="48" y2="45" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="64" y1="5" x2="64" y2="45" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="80" y1="5" x2="80" y2="45" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="96" y1="5" x2="96" y2="45" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="112" y1="5" x2="112" y2="45" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="128" y1="5" x2="128" y2="45" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            <line x1="144" y1="5" x2="144" y2="45" stroke="rgba(45, 212, 191, 0.25)" strokeWidth="1" />
            {/* Top white band of net */}
            <rect x="-5" y="0" width="170" height="5" fill="#ffffff" rx="1" />
          </g>

          {/* Yellow Ball Speed Trails */}
          <path d="M 180 115 C 220 115, 230 110, 260 110" stroke="url(#trailGradient)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M 160 122 C 200 122, 220 118, 255 116" stroke="url(#trailGradient)" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M 190 128 C 220 128, 230 124, 258 122" stroke="url(#trailGradient)" strokeWidth="3" strokeLinecap="round" fill="none" />

          {/* Yellow Ball */}
          <g transform="translate(262, 110)">
            {/* Ball background glow */}
            <circle cx="10" cy="10" r="13" fill="#eab308" opacity="0.4" filter="url(#illustrationGlow)" />
            {/* Ball main circle */}
            <circle cx="10" cy="10" r="12" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
            {/* Ball holes */}
            <circle cx="6" cy="6" r="1.5" fill="#ca8a04" />
            <circle cx="14" cy="7" r="1.5" fill="#ca8a04" />
            <circle cx="9" cy="11" r="1.5" fill="#ca8a04" />
            <circle cx="5" cy="14" r="1.5" fill="#ca8a04" />
            <circle cx="14" cy="13" r="1.5" fill="#ca8a04" />
            <circle cx="10" cy="17" r="1.5" fill="#ca8a04" />
          </g>

          {/* Pickleball Paddle */}
          <g transform="translate(315, 45) rotate(12)">
            {/* Shadow behind paddle */}
            <path d="M -16 -35 C -16 -45, 16 -45, 16 -35 L 19 10 C 19 20, -19 20, -19 10 Z" fill="rgba(0, 0, 0, 0.15)" filter="url(#illustrationGlow)" />
            {/* White Paddle grip handle */}
            <rect x="-4" y="15" width="8" height="32" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
            {/* Handle wraps ridges */}
            <line x1="-4" y1="23" x2="4" y2="23" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="-4" y1="31" x2="4" y2="31" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="-4" y1="39" x2="4" y2="39" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Black neck band */}
            <rect x="-5" y="12" width="10" height="4" fill="#1f2937" rx="0.5" />
            
            {/* Paddle Face Face */}
            <path d="M -16 -32 C -16 -41, 16 -41, 16 -32 L 18 8 C 18 14, -18 14, -18 8 Z" fill="#22c55e" stroke="#ffffff" strokeWidth="2.5" />
            {/* Light border reflection inside paddle face */}
            <path d="M -13 -30 C -13 -36, 13 -36, 13 -30 L 15 5 C 15 9, -15 9, -15 5 Z" fill="none" stroke="#4ade80" strokeWidth="1.5" />
          </g>

          {/* User avatar bubbles */}
          {/* Bubble 1 */}
          <g transform="translate(220, 65)">
            <circle cx="10" cy="10" r="10" fill="rgba(255, 255, 255, 0.25)" stroke="#ffffff" strokeWidth="1.5" filter="url(#illustrationGlow)" />
            <path d="M 6 15 A 4 4 0 0 1 14 15 Z" fill="#ffffff" />
            <circle cx="10" cy="8" r="2.5" fill="#ffffff" />
          </g>
          
          {/* Bubble 2 */}
          <g transform="translate(292, 32)">
            <circle cx="10" cy="10" r="10" fill="rgba(255, 255, 255, 0.25)" stroke="#ffffff" strokeWidth="1.5" filter="url(#illustrationGlow)" />
            <path d="M 6 15 A 4 4 0 0 1 14 15 Z" fill="#ffffff" />
            <circle cx="10" cy="8" r="2.5" fill="#ffffff" />
          </g>

          {/* Bubble 3 */}
          <g transform="translate(380, 42)">
            <circle cx="10" cy="10" r="10" fill="rgba(255, 255, 255, 0.25)" stroke="#ffffff" strokeWidth="1.5" filter="url(#illustrationGlow)" />
            <path d="M 6 15 A 4 4 0 0 1 14 15 Z" fill="#ffffff" />
            <circle cx="10" cy="8" r="2.5" fill="#ffffff" />
          </g>

          {/* Bubble 4 */}
          <g transform="translate(405, 82)">
            <circle cx="10" cy="10" r="10" fill="rgba(255, 255, 255, 0.25)" stroke="#ffffff" strokeWidth="1.5" filter="url(#illustrationGlow)" />
            <path d="M 6 15 A 4 4 0 0 1 14 15 Z" fill="#ffffff" />
            <circle cx="10" cy="8" r="2.5" fill="#ffffff" />
          </g>

          {/* Sparkles / Stars */}
          {/* Star 1 */}
          <path d="M 280 28 L 281 31 L 284 32 L 281 33 L 280 36 L 279 33 L 276 32 L 279 31 Z" fill="#fef08a" filter="url(#illustrationGlow)" />
          {/* Star 2 */}
          <path d="M 255 45 L 256 47 L 258 48 L 256 49 L 255 51 L 254 49 L 252 48 L 254 47 Z" fill="#fef08a" />
          {/* Star 3 */}
          <path d="M 395 56 L 396 58 L 398 59 L 396 60 L 395 62 L 394 60 L 392 59 L 394 58 Z" fill="#fef08a" filter="url(#illustrationGlow)" />
        </svg>
      </div>

      <div className={styles.dashboard}>
        <aside className={styles.sidebar}>
          <nav className={styles.tabList}>
            <button
              onClick={() => setActiveTab("profile")}
              className={`${styles.tabButton} ${activeTab === "profile" ? styles.tabButtonActive : ""}`}
            >
              👤 Hồ sơ chơi bóng
            </button>
            <button
              onClick={() => setActiveTab("teammates")}
              className={`${styles.tabButton} ${activeTab === "teammates" ? styles.tabButtonActive : ""}`}
            >
              🤝 Tìm đồng đội
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`${styles.tabButton} ${activeTab === "groups" ? styles.tabButtonActive : ""}`}
            >
              <span>👥 Nhóm chơi bóng</span>
              {unreadChatCount > 0 && (
                <span className={styles.badge} style={{ backgroundColor: "#ef4444" }}>
                  {unreadChatCount > 9 ? "9+" : unreadChatCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("opponents")}
              className={`${styles.tabButton} ${activeTab === "opponents" ? styles.tabButtonActive : ""}`}
            >
              🔥 Tìm cặp đối thủ
            </button>
            <button
              onClick={() => setActiveTab("invitations")}
              className={`${styles.tabButton} ${activeTab === "invitations" ? styles.tabButtonActive : ""}`}
            >
              <span>✉️ Hộp thư lời mời</span>
              {pendingCount > 0 && (
                <span className={styles.badge}>
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>
          </nav>

          {/* AI Matching Sidebar Banner */}
          <div className={styles.sidebarBanner}>
            <span className={styles.bannerTag}>AI Matching</span>
            <h4 className={styles.bannerTitle}>Tìm đúng người<br />Ghép chuẩn trận</h4>
            <p className={styles.bannerDesc}>
              AI sẽ giúp bạn tìm đồng đội phù hợp nhất dựa trên trình độ và phong cách chơi.
            </p>
            
            {/* Pickleball paddle & ball illustration SVG */}
            <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: "5px auto 15px", display: "block" }}>
              {/* Green Paddle */}
              <g transform="rotate(-15 60 45)">
                {/* Handle */}
                <rect x="56" y="55" width="8" height="25" rx="4" fill="#15803d" />
                <rect x="55" y="52" width="10" height="4" rx="1" fill="#16a34a" />
                {/* Paddle Face */}
                <rect x="42" y="15" width="36" height="40" rx="14" fill="#22c55e" stroke="#15803d" strokeWidth="2" />
                <path d="M44 25C44 20 76 20 76 25" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
              </g>
              {/* Yellow Ball */}
              <circle cx="45" cy="65" r="14" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" />
              {/* Ball Holes */}
              <circle cx="39" cy="58" r="1.5" fill="#ca8a04" />
              <circle cx="48" cy="59" r="1.5" fill="#ca8a04" />
              <circle cx="43" cy="65" r="1.5" fill="#ca8a04" />
              <circle cx="38" cy="68" r="1.5" fill="#ca8a04" />
              <circle cx="50" cy="67" r="1.5" fill="#ca8a04" />
              <circle cx="45" cy="72" r="1.5" fill="#ca8a04" />
            </svg>

            <button 
              type="button" 
              onClick={() => setActiveTab("teammates")}
              className={styles.bannerBtn}
            >
              ✨ Tìm ngay
            </button>
          </div>
        </aside>

        <main className={styles.contentArea}>
          {activeTab === "profile" && (
            <ProfileTab
              token={token}
              onProfileUpdated={(p) => setUserProfile(p)}
              showToast={showToast}
            />
          )}

          {activeTab === "teammates" && (
            <TeammatesTab
              token={token!}
              userProfile={userProfile}
              showToast={showToast}
              teammates={teammates}
              loading={teammatesLoading}
              isAiLoading={isAiLoading}
              aiTeammateResults={aiTeammateResults}
              aiTeammateFallback={aiTeammateFallback}
              aiTeammateFallbackReason={aiTeammateFallbackReason}
            />
          )}

          {activeTab === "groups" && (
            <GroupsTab
              token={token}
              userProfile={userProfile}
              showToast={showToast}
              key={refreshTrigger} // Automatically re-mounts / refreshes group lists when refreshTrigger increments
            />
          )}

          {activeTab === "opponents" && (
            <OpponentsTab
              token={token}
              userProfile={userProfile}
              showToast={showToast}
            />
          )}

          {activeTab === "invitations" && (
            <InvitationsTab
              token={token}
              onActionSuccess={triggerRefresh}
              showToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}
