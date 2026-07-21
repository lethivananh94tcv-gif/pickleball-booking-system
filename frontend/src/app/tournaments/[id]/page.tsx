"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { tournamentApi, Tournament, TournamentDivision } from "@/services/tournamentApi";
import { getMyProfile } from "@/services/profileApi";
import { getPlayerProfile, getSuitableTeammates, sendInvitation } from "@/services/matchingApi";
import { LuTrophy, LuClock, LuUser, LuCalendar, LuPhone, LuUsers, LuFileText, LuMapPin, LuBuilding, LuWallet, LuShieldCheck, LuHandshake, LuGift, LuFlame, LuSparkles, LuEye, LuX } from "react-icons/lu";
import "../../tournaments.css";

function PendingRegistrationBanner({ reg, handleRetryPayment, registerLoading, onExpired }: { reg: any; handleRetryPayment: any; registerLoading: boolean; onExpired: () => void }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!reg.PaymentExpiredAt) return;

    function tick() {
      const diff = new Date(reg.PaymentExpiredAt).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft("Hết hạn");
        onExpired();
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes} phút ${seconds} giây`);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reg.PaymentExpiredAt, onExpired]);

  const isExpired = timeLeft === "Hết hạn";

  return (
    <div style={{
      background: "linear-gradient(135deg, #fffbeb 0%, #fffbeb 100%)",
      border: "1.5px solid #fef3c7",
      borderRadius: "20px",
      padding: "24px",
      marginBottom: "24px",
      boxShadow: "0 10px 25px rgba(245, 158, 11, 0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      animation: "bannerSlideUpIn 0.4s ease-out"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <span style={{ fontSize: "36px", lineHeight: 1 }}>⏳</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "1.15rem", fontWeight: "900", color: "#92400e" }}>
            Đăng ký nội dung {reg.DivisionName} đang chờ thanh toán
          </h4>
          <p style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "#b45309", lineHeight: "1.6" }}>
            Bạn đã đăng ký tham gia nội dung <strong>{reg.DivisionName}</strong> với tên đội <strong>{reg.TeamName}</strong>. 
            Vui lòng hoàn tất thanh toán để giữ chỗ chính thức.
          </p>
          {timeLeft && (
            <div style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "6px", 
              background: "#fee2e2", 
              color: "#ef4444", 
              padding: "6px 12px", 
              borderRadius: "8px", 
              fontSize: "0.85rem", 
              fontWeight: "800" 
            }}>
              ⏱️ Thời gian giữ chỗ còn lại: {timeLeft}
            </div>
          )}
        </div>
      </div>
      
      <div style={{ display: "flex", gap: "12px", borderTop: "1px solid #fde68a", paddingTop: "20px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => handleRetryPayment(reg.RegistrationID, reg.RegistrationFee)}
          disabled={registerLoading || isExpired}
          className="tm-btn"
          style={{ 
            padding: "12px 28px", 
            fontSize: "0.9rem",
            background: isExpired ? "#cbd5e1" : "linear-gradient(135deg, #059669, #047857)",
            color: isExpired ? "#64748b" : "#ffffff",
            fontWeight: "800",
            borderRadius: "12px",
            border: "none",
            cursor: (registerLoading || isExpired) ? "not-allowed" : "pointer",
            boxShadow: isExpired ? "none" : "0 4px 12px rgba(5, 150, 105, 0.2)"
          }}
        >
          {registerLoading ? "Đang xử lý..." : isExpired ? "Đã hết hạn" : `Thanh toán ngay (${reg.RegistrationFee.toLocaleString()} VNĐ)`}
        </button>
        
        <button
          type="button"
          onClick={() => window.location.href = '/bookings'}
          className="tm-btn"
          style={{
            padding: "12px 20px",
            fontSize: "0.9rem",
            background: "#ffffff",
            color: "#64748b",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          Xem hồ sơ
        </button>

        <button
          type="button"
          onClick={() => window.location.href = 'mailto:support@pickleclub.com'}
          className="tm-btn"
          style={{
            padding: "12px 20px",
            fontSize: "0.9rem",
            background: "transparent",
            color: "#b45309",
            border: "none",
            borderRadius: "12px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          Liên hệ BTC 💬
        </button>
      </div>
    </div>
  );
}

function ConfirmedRegistrationBanner({ 
  reg, 
  tournament, 
  divisions,
  onViewCertificate 
}: { 
  reg: any; 
  tournament: any; 
  divisions: any[];
  onViewCertificate: (reg: any) => void; 
}) {
  const division = divisions?.find(d => d.DivisionID === reg.DivisionID);
  const isCompleted = division?.Status === "Completed";
  return (
    <div style={{
      background: "linear-gradient(135deg, #f0fdf4 0%, #e8fbf0 100%)",
      border: "1.5px solid #a7f3d0",
      borderRadius: "20px",
      padding: "24px",
      marginBottom: "24px",
      boxShadow: "0 10px 25px rgba(16, 185, 129, 0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      animation: "bannerSlideUpIn 0.4s ease-out"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <span style={{ fontSize: "36px", lineHeight: 1 }}>✅</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "1.15rem", fontWeight: "900", color: "#166534" }}>
            Đã đăng ký thành công nội dung {reg.DivisionName}
          </h4>
          <p style={{ margin: "0", fontSize: "0.9rem", color: "#15803d", lineHeight: "1.6" }}>
            Bạn đã đăng ký nội dung <strong>{reg.DivisionName}</strong> thành công (Mã đội: <strong>{reg.TeamCode}</strong>). 
            Trạng thái hồ sơ: <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "6px", fontWeight: "700", fontSize: "0.8rem" }}>Đã duyệt & Xác nhận tham gia</span>.
          </p>
        </div>
      </div>
      
      <div style={{ display: "flex", gap: "12px", borderTop: "1px solid #a7f3d0", paddingTop: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => window.location.href = '/bookings'}
          className="tm-btn"
          style={{
            padding: "12px 28px",
            fontSize: "0.9rem",
            background: "linear-gradient(135deg, #059669, #047857)",
            color: "#ffffff",
            fontWeight: "800",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(5, 150, 105, 0.2)"
          }}
        >
          Xem hồ sơ đăng ký
        </button>

        <button
          type="button"
          onClick={() => {
            alert("Đang khởi tạo tải xuống file PDF phiếu xác nhận đăng ký giải đấu...");
          }}
          className="tm-btn"
          style={{
            padding: "12px 20px",
            fontSize: "0.9rem",
            background: "#ffffff",
            color: "#64748b",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          Tải xác nhận 📥
        </button>

        <button
          type="button"
          onClick={() => window.location.href = 'mailto:support@pickleclub.com'}
          className="tm-btn"
          style={{
            padding: "12px 20px",
            fontSize: "0.9rem",
            background: "transparent",
            color: "#166534",
            border: "none",
            borderRadius: "12px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          Liên hệ BTC 💬
        </button>

        {isCompleted && (
          <button
            type="button"
            onClick={() => onViewCertificate(reg)}
            className="tm-btn"
            style={{
              padding: "12px 24px",
              fontSize: "0.9rem",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              color: "#ffffff",
              borderRadius: "12px",
              fontWeight: "800",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            🎓 Nhận Chứng nhận & Thưởng
          </button>
        )}
      </div>
    </div>
  );
}

function AccordionItem({ title, content }: { title: string; content: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="td-accordion-item">
      <button 
        type="button" 
        className="td-accordion-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <span className="td-accordion-arrow">{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && (
        <div className="td-accordion-content">
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{content}</p>
        </div>
      )}
    </div>
  );
}

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const routerParams = useParams();
  const id = (routerParams?.id as string) || "";
  const router = useRouter();
  const tournamentId = parseInt(id, 10);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<TournamentDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "divisions" | "bracket" | "standings" | "rules">("info");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<string>("All");
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);

  // Bracket & matches data
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [bracketActiveSubTab, setBracketActiveSubTab] = useState<string>("Overview");
  const [trackedTeamId, setTrackedTeamId] = useState<number | null>(null);

  const [zoom, setZoom] = useState(1.0);
  const [connections, setConnections] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeMobileRoundIdx, setActiveMobileRoundIdx] = useState(0);

  // Opponent profile modal states
  const [profileTeamId, setProfileTeamId] = useState<number | null>(null);
  const [profileTeamName, setProfileTeamName] = useState<string>("");
  const [profileMembers, setProfileMembers] = useState<any[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Certificate & Prize Modal states
  const [selectedCertReg, setSelectedCertReg] = useState<any | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [certRankOverride, setCertRankOverride] = useState<string>("auto");

  const handleShowCertificate = async (reg: any) => {
    setSelectedCertReg({ ...reg, rank: null, loadingRank: true });
    setShowCertModal(true);
    setCertRankOverride("auto");
    
    try {
      const divStandings = await tournamentApi.getStandings(tournamentId, reg.DivisionID);
      const teamStanding = divStandings.find((s: any) => s.TeamID === reg.TeamID);
      setSelectedCertReg((prev: any) => {
        if (!prev || prev.RegistrationID !== reg.RegistrationID) return prev;
        return { 
          ...prev, 
          rank: teamStanding ? teamStanding.RankNo : null, 
          loadingRank: false 
        };
      });
    } catch (err) {
      console.error("Error loading standings for certificate:", err);
      setSelectedCertReg((prev: any) => prev ? { ...prev, loadingRank: false } : prev);
    }
  };

  const handleShowPlayerProfile = async (teamId: number, teamName: string) => {
    if (!teamId || !teamName) return;
    const cleanName = teamName.trim();
    if (cleanName === "TBD" || cleanName === "Bye" || cleanName.toLowerCase().includes("chờ bốc thăm")) {
      return; // Skip virtual/placeholder teams
    }
    
    setProfileTeamId(teamId);
    setProfileTeamName(teamName);
    setProfileLoading(true);
    setShowProfileModal(true);
    setProfileMembers([]);
    
    try {
      const data = await tournamentApi.getTeamMembers(tournamentId, teamId);
      setProfileMembers(data || []);
    } catch (err) {
      console.error("Error loading team member profiles:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  // Polling tự động mỗi 10 giây đối với tab nhánh đấu và bảng xếp hạng
  useEffect(() => {
    if (isNaN(tournamentId) || !selectedDivisionId) return;
    const interval = setInterval(() => {
      if (activeTab === "bracket" || activeTab === "standings") {
        tournamentApi.getMatches(tournamentId, selectedDivisionId)
          .then((data) => setMatches(data || []))
          .catch(() => {});
        tournamentApi.getStandings(tournamentId, selectedDivisionId)
          .then((data) => setStandings(data || []))
          .catch(() => {});
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [tournamentId, selectedDivisionId, activeTab]);

  // Reset tab phụ khi đổi nội dung thi đấu
  useEffect(() => {
    if (selectedDivisionId) {
      setBracketActiveSubTab("Overview");
      setTrackedTeamId(null);
    }
  }, [selectedDivisionId]);

  // Publicly auto-open certificate from URL parameter certRegId
  useEffect(() => {
    if (typeof window !== "undefined" && !isNaN(tournamentId) && divisions.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const certRegId = searchParams.get("certRegId");
      if (certRegId) {
        const regIdNum = parseInt(certRegId, 10);
        if (!isNaN(regIdNum)) {
          const checkDivisions = async () => {
            for (const div of divisions) {
              if (div.Status === "Completed") {
                try {
                  const regs = await tournamentApi.getRegistrations(tournamentId, div.DivisionID);
                  const matched = regs.find((r: any) => r.registrationId === regIdNum);
                  if (matched) {
                    const adaptedReg = {
                      RegistrationID: matched.registrationId,
                      DivisionID: div.DivisionID,
                      TeamID: matched.teamId,
                      DivisionName: div.DivisionName,
                      TeamCode: matched.teamCode,
                      TeamName: matched.teamName,
                      athletes: matched.athletes
                    };
                    handleShowCertificate(adaptedReg);
                    break;
                  }
                } catch (e) {
                  console.error("Error checking public certificate registration:", e);
                }
              }
            }
          };
          checkDivisions();
        }
      }
    }
  }, [tournamentId, divisions]);

  const updateConnectorLines = () => {
    const canvas = document.querySelector(".bracket-tree-container");
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const newConnections: any[] = [];
    const selectedDiv = divisions.find(d => d.DivisionID === selectedDivisionId);
    if (!selectedDiv) return;

    const groupStageMatches = matches.filter(m => m.GroupName && m.GroupName !== "Knockout" && (!m.KnockoutRound));
    const knockoutMatches = matches.filter(m => m.GroupName === "Knockout" || m.KnockoutRound);

    const targetMatches = knockoutMatches.length > 0 ? knockoutMatches : matches;

    // Use mock matches if targetMatches is empty to draw lines
    const allMatchesToRender = targetMatches.length > 0 ? targetMatches : [
      ...Array.from({ length: 4 }, (_, idx) => ({
        MatchID: -(idx + 1), RoundNo: 1, MatchNo: idx + 1, KnockoutRound: "Tứ kết", MatchStatus: "Scheduled", NextMatchID: -(Math.floor(idx / 2) + 5)
      })),
      ...Array.from({ length: 2 }, (_, idx) => ({
        MatchID: -(idx + 5), RoundNo: 2, MatchNo: idx + 1, KnockoutRound: "Bán kết", MatchStatus: "Scheduled", NextMatchID: -7
      })),
      {
        MatchID: -7, RoundNo: 3, MatchNo: 1, KnockoutRound: "Chung kết", MatchStatus: "Scheduled"
      }
    ];

    allMatchesToRender.forEach((m: any) => {
      if (m.NextMatchID) {
        const sourceCard = document.getElementById(`match-card-${m.MatchID}`);
        const destCard = document.getElementById(`match-card-${m.NextMatchID}`);
        if (sourceCard && destCard) {
          const sourceRect = sourceCard.getBoundingClientRect();
          const destRect = destCard.getBoundingClientRect();

          const x1 = (sourceRect.right - canvasRect.left) / zoom;
          const y1 = (sourceRect.top + sourceRect.height / 2 - canvasRect.top) / zoom;
          const x2 = (destRect.left - canvasRect.left) / zoom;
          const y2 = (destRect.top + destRect.height / 2 - canvasRect.top) / zoom;

          const midX = x1 + (x2 - x1) / 2;
          const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

          const isWinnerKnown = m.MatchStatus === "Completed" || m.MatchStatus === "ByeCompleted";
          const isHighlighted = trackedTeamId && (m.TeamAID === trackedTeamId || m.TeamBID === trackedTeamId);

          newConnections.push({
            id: `${m.MatchID}-${m.NextMatchID}`,
            path,
            isWinnerKnown,
            isHighlighted
          });
        }
      }
    });
    setConnections(newConnections);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      updateConnectorLines();
    }, 400);

    window.addEventListener("resize", updateConnectorLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateConnectorLines);
    };
  }, [matches, trackedTeamId, zoom, activeTab, bracketActiveSubTab, selectedDivisionId]);

  // Doubles registration state
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<TournamentDivision | null>(null);
  const [partnerOption, setPartnerOption] = useState<"ExistingPartner" | "SuggestOnly" | "AutoMatch" | "ManualForm">("ExistingPartner");
  const [partnerContact, setPartnerContact] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);

  // Mapped registration result details
  const [registrationResult, setRegistrationResult] = useState<any>(null);

  // Matching suitable players modal states
  const [matchingModalOpen, setMatchingModalOpen] = useState(false);
  const [suitablePlayers, setSuitablePlayers] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<number[]>([]);
  const [invitationStatus, setInvitationStatus] = useState<Record<number, { sending: boolean; sent: boolean; error?: string }>>({});
  const [customInviteMsg, setCustomInviteMsg] = useState("");
  const [invitingPlayer, setInvitingPlayer] = useState<any | null>(null);

  // Form states for Athlete 1 and Athlete 2
  const [athlete1, setAthlete1] = useState({
    phoneNumber: "",
    fullName: "",
    email: "",
    rating: 0.0,
    province: "",
    gender: "Male",
    dateOfBirth: "",
    photoUrl: "",
    note: "",
    cccdUrl: "",
    transferUrl: "",
  });

  const [athlete2, setAthlete2] = useState({
    phoneNumber: "",
    fullName: "",
    email: "",
    rating: 0.0,
    province: "",
    gender: "Male",
    dateOfBirth: "",
    photoUrl: "",
    note: "",
    cccdUrl: "",
  });

  // Form error highlights
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Payment redirection details
  const [paymentData, setPaymentData] = useState<any | null>(null);

  // User's active registrations status for this tournament
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);

  const refreshRegistrations = () => {
    tournamentApi.getMyRegistration(tournamentId)
      .then((data) => {
        setMyRegistrations(data || []);
      })
      .catch(() => {});

    tournamentApi.getDivisions(tournamentId)
      .then((divs) => {
        setDivisions(divs);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (isNaN(tournamentId)) return;

    Promise.all([
      tournamentApi.getTournamentDetail(tournamentId),
      tournamentApi.getDivisions(tournamentId),
    ])
      .then(([tourn, divs]) => {
        setTournament(tourn);
        setDivisions(divs);
        if (divs.length > 0) {
          setSelectedDivisionId(divs[0].DivisionID);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Không thể tải chi tiết giải đấu.");
      })
      .finally(() => setLoading(false));
  }, [tournamentId]);

  // Fetch my registration if logged in
  useEffect(() => {
    if (isNaN(tournamentId)) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("pickleclub_token") : null;
    if (!token) return;

    tournamentApi.getMyRegistration(tournamentId)
      .then((data) => {
        setMyRegistrations(data || []);
      })
      .catch((err) => {
        console.error("Error loading my registration status:", err);
      });
  }, [tournamentId]);

  useEffect(() => {
    if (!registerModalOpen || !selectedDivision) return;

    // Kiểm tra xem có bản nháp được lưu hay không
    const savedDraft = typeof window !== "undefined" 
      ? localStorage.getItem(`tournament_reg_draft_${tournamentId}_${selectedDivision.DivisionID}`) 
      : null;

    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.athlete1) setAthlete1(parsed.athlete1);
        if (parsed.athlete2) setAthlete2(parsed.athlete2);
        if (parsed.partnerOption) setPartnerOption(parsed.partnerOption);
        if (parsed.partnerContact) setPartnerContact(parsed.partnerContact);
        return; // Đã tải bản nháp thành công, không ghi đè từ API nữa
      } catch (e) {
        console.error("Lỗi parse dữ liệu nháp:", e);
      }
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("pickleclub_token") : null;
    if (!token) return;

    Promise.all([
      getMyProfile(token).catch(() => null),
      getPlayerProfile(token).catch(() => null)
    ]).then(([profileData, playerProfileData]) => {
      if (profileData) {
        setAthlete1(prev => ({
          ...prev,
          phoneNumber: profileData.PhoneNumber || "",
          fullName: profileData.FullName || "",
          gender: profileData.Gender === "Female" ? "Female" : "Male",
          dateOfBirth: profileData.DateOfBirth ? profileData.DateOfBirth.slice(0, 10) : "",
          rating: playerProfileData?.Rating ? Number(playerProfileData.Rating) : 0.0,
          province: profileData.Address || "",
        }));
      }
    });
  }, [registerModalOpen, selectedDivision, tournamentId]);

  useEffect(() => {
    if (!selectedDivisionId) return;

    tournamentApi
      .getMatches(tournamentId, selectedDivisionId)
      .then((data) => setMatches(data || []))
      .catch((err) => {
        console.error("Error loading matches", err);
        setMatches([]);
      });
  }, [selectedDivisionId, tournamentId]);

  useEffect(() => {
    if (!selectedDivisionId) return;

    if (activeTab === "standings") {
      tournamentApi
        .getStandings(tournamentId, selectedDivisionId)
        .then((data) => setStandings(data))
        .catch((err) => console.error("Error loading standings", err));
    }
  }, [selectedDivisionId, activeTab, tournamentId]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const isSingles = selectedDivision?.CompetitionFormat === "MenSingles" || 
                      selectedDivision?.CompetitionFormat === "WomenSingles" || 
                      selectedDivision?.CompetitionFormat === "Singles";

    // Validate Athlete 1
    if (!athlete1.phoneNumber.trim()) {
      errors.phoneNumber1 = "Số điện thoại là bắt buộc";
    } else if (!/^\d{10}$/.test(athlete1.phoneNumber.trim())) {
      errors.phoneNumber1 = "Số điện thoại phải gồm 10 chữ số";
    }

    if (!athlete1.fullName.trim()) {
      errors.fullName1 = "Họ và tên là bắt buộc";
    }
    if (!athlete1.email || !athlete1.email.trim()) {
      errors.email1 = "Email là bắt buộc";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(athlete1.email.trim())) {
      errors.email1 = "Email không đúng định dạng";
    }
    if (athlete1.rating === undefined || athlete1.rating === null || isNaN(athlete1.rating) || athlete1.rating <= 0) {
      errors.rating1 = "Điểm trình là bắt buộc và phải lớn hơn 0";
    }
    if (!athlete1.province.trim()) {
      errors.province1 = "Tỉnh thành là bắt buộc";
    }
    if (!athlete1.gender) {
      errors.gender1 = "Giới tính là bắt buộc";
    }
    if (!athlete1.dateOfBirth) {
      errors.dateOfBirth1 = "Ngày sinh là bắt buộc";
    }
    if (!athlete1.cccdUrl || !athlete1.cccdUrl.trim()) {
      errors.cccdUrl1 = "Link Profile DUPR hoặc DUPR ID là bắt buộc";
    }

    // Validate Athlete 2 (Doubles ManualForm option only)
    if (!isSingles && partnerOption === "ManualForm") {
      if (!athlete2.phoneNumber.trim()) {
        errors.phoneNumber2 = "Số điện thoại là bắt buộc";
      } else if (!/^\d{10}$/.test(athlete2.phoneNumber.trim())) {
        errors.phoneNumber2 = "Số điện thoại phải gồm 10 chữ số";
      }

      if (!athlete2.fullName.trim()) {
        errors.fullName2 = "Họ và tên là bắt buộc";
      }
      if (!athlete2.email || !athlete2.email.trim()) {
        errors.email2 = "Email là bắt buộc";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(athlete2.email.trim())) {
        errors.email2 = "Email không đúng định dạng";
      }
      if (athlete2.rating === undefined || athlete2.rating === null || isNaN(athlete2.rating) || athlete2.rating <= 0) {
        errors.rating2 = "Điểm trình là bắt buộc và phải lớn hơn 0";
      }
      if (!athlete2.province.trim()) {
        errors.province2 = "Tỉnh thành là bắt buộc";
      }
      if (!athlete2.gender) {
        errors.gender2 = "Giới tính là bắt buộc";
      }
      if (!athlete2.dateOfBirth) {
        errors.dateOfBirth2 = "Ngày sinh là bắt buộc";
      }
      if (!athlete2.cccdUrl || !athlete2.cccdUrl.trim()) {
        errors.cccdUrl2 = "Link Profile DUPR hoặc DUPR ID là bắt buộc";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterSingles = async (division: TournamentDivision) => {
    if (!validateForm()) {
      setError("Vui lòng điền đầy đủ và đúng định dạng các thông tin bắt buộc màu đỏ.");
      return;
    }
    setRegisterLoading(true);
    setError("");
    setSuccess("");
    try {
      const athletePayload = {
        athleteNo: 1,
        fullName: athlete1.fullName,
        phoneNumber: athlete1.phoneNumber,
        email: athlete1.email || null,
        rating: Number(athlete1.rating),
        province: athlete1.province,
        gender: athlete1.gender,
        dateOfBirth: athlete1.dateOfBirth,
        photoUrl: athlete1.photoUrl || null,
        cccdUrl: athlete1.cccdUrl || null,
        note: athlete1.note || null,
      };

      const res = await tournamentApi.registerSingles(tournamentId, division.DivisionID, {
        athletes: [athletePayload],
      });

      if (typeof window !== "undefined") {
        localStorage.removeItem(`tournament_reg_draft_${tournamentId}_${division.DivisionID}`);
      }

      setSuccess("Đăng ký nội dung đơn thành công!");
      setRegistrationResult(res.data);
      if (res.data?.registration?.RegistrationStatus === "PendingPayment" || res.data?.status === "Pending") {
        setPaymentData({
          registrationId: res.data.registration?.RegistrationID || res.data.payment?.RegistrationID,
          amount: division.RegistrationFee,
          checkoutUrl: res.data.checkoutUrl,
        });
      }
    } catch (err: any) {
      setError(err.message || "Đăng ký thất bại");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleRegisterDoubles = async () => {
    if (!selectedDivision) return;
    if (!validateForm()) {
      setError("Vui lòng điền đầy đủ và đúng định dạng các thông tin bắt buộc màu đỏ.");
      return;
    }
    setRegisterLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload: any = {
        partnerOption,
      };

      if (partnerOption === "ExistingPartner") {
        payload.partnerEmailOrPhone = partnerContact;
      } else if (partnerOption === "ManualForm") {
        payload.teamName = `${athlete1.fullName} - ${athlete2.fullName}`;
        payload.athletes = [
          {
            athleteNo: 1,
            fullName: athlete1.fullName,
            phoneNumber: athlete1.phoneNumber,
            email: athlete1.email || null,
            rating: Number(athlete1.rating),
            province: athlete1.province,
            gender: athlete1.gender,
            dateOfBirth: athlete1.dateOfBirth,
            photoUrl: athlete1.photoUrl || null,
            cccdUrl: athlete1.cccdUrl || null,
            note: athlete1.note || null,
          },
          {
            athleteNo: 2,
            fullName: athlete2.fullName,
            phoneNumber: athlete2.phoneNumber,
            email: athlete2.email || null,
            rating: Number(athlete2.rating),
            province: athlete2.province,
            gender: athlete2.gender,
            dateOfBirth: athlete2.dateOfBirth,
            photoUrl: athlete2.photoUrl || null,
            cccdUrl: athlete2.cccdUrl || null,
            note: athlete2.note || null,
          }
        ];
      }

      const res = await tournamentApi.registerDoubles(tournamentId, selectedDivision.DivisionID, payload);

      if (typeof window !== "undefined") {
        localStorage.removeItem(`tournament_reg_draft_${tournamentId}_${selectedDivision.DivisionID}`);
      }

      setRegistrationResult(res.data);

      if (partnerOption === "SuggestOnly") {
        setSuggestions(res.data?.suggestedPartners || []);
        setSuccess("Đã tải danh sách gợi ý đồng đội. Hãy chọn một người chơi để gửi lời mời.");
      } else if (partnerOption === "AutoMatch") {
        setSuccess(res.data?.message || "Đăng ký ghép đôi tự động thành công.");
      } else {
        setSuccess("Gửi lời mời ghép cặp thành công. Đợi đồng đội đồng ý lời mời.");
        if ((res.data?.status === "Pending" || res.data?.registration?.RegistrationStatus === "PendingPayment") && (res.data?.checkoutUrl || res.data?.payment?.RegistrationID)) {
          setPaymentData({
            registrationId: res.data.payment?.RegistrationID || res.data.registration?.RegistrationID,
            amount: selectedDivision.RegistrationFee,
            checkoutUrl: res.data.checkoutUrl,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "Đăng ký ghép cặp thất bại");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleSendPayOSPayment = async () => {
    if (!paymentData) return;
    setRegisterLoading(true);
    setError("");
    try {
      const res = await tournamentApi.createPayment(paymentData.registrationId, "PayOS");
      if (res && res.checkoutUrl) {
        setSuccess("Đang chuyển hướng sang cổng thanh toán VietQR PayOS...");
        setTimeout(() => {
          window.location.href = res.checkoutUrl;
        }, 1500);
      } else {
        throw new Error("Không nhận được liên kết thanh toán từ cổng PayOS.");
      }
    } catch (err: any) {
      setError(err.message || "Không thể khởi tạo liên kết thanh toán");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleRetryPayment = async (registrationId: number, amount: number) => {
    setRegisterLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await tournamentApi.createPayment(registrationId, "PayOS");
      if (res && res.checkoutUrl) {
        setSuccess("Đang chuyển hướng sang cổng thanh toán VietQR PayOS...");
        setTimeout(() => {
          window.location.href = res.checkoutUrl;
        }, 1500);
      } else {
        throw new Error("Không nhận được liên kết thanh toán từ cổng PayOS.");
      }
    } catch (err: any) {
      setError(err.message || "Không thể khởi tạo liên kết thanh toán");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleFileUpload = async (file: File, type: "athlete1" | "athlete2" | "cccd" | "transfer") => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${baseUrl}/api/tournaments/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload thất bại");

      const fileUrl = data.data.url;
      if (type === "athlete1") {
        setAthlete1(prev => ({ ...prev, photoUrl: fileUrl }));
      } else if (type === "athlete2") {
        setAthlete2(prev => ({ ...prev, photoUrl: fileUrl }));
      } else if (type === "cccd") {
        setAthlete1(prev => ({ ...prev, cccdUrl: fileUrl }));
      } else if (type === "transfer") {
        setAthlete1(prev => ({ ...prev, transferUrl: fileUrl }));
      }
    } catch (err: any) {
      alert("Lỗi upload file: " + err.message);
    }
  };

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
      case "RegistrationClosed":
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

  const handleOpenMatchingModal = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("pickleclub_token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    setMatchingModalOpen(true);
    setLoadingPlayers(true);
    try {
      const data = await getSuitableTeammates(token);
      setSuitablePlayers(data || []);
    } catch (err) {
      console.error("Error loading suitable players:", err);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handleToggleExpandPlayer = (playerId: number) => {
    setExpandedPlayerIds(prev => 
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };

  const handleSendInviteToPlayer = async (player: any) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("pickleclub_token") : null;
    if (!token) {
      alert("Vui lòng đăng nhập để gửi lời mời.");
      return;
    }
    setInvitationStatus(prev => ({
      ...prev,
      [player.UserID]: { sending: true, sent: false }
    }));
    try {
      const message = customInviteMsg.trim() || `Chào bạn, mình muốn gửi lời mời ghép cặp cùng tham gia giải đấu ${tournament?.TournamentName || ""} nhé!`;
      await sendInvitation(token, {
        receiverId: player.UserID,
        groupId: null,
        invitationType: "InviteToPlay",
        message: message,
      });
      setInvitationStatus(prev => ({
        ...prev,
        [player.UserID]: { sending: false, sent: true }
      }));
      setInvitingPlayer(null);
      setCustomInviteMsg("");
    } catch (err: any) {
      console.error("Error sending invitation:", err);
      setInvitationStatus(prev => ({
        ...prev,
        [player.UserID]: { sending: false, sent: false, error: err.message || "Gửi lời mời thất bại. Có thể hai người đã có lời mời chờ xử lý hoặc đã ghép cặp." }
      }));
    }
  };

  if (loading) {
    return (
      <div className="tm-body min-h-screen flex flex-col items-center justify-center gap-4" style={{ height: "100vh" }}>
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm">Đang tải chi tiết giải đấu...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="tm-body min-h-screen py-20 text-center">
        <p className="text-red-400 text-lg">Không tìm thấy thông tin giải đấu.</p>
      </div>
    );
  }

  return (
    <div className="tm-body min-h-screen pb-20">
      {/* Redesigned Premium Header Banner with surrounding glass effects */}
      <div className="td-banner-wrapper container">
        {/* Floating surrounding glass shards (hiệu ứng xung quanh) */}
        <div className="td-banner-shard-1"></div>
        <div className="td-banner-shard-2"></div>
        
        <div className="td-banner-container" style={tournament.ImageURL ? {
          backgroundImage: `linear-gradient(to right, #053225 0%, #053225 40%, rgba(5, 50, 37, 0.3) 75%, rgba(5, 50, 37, 0) 100%), url(${tournament.ImageURL})`,
          backgroundSize: "60% 100%",
          backgroundPosition: "right center",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#053225",
        } : undefined}>
          {/* Subtle Background Elements */}
          <div className="td-banner-bg-lines"></div>
          <div className="td-banner-bg-mesh"></div>
          <div className="td-banner-glow"></div>
          <div className="td-banner-watermark">CHAMPIONSHIP</div>

          <div className="td-banner-container-split">
            {/* Left Column */}
            <div className="td-banner-left-col">
              {/* Badge */}
              <div style={{ display: "inline-block", alignSelf: "flex-start", marginBottom: "16px" }}>
                <span className="td-season-badge">
                  MÙA GIẢI {new Date(tournament.StartDate || Date.now()).getFullYear()}
                </span>
              </div>

              {/* Title */}
              <h1 className="td-banner-title">
                {tournament.TournamentName}
              </h1>

              {/* Short desc */}
              <p className="td-banner-desc" style={{ marginTop: "12px", marginBottom: "8px" }}>
                “Giải đấu pickleball phong trào dành cho các tay vợt muốn giao lưu, thử sức và chinh phục danh hiệu mùa hè.”
              </p>

              {/* Info chips */}
              <div className="td-banner-info-chips">
                <span className="td-info-chip">📅 {formatDate(tournament.StartDate)} - {formatDate(tournament.EndDate)}</span>
                <span className="td-info-chip">📍 {tournament.Location}</span>
                <span className="td-info-chip">⏱️ Hạn: {formatDate(tournament.RegistrationEnd)}</span>
                <span className="td-info-chip">🏆 Trình độ: 3.0 - 4.5</span>
              </div>
            </div>

            {/* Right Column: CTA card */}
            <div className="td-banner-cta-card">
              <div className="td-cta-header">
                <span className="td-cta-status-label">Trạng thái:</span>
                {getStatusBadge(tournament.Status)}
              </div>
              
              <div className="td-cta-price-row">
                <span className="td-cta-price-lbl">Lệ phí tham gia:</span>
                <span className="td-cta-price-val">
                  {divisions.length > 0 
                    ? `${Math.min(...divisions.map(d => d.RegistrationFee)).toLocaleString()} VNĐ` 
                    : "Liên hệ BTC"}
                </span>
              </div>

              <div className="td-cta-deadline-row">
                <span>⏱️ Hạn đăng ký:</span>
                <strong>{formatDate(tournament.RegistrationEnd)}</strong>
              </div>

              <div className="td-cta-actions">
                <button 
                  type="button"
                  className="tm-btn tm-btn-primary w-full"
                  onClick={() => {
                    setActiveTab("divisions");
                    document.getElementById("tournament-tabs-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Đăng ký ngay ➜
                </button>
                <button 
                  type="button"
                  className="tm-btn tm-btn-secondary w-full"
                  onClick={() => {
                    setActiveTab("info");
                    document.getElementById("tournament-tabs-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Xem điều lệ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: "32px" }}>
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl mb-6 text-sm text-center">
            {success}
          </div>
        )}

        {/* Tab Controls - Sticky Tab Bar with icons */}
        <div id="tournament-tabs-section" className="td-sticky-tab-bar">
          {[
            { id: "info", label: "Tổng quan", icon: "📊" },
            { id: "divisions", label: "Nội dung & Đăng ký", icon: "📝" },
            { id: "bracket", label: "Nhánh đấu / Lịch đấu", icon: "🏆" },
            { id: "standings", label: "Bảng xếp hạng", icon: "📈" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`td-tab-button ${activeTab === tab.id ? "td-tab-button-active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        {activeTab === "info" && (
          <div className="tm-details-layout">
            {/* Left: General info, Timeline, Accordions */}
            <div className="tm-details-panel-left">
              {/* Stat cards row */}
              <div className="td-stat-cards-row">
                <div className="td-stat-card">
                  <strong>Nội dung</strong>
                  <span>Đơn & Đôi</span>
                </div>
                <div className="td-stat-card">
                  <strong>Trình độ</strong>
                  <span>3.0 / 3.5 / 4.0</span>
                </div>
                <div className="td-stat-card">
                  <strong>Thể thức</strong>
                  <span>Vòng bảng + Loại</span>
                </div>
                <div className="td-stat-card">
                  <strong>Check-in</strong>
                  <span>Trước 30 phút</span>
                </div>
              </div>

              {/* Giới thiệu giải đấu */}
              <div className="tm-details-panel" style={{ marginTop: "24px" }}>
                <h3 className="tm-details-panel-title">
                  <span className="td-title-icon-wrapper td-title-sparkles"><LuSparkles size={18} /></span> Giới thiệu giải đấu
                </h3>
                <p style={{ color: "var(--tm-text)", fontSize: "0.9375rem", lineHeight: "1.75", marginBottom: "20px" }}>
                  Giải đấu Pickleball vô địch PickleClub lần này quy tụ các câu lạc bộ và cá nhân đam mê thể thao trên toàn quốc. Đây là sân chơi lý tưởng để cọ xát, nâng cao trình độ thi đấu chuyên nghiệp, đồng thời mở rộng mạng lưới giao lưu cộng đồng pickleball Việt Nam.
                </p>
                <div className="td-highlights-grid">
                  <div className="td-highlight-item">
                    <span className="td-hl-icon-badge td-hl-icon-shield"><LuShieldCheck size={18} /></span>
                    <div>
                      <strong>Minh bạch & Công bằng</strong>
                      <p>Trọng tài điều hành đạt chuẩn, DUPR được xác minh nghiêm ngặt.</p>
                    </div>
                  </div>
                  <div className="td-highlight-item">
                    <span className="td-hl-icon-badge td-hl-icon-handshake"><LuHandshake size={18} /></span>
                    <div>
                      <strong>Giao lưu cộng đồng</strong>
                      <p>Cơ hội học hỏi kinh nghiệm từ các tay vợt xuất sắc trên toàn quốc.</p>
                    </div>
                  </div>
                  <div className="td-highlight-item">
                    <span className="td-hl-icon-badge td-hl-icon-gift"><LuGift size={18} /></span>
                    <div>
                      <strong>Nhiều phần thưởng</strong>
                      <p>Tổng cơ cấu giải thưởng hấp dẫn lên tới hàng chục triệu đồng.</p>
                    </div>
                  </div>
                  <div className="td-highlight-item">
                    <span className="td-hl-icon-badge td-hl-icon-flame"><LuFlame size={18} /></span>
                    <div>
                      <strong>Tổ chức chuyên nghiệp</strong>
                      <p>Đầy đủ dịch vụ nước uống, y tế, truyền thông phục vụ vận động viên.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="tm-details-panel" style={{ marginTop: "24px" }}>
                <h3 className="tm-details-panel-title">
                  <span className="td-title-icon-wrapper td-title-calendar"><LuCalendar size={18} /></span> Timeline giải đấu
                </h3>
                <div className="td-timeline">
                  {[
                    { label: "Mở đăng ký", date: formatDate(tournament.RegistrationStart), done: true },
                    { label: "Đóng đăng ký", date: formatDate(tournament.RegistrationEnd), done: true },
                    { label: "Công bộ lịch đấu", date: "Dự kiến trước thi đấu 3 ngày", done: false },
                    { label: "Thi đấu chính thức", date: formatDate(tournament.StartDate), done: false },
                    { label: "Chung kết & Trao giải", date: formatDate(tournament.EndDate), done: false }
                  ].map((item, idx) => (
                    <div key={idx} className={`td-timeline-node ${item.done ? "td-timeline-node-done" : ""}`}>
                      <div className="td-node-indicator">
                        {item.done ? "✓" : idx + 1}
                      </div>
                      <div className="td-node-content">
                        <strong>{item.label}</strong>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Accordion Điều lệ */}
              <div id="tournament-rules-section" className="tm-details-panel" style={{ marginTop: "24px" }}>
                <h3 className="tm-details-panel-title">
                  <span className="td-title-icon-wrapper td-title-rules"><LuFileText size={18} /></span> Điều lệ & Quy định chi tiết
                </h3>
                <div className="td-accordion-wrap">
                  {[
                    { 
                      title: "Cơ cấu giải thưởng giải đấu", 
                      content: tournament ? (tournament.PrizeInfo || "Thông tin giải thưởng đang được Ban tổ chức cập nhật.") : "Đang tải thông tin..."
                    },
                    { 
                      title: "Quy chế & Điều lệ chi tiết", 
                      content: tournament ? (tournament.Rules || "Thông tin quy chế đang được Ban tổ chức cập nhật.") : "Đang tải thông tin..."
                    },
                    { 
                      title: "Thể thức thi đấu chi tiết", 
                      content: "Giải đấu áp dụng thể thức thi đấu chia bảng (vòng tròn tính điểm 1 lượt). Chọn ra 2 đội có điểm số cao nhất mỗi bảng để tiến vào vòng loại trực tiếp. Các trận đấu ở vòng bảng thi đấu chạm 11 hoặc 15, vòng knock-out thi đấu chạm 21 hoặc Best of 3 set."
                    },
                    { 
                      title: "Quy định check-in & Hồ sơ", 
                      content: "Vận động viên phải check-in tại bàn BTC tối thiểu 30 phút trước thời gian trận đấu diễn ra. VĐV cần mang theo CCCD bản gốc để xác minh danh tính. Mọi khiếu nại về hồ sơ chỉ được giải quyết trước giờ thi đấu 15 phút."
                    },
                    { 
                      title: "Quy định trang phục & Thiết bị", 
                      content: "Vận động viên mặc trang phục thể thao lịch sự, đi giày đế bằng chuyên dụng (non-marking soles) để tránh làm hỏng mặt sân. Vợt thi đấu phải là vợt pickleball tiêu chuẩn, không có các chất hỗ trợ lực hoặc thiết kế bề mặt nhám sai quy định."
                    },
                    { 
                      title: "Luật tính điểm & Trọng tài", 
                      content: "Luật tính điểm áp dụng theo hệ thống tính điểm quốc tế USAPA. Các quyết định của Trọng tài chính trên sân là quyết định cuối cùng. Trong trường hợp có tranh chấp hoặc khiếu nại nghiêm trọng, Ban tổ chức sẽ họp và đưa ra phán quyết xử lý."
                    },
                    { 
                      title: "Liên hệ & Giải quyết khiếu nại", 
                      content: "Mọi thắc mắc hoặc khiếu nại, vui lòng liên hệ trực tiếp văn phòng BTC hoặc gửi email hỗ trợ thông qua đường dây nóng. BTC có quyền thay đổi khung giờ hoặc lịch thi đấu nếu điều kiện thời tiết không cho phép."
                    }
                  ].map((item, idx) => (
                    <AccordionItem key={idx} title={item.title} content={item.content} />
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Chi tiết tổ chức */}
            <div className="tm-details-panel-right">
              <div className="td-org-card">
                <h3 className="td-org-card-title">Chi tiết tổ chức</h3>
                
                <div className="td-org-list">
                  <div className="td-org-item">
                    <span className="td-org-icon-badge td-icon-location"><LuMapPin size={16} /></span>
                    <div>
                      <strong>Địa điểm</strong>
                      <p>{tournament.Location}</p>
                    </div>
                  </div>
                  <div className="td-org-item">
                    <span className="td-org-icon-badge td-icon-calendar"><LuCalendar size={16} /></span>
                    <div>
                      <strong>Thời gian thi đấu</strong>
                      <p>{formatDate(tournament.StartDate)} - {formatDate(tournament.EndDate)}</p>
                    </div>
                  </div>
                  <div className="td-org-item">
                    <span className="td-org-icon-badge td-icon-deadline"><LuClock size={16} /></span>
                    <div>
                      <strong>Đóng đăng ký</strong>
                      <p>{formatDate(tournament.RegistrationEnd)}</p>
                    </div>
                  </div>
                  <div className="td-org-item">
                    <span className="td-org-icon-badge td-icon-organizer"><LuBuilding size={16} /></span>
                    <div>
                      <strong>Nhà tổ chức</strong>
                      <p>{tournament.OrganizerName}</p>
                    </div>
                  </div>
                  <div className="td-org-item">
                    <span className="td-org-icon-badge td-icon-support"><LuPhone size={16} /></span>
                    <div>
                      <strong>Liên hệ hỗ trợ</strong>
                      <p>support@pickleclub.com / 1900 1234</p>
                    </div>
                  </div>
                  <div className="td-org-item">
                    <span className="td-org-icon-badge td-icon-fee"><LuWallet size={16} /></span>
                    <div>
                      <strong>Phí tham gia tối thiểu</strong>
                      <p>
                        {divisions.length > 0 
                          ? `${Math.min(...divisions.map(d => d.RegistrationFee)).toLocaleString()} VNĐ` 
                          : "Liên hệ BTC"}
                      </p>
                    </div>
                  </div>
                  <div className="td-org-item">
                    <span className="td-org-icon-badge td-icon-teams"><LuUsers size={16} /></span>
                    <div>
                      <strong>Số lượng tối đa</strong>
                      <p>Không giới hạn / Theo từng nội dung</p>
                    </div>
                  </div>
                </div>

                <div className="td-org-divider" />

                <div className="td-org-actions">
                  <button 
                    type="button" 
                    className="tm-btn tm-btn-primary w-full"
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tournament.Location)}`, "_blank")}
                  >
                    Xem bản đồ
                  </button>
                  <button 
                    type="button" 
                    className="tm-btn tm-btn-secondary w-full"
                    onClick={() => window.location.href = "mailto:support@pickleclub.com"}
                  >
                    Liên hệ BTC
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "divisions" && (() => {
          const filteredDivisions = divisions.filter(div => {
            if (onlyAvailable) {
              const maxTeams = div.MaxTeams || 48;
              const registeredCount = (div as any).RegisteredCount || 0;
              if (registeredCount >= maxTeams) return false;
            }

            if (divisionFilter === "All") return true;

            if (divisionFilter === "MenSingles") {
              return div.CompetitionFormat === "MenSingles" || (div.CompetitionFormat === "Singles" && div.GenderRequirement === "MaleOnly");
            }
            if (divisionFilter === "WomenSingles") {
              return div.CompetitionFormat === "WomenSingles" || (div.CompetitionFormat === "Singles" && div.GenderRequirement === "FemaleOnly");
            }
            if (divisionFilter === "MenDoubles") {
              return div.CompetitionFormat === "MenDoubles" || (div.CompetitionFormat === "Doubles" && div.GenderRequirement === "MaleOnly");
            }
            if (divisionFilter === "WomenDoubles") {
              return div.CompetitionFormat === "WomenDoubles" || (div.CompetitionFormat === "Doubles" && div.GenderRequirement === "FemaleOnly");
            }
            if (divisionFilter === "MixedDoubles") {
              return div.CompetitionFormat === "MixedDoubles" || (div.CompetitionFormat === "Doubles" && (div.GenderRequirement === "Coed" || div.GenderRequirement === "None"));
            }
            return true;
          });

          const showSinglesCard = (() => {
            if (divisionFilter === "MenSingles" || divisionFilter === "WomenSingles") return true;
            if (divisionFilter === "MenDoubles" || divisionFilter === "WomenDoubles" || divisionFilter === "MixedDoubles") return false;
            
            if (myRegistrations.length > 0) {
              const registeredDivIds = myRegistrations.map(r => r.DivisionID);
              const registeredDivs = divisions.filter(d => registeredDivIds.includes(d.DivisionID));
              const hasSingles = registeredDivs.some(d => 
                d.CompetitionFormat === "MenSingles" || d.CompetitionFormat === "WomenSingles" || d.CompetitionFormat === "Singles"
              );
              const hasDoubles = registeredDivs.some(d => 
                d.CompetitionFormat === "MenDoubles" || d.CompetitionFormat === "WomenDoubles" || d.CompetitionFormat === "MixedDoubles" || d.CompetitionFormat === "Doubles"
              );
              if (hasSingles && !hasDoubles) return true;
              if (hasDoubles && !hasSingles) return false;
            }

            if (filteredDivisions.length > 0) {
              const allSingles = filteredDivisions.every(d => 
                d.CompetitionFormat === "MenSingles" || d.CompetitionFormat === "WomenSingles" || d.CompetitionFormat === "Singles"
              );
              if (allSingles) return true;
            }
            
            return false;
          })();

          const currentDivReg = myRegistrations.find(reg => {
            if (selectedDivisionId && reg.DivisionID === selectedDivisionId) return true;
            const div = divisions.find(d => d.DivisionID === reg.DivisionID);
            if (!div) return false;
            if (divisionFilter === "MenSingles") {
              return div.CompetitionFormat === "MenSingles" || (div.CompetitionFormat === "Singles" && div.GenderRequirement === "MaleOnly");
            }
            if (divisionFilter === "WomenSingles") {
              return div.CompetitionFormat === "WomenSingles" || (div.CompetitionFormat === "Singles" && div.GenderRequirement === "FemaleOnly");
            }
            return false;
          }) || myRegistrations[0];

          let registrationStatusText = "Chưa đăng ký tham gia";
          if (currentDivReg) {
            if (currentDivReg.RegistrationStatus === "Confirmed" || currentDivReg.RegistrationStatus === "Paid") {
              registrationStatusText = "Đã duyệt & Xác nhận";
            } else if (currentDivReg.RegistrationStatus === "PendingPayment") {
              registrationStatusText = "Chờ thanh toán";
            } else {
              registrationStatusText = "Đã đăng ký (Chờ duyệt)";
            }
            const regDiv = divisions.find(d => d.DivisionID === currentDivReg.DivisionID);
            if (regDiv) {
              registrationStatusText += ` (${regDiv.DivisionName})`;
            }
          }

          const getRegStatusText = (status: string) => {
            switch (status) {
              case "Confirmed":
                return "đã xác nhận tham gia";
              case "Paid":
                return "đã duyệt";
              case "PendingPayment":
                return "chờ xác nhận";
              default:
                return "chờ xác nhận";
            }
          };

          return (
            <div>
              {myRegistrations.filter(r => r.RegistrationStatus === "PendingPayment").map((reg) => (
                <PendingRegistrationBanner 
                  key={reg.RegistrationID} 
                  reg={reg} 
                  handleRetryPayment={handleRetryPayment} 
                  registerLoading={registerLoading} 
                  onExpired={refreshRegistrations}
                />
              ))}

              {myRegistrations.filter(r => r.RegistrationStatus === "Confirmed").map((reg) => (
                <ConfirmedRegistrationBanner 
                  key={reg.RegistrationID} 
                  reg={reg}
                  tournament={tournament}
                  divisions={divisions}
                  onViewCertificate={handleShowCertificate}
                />
              ))}

              {/* Filter Bar */}
              <div className="td-filter-bar">
                <div className="td-filter-pills">
                  {[
                    { id: "All", label: "Tất cả" },
                    { id: "MenSingles", label: "Đơn nam" },
                    { id: "WomenSingles", label: "Đơn nữ" },
                    { id: "MenDoubles", label: "Đôi nam" },
                    { id: "WomenDoubles", label: "Đôi nữ" },
                    { id: "MixedDoubles", label: "Đôi nam nữ" }
                  ].map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      className={`td-filter-pill ${divisionFilter === pill.id ? "td-filter-pill-active" : ""}`}
                      onClick={() => setDivisionFilter(pill.id)}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
                <label className="td-filter-switch-label">
                  <input 
                    type="checkbox" 
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                  />
                  <span>Chỉ hiện nội dung còn chỗ</span>
                </label>
              </div>

              {divisions.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", border: "1px solid var(--tm-border)", borderRadius: "16px", background: "#fff" }}>
                  <p className="text-slate-400">Chưa cập nhật nội dung thi đấu cho giải này.</p>
                </div>
              ) : (
                <>
                  <div className="tm-details-layout-divisions">
                  {/* Left Column: Division Cards list */}
                  <div className="tm-details-panel-left" style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
                    {filteredDivisions.length === 0 ? (
                      <div style={{ padding: "36px", textAlign: "center", border: "1.5px dashed rgba(0, 168, 107, 0.15)", borderRadius: "16px", background: "#fff", color: "var(--tm-muted)" }}>
                        Không tìm thấy nội dung thi đấu phù hợp bộ lọc.
                      </div>
                    ) : (
                      filteredDivisions.map((div) => {
                        const isSingles = div.CompetitionFormat === "MenSingles" || div.CompetitionFormat === "WomenSingles" || div.CompetitionFormat === "Singles";
                        const maxTeams = div.MaxTeams || 48;
                        const registeredCount = (div as any).RegisteredCount || 0;
                        const slotsLeft = Math.max(0, maxTeams - registeredCount);
                        const pct = Math.round((registeredCount / maxTeams) * 100);
                        
                        let formatName = isSingles ? "Đơn" : "Đôi";
                        if (div.CompetitionFormat === "MenSingles") formatName = "Đơn Nam";
                        else if (div.CompetitionFormat === "WomenSingles") formatName = "Đơn Nữ";
                        else if (div.CompetitionFormat === "MenDoubles") formatName = "Đôi Nam";
                        else if (div.CompetitionFormat === "WomenDoubles") formatName = "Đôi Nữ";
                        else if (div.CompetitionFormat === "MixedDoubles") formatName = "Đôi Nam Nữ";
                        else if (div.CompetitionFormat === "Doubles") {
                          if (div.GenderRequirement === "MaleOnly") formatName = "Đôi Nam";
                          else if (div.GenderRequirement === "FemaleOnly") formatName = "Đôi Nữ";
                          else formatName = "Đôi Nam Nữ";
                        }

                        const feeK = div.RegistrationFee >= 1000 ? `${div.RegistrationFee.toLocaleString()}đ` : `${div.RegistrationFee.toLocaleString()} VNĐ`;
                        const feeUnit = isSingles ? "người" : "đôi";

                        const isFull = registeredCount >= maxTeams;
                        const isNearFull = pct >= 80;
                        const progressText = isFull ? "Hết chỗ" : "Còn chỗ";
                        const progressColor = isFull ? "#ef4444" : isNearFull ? "#f97316" : "#00a86b";

                        const myDivReg = myRegistrations.find(r => r.DivisionID === div.DivisionID);
                        const isActive = selectedDivision?.DivisionID === div.DivisionID;

                        return (
                          <div key={div.DivisionID} className={`td-entry-card ${isActive ? "td-entry-card-active" : ""}`}>
                            {/* Row 1: Format Badge & Price */}
                            <div className="td-entry-row1">
                              <span className="td-entry-badge">
                                {formatName}
                              </span>
                              <div className="td-entry-price-block">
                                <span className="td-entry-price">{feeK}</span>
                                <span className="td-entry-price-unit"> / {feeUnit}</span>
                              </div>
                            </div>

                            {/* Row 2: Title */}
                            <div className="td-entry-row2">
                              <h4 className="td-entry-name">
                                {div.DivisionName}
                              </h4>
                            </div>

                            {/* Row 3: 2-Column Specs Grid */}
                            <div className="td-entry-row3-grid">
                              <div className="td-entry-grid-item">
                                <span className="td-entry-grid-label">Giới tính:</span>
                                <span className="td-entry-grid-val">
                                  {div.GenderRequirement === "MaleOnly" ? "Nam" : div.GenderRequirement === "FemaleOnly" ? "Nữ" : "Nam/Nữ"}
                                </span>
                              </div>
                              <div className="td-entry-grid-item">
                                <span className="td-entry-grid-label">Độ tuổi:</span>
                                <span className="td-entry-grid-val">{div.AgeGroup}</span>
                              </div>
                              <div className="td-entry-grid-item">
                                <span className="td-entry-grid-label">DUPR:</span>
                                <span className="td-entry-grid-val">
                                  {div.MinDUPR !== null ? `${div.MinDUPR} - ${div.MaxDUPR}` : "Open"}
                                </span>
                              </div>
                              <div className="td-entry-grid-item">
                                <span className="td-entry-grid-label">Tối đa:</span>
                                <span className="td-entry-grid-val">
                                  {maxTeams} {isSingles ? "VĐV" : "Cặp"}
                                </span>
                              </div>
                            </div>

                            {/* Lịch trình dự kiến của các vòng đấu */}
                            {(() => {
                              const scheduleConfig = (div as any).RoundScheduleConfig || (div as any).roundScheduleConfig;
                              if (scheduleConfig) {
                                try {
                                  const config = typeof scheduleConfig === "string" ? JSON.parse(scheduleConfig) : scheduleConfig;
                                  if (Array.isArray(config) && config.length > 0) {
                                    return (
                                      <div style={{ 
                                        margin: "12px 0 4px 0", 
                                        background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", 
                                        padding: "10px 14px", 
                                        borderRadius: "10px", 
                                        border: "1px solid #cbd5e1" 
                                      }}>
                                        <p style={{ margin: "0 0 6px 0", fontSize: "0.75rem", fontWeight: "750", color: "#1e293b", display: "flex", alignItems: "center", gap: "4px" }}>
                                          📅 Lịch trình dự kiến:
                                        </p>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                          {config.map((item: any, idx: number) => {
                                            const dateStr = item.scheduledStart 
                                              ? new Date(item.scheduledStart).toLocaleString("vi-VN", {
                                                  day: "2-digit",
                                                  month: "2-digit",
                                                  hour: "2-digit",
                                                  minute: "2-digit"
                                                })
                                              : "Chưa cấu hình";
                                            return (
                                              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#475569" }}>
                                                <span style={{ fontWeight: "500" }}>{item.roundName || `Vòng ${item.roundNo}`}:</span>
                                                <span style={{ fontWeight: "700", color: "#0f172a" }}>{dateStr}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  }
                                } catch (e) {
                                  return null;
                                }
                              }
                              return null;
                            })()}

                            {/* Row 4: Slot status / Progress Bar */}
                            <div className="td-entry-row4-capacity">
                              <div className="td-entry-capacity-header">
                                <span>{slotsLeft}/{maxTeams} suất còn trống</span>
                                <span className="td-entry-capacity-status" style={{ color: progressColor }}>
                                  {progressText}
                                </span>
                              </div>
                              <div className="td-entry-progress-bg">
                                <div 
                                  className="td-entry-progress-fill" 
                                  style={{ 
                                    width: `${Math.min(100, pct)}%`, 
                                    background: progressColor 
                                  }} 
                                />
                              </div>
                            </div>

                            {/* Row 5: Action CTA */}
                            {(() => {
                              const isExpired = new Date() > new Date(tournament.RegistrationEnd);
                              const isStatusClosed = tournament.Status !== "Open" && tournament.Status !== "Published";
                              const isButtonDisabled = !!myDivReg || isFull || isExpired || isStatusClosed;
                              
                              let buttonText = "Đăng ký ngay";
                              if (myDivReg) buttonText = "Đã đăng ký nội dung này";
                              else if (isStatusClosed) buttonText = tournament.Status === "DrawGenerated" ? "Đã chốt danh sách" : "Đã đóng đăng ký";
                              else if (isExpired) buttonText = "Đã quá hạn đăng ký";
                              else if (isFull) buttonText = "Hết chỗ (Tham gia hàng chờ)";

                              return (
                                <button
                                  type="button"
                                  disabled={isButtonDisabled}
                                  onClick={() => {
                                    const token = typeof window !== "undefined" ? localStorage.getItem("pickleclub_token") : null;
                                    if (!token) {
                                      router.push("/login");
                                      return;
                                    }
                                    setSelectedDivision(div);
                                    setRegisterModalOpen(true);
                                  }}
                                  className={`td-entry-btn ${isButtonDisabled ? "td-entry-btn-disabled" : ""}`}
                                >
                                  {buttonText}
                                </button>
                              );
                            })()}

                            {/* Row 6: Status Panel */}
                            {myDivReg && (() => {
                              const statusLabel = getRegStatusText(myDivReg.RegistrationStatus);
                              const isReady = myDivReg.RegistrationStatus === "Confirmed" || myDivReg.RegistrationStatus === "Paid";
                              const isPending = myDivReg.RegistrationStatus === "PendingPayment";

                              return (
                                <div style={{ 
                                  marginTop: "16px", 
                                  padding: "16px", 
                                  background: isReady ? "#f0fdf4" : isPending ? "#fffbeb" : "#f8fafc", 
                                  border: `1px solid ${isReady ? "rgba(167, 243, 208, 0.4)" : isPending ? "rgba(253, 230, 138, 0.4)" : "rgba(226, 232, 240, 0.6)"}`, 
                                  borderRadius: "12px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px",
                                  textAlign: "left"
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      {isReady ? <LuTrophy size={18} style={{ color: "#059669" }} /> : <LuClock size={18} style={{ color: "#d97706" }} />}
                                    </span>
                                    <div>
                                      <h5 style={{ margin: 0, fontSize: "0.85rem", fontWeight: "800", color: isReady ? "#064e3b" : "#92400e" }}>
                                        {isReady ? "Bạn đã sẵn sàng thi đấu" : "Hồ sơ đang chờ xử lý"}
                                      </h5>
                                      <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: isReady ? "#047857" : "#b45309" }}>
                                        Trạng thái: <strong>{statusLabel}</strong> | {div.DivisionName}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div style={{ display: "flex", gap: "12px", borderTop: `1px solid ${isReady ? "rgba(5, 150, 105, 0.1)" : "rgba(245, 158, 11, 0.1)"}`, paddingTop: "10px", flexWrap: "wrap", alignItems: "center" }}>
                                    <button 
                                      type="button" 
                                      onClick={() => router.push("/bookings")}
                                      style={{ background: "transparent", border: "none", color: "#059669", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", padding: 0 }}
                                    >
                                      Xem hồ sơ
                                    </button>
                                    <span style={{ color: "rgba(100, 116, 139, 0.2)" }}>|</span>
                                    {matches && matches.length > 0 ? (
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          setActiveTab("bracket");
                                          document.getElementById("tournament-tabs-section")?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        style={{ background: "transparent", border: "none", color: "#059669", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", padding: 0 }}
                                      >
                                        Theo dõi lịch đấu
                                      </button>
                                    ) : (
                                      <button 
                                        type="button" 
                                        disabled
                                        style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "0.75rem", fontWeight: "700", cursor: "not-allowed", padding: 0 }}
                                      >
                                        Lịch đấu chưa công bố
                                      </button>
                                    )}
                                    <span style={{ color: "rgba(100, 116, 139, 0.2)" }}>|</span>
                                    <button 
                                      type="button" 
                                      onClick={() => router.push("/notifications")}
                                      style={{ background: "transparent", border: "none", color: "#059669", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", padding: 0 }}
                                    >
                                      Thông báo giải
                                    </button>

                                    {/* Partner Matching shortcuts for Doubles */}
                                    {!isSingles && (
                                      <>
                                        <span style={{ color: "rgba(100, 116, 139, 0.2)" }}>|</span>
                                        <button 
                                          type="button" 
                                          onClick={() => {
                                            const formatParam = div.CompetitionFormat;
                                            const genderParam = div.GenderRequirement;
                                            const minDuprParam = div.MinDUPR !== undefined && div.MinDUPR !== null ? div.MinDUPR : "";
                                            const maxDuprParam = div.MaxDUPR !== undefined && div.MaxDUPR !== null ? div.MaxDUPR : "";
                                            const dateParam = tournament.StartDate || "";
                                            
                                            const searchParams = new URLSearchParams();
                                            searchParams.set("tab", "teammates");
                                            searchParams.set("tournamentId", String(tournament.TournamentID));
                                            if (formatParam) searchParams.set("format", formatParam);
                                            if (genderParam) searchParams.set("gender", genderParam);
                                            if (minDuprParam !== "") searchParams.set("minDupr", String(minDuprParam));
                                            if (maxDuprParam !== "") searchParams.set("maxDupr", String(maxDuprParam));
                                            if (dateParam) searchParams.set("date", String(dateParam));
                                            
                                            router.push(`/matching?${searchParams.toString()}`);
                                          }}
                                          style={{ background: "transparent", border: "none", color: "#059669", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", padding: 0 }}
                                        >
                                          Tìm đồng đội
                                        </button>
                                        <span style={{ color: "rgba(100, 116, 139, 0.2)" }}>|</span>
                                        <button 
                                          type="button" 
                                          onClick={handleOpenMatchingModal}
                                          style={{ background: "transparent", border: "none", color: "#059669", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", padding: 0 }}
                                        >
                                          Người chơi phù hợp
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })
                    )}


                  </div>

                  {/* Right Column: Dynamic Registration CTA overview card */}
                  <div className="tm-details-panel-right" style={{ height: "100%" }}>
                    <div className="td-org-card" style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h3 className="td-org-card-title" style={{ fontSize: "15px", fontWeight: "900", color: "#073b2b", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tổng quan Đăng ký</h3>
                        
                        <div className="td-org-list" style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div className="td-org-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                            <span style={{ color: "#64748b", display: "flex", alignItems: "center", gap: "8px" }}>💰 Lệ phí:</span>
                            <strong style={{ color: "#00a86b", fontSize: "14px" }}>
                              {divisions.length > 0 
                                ? `${Math.min(...divisions.map(d => d.RegistrationFee)).toLocaleString()} VNĐ` 
                                : "Liên hệ BTC"}
                            </strong>
                          </div>
                          <div className="td-org-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                            <span style={{ color: "#64748b", display: "flex", alignItems: "center", gap: "8px" }}>⏱️ Hạn chót:</span>
                            <strong style={{ color: "#073b2b" }}>{formatDate(tournament.RegistrationEnd)}</strong>
                          </div>
                          <div className="td-org-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                            <span style={{ color: "#64748b", display: "flex", alignItems: "center", gap: "8px" }}>👥 Còn lại:</span>
                            <strong style={{ color: "#073b2b" }}>
                              {divisions.reduce((acc, d) => acc + Math.max(0, (d.MaxTeams || 48) - ((d as any).RegisteredCount || 0)), 0)} suất
                            </strong>
                          </div>
                          <div className="td-org-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "4px" }}>
                            <span style={{ color: "#64748b", display: "flex", alignItems: "center", gap: "8px" }}>⚙️ Trạng thái:</span>
                            <strong style={{ color: tournament.Status === "Open" || tournament.Status === "Published" ? "#00a86b" : "#ef4444" }}>
                              {tournament.Status === "Open" || tournament.Status === "Published" ? "Đang mở đăng ký" : "Đã đóng đăng ký"}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: "24px" }}>
                        <div className="td-org-divider" style={{ margin: "16px 0" }} />
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button 
                            type="button" 
                            className="tm-btn tm-btn-secondary w-full"
                            style={{ padding: "8px 12px", fontSize: "12px", borderRadius: "8px" }}
                            onClick={() => {
                              setActiveTab("info");
                              setTimeout(() => {
                                document.getElementById("tournament-rules-section")?.scrollIntoView({ behavior: "smooth" });
                              }, 100);
                            }}
                          >
                            Xem điều lệ
                          </button>
                          <button 
                            type="button" 
                            className="tm-btn tm-btn-primary w-full"
                            style={{ padding: "8px 12px", fontSize: "12px", borderRadius: "8px" }}
                            onClick={() => window.location.href = "mailto:support@pickleclub.com"}
                          >
                            Liên hệ hỗ trợ
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Utility Bar */}
                <div className="td-utility-bar">
                  {/* Section 1: Hồ sơ thi đấu */}
                  <div className="td-utility-item">
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div className="td-utility-item-header">
                        <span className="td-utility-item-icon"><LuUser size={18} /></span>
                        <h4 className="td-utility-item-title">Hồ sơ thi đấu</h4>
                      </div>
                      <p className="td-utility-item-desc">
                        Xem thông tin cá nhân, cập nhật DUPR và theo dõi trạng thái hồ sơ của bạn.
                      </p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => router.push("/bookings")}
                      className="td-utility-item-btn"
                    >
                      Xem hồ sơ đăng ký
                    </button>
                  </div>

                  {/* Section 2: Lịch đấu */}
                  <div className="td-utility-item">
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div className="td-utility-item-header">
                        <span className="td-utility-item-icon"><LuCalendar size={18} /></span>
                        <h4 className="td-utility-item-title">Lịch đấu</h4>
                      </div>
                      <p className="td-utility-item-desc">
                        Theo dõi sơ đồ nhánh đấu và lịch thi đấu chi tiết sau khi được ban tổ chức công bố.
                      </p>
                    </div>
                    {matches && matches.length > 0 ? (
                      <button 
                        type="button" 
                        onClick={() => {
                          setActiveTab("bracket");
                          document.getElementById("tournament-tabs-section")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="td-utility-item-btn"
                      >
                        Theo dõi lịch đấu
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        disabled 
                        className="td-utility-item-btn"
                      >
                        Lịch đấu chưa công bố
                      </button>
                    )}
                  </div>

                  {/* Section 3: Hỗ trợ đăng ký */}
                  <div className="td-utility-item">
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div className="td-utility-item-header">
                        <span className="td-utility-item-icon"><LuPhone size={18} /></span>
                        <h4 className="td-utility-item-title">Hỗ trợ đăng ký</h4>
                      </div>
                      <p className="td-utility-item-desc">
                        Hotline giải đấu: 1900 1234 (Hỗ trợ 24/7). Liên hệ để giải quyết các sự cố.
                      </p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setActiveTab("info");
                        setTimeout(() => {
                          document.getElementById("tournament-rules-section")?.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }}
                      className="td-utility-item-btn"
                    >
                      Xem FAQ & Quy định
                    </button>
                  </div>
                </div>
              </>
            )}
            </div>
          );
        })()}

        {activeTab === "bracket" && (() => {
          const selectedDiv = divisions.find(d => d.DivisionID === selectedDivisionId);
          if (!selectedDiv) return null;

          const isGroupKnockout = selectedDiv.BracketType === "GroupKnockout";
          const isRoundRobin = selectedDiv.BracketType === "RoundRobin";
          const isSingleElimination = selectedDiv.BracketType === "SingleElimination";

          const groupStageMatches = matches.filter(m => m.GroupName && m.GroupName !== "Knockout" && (!m.KnockoutRound));
          const knockoutMatches = matches.filter(m => m.GroupName === "Knockout" || m.KnockoutRound);
          const groupNames = Array.from(new Set(groupStageMatches.map(m => m.GroupName).filter(Boolean))).sort() as string[];

          let subTabs: string[] = [];
          if (isGroupKnockout) {
            subTabs = ["Overview", ...groupNames, "Knockout"];
          } else if (isSingleElimination) {
            subTabs = ["Overview", "Knockout"];
          } else {
            subTabs = ["Overview", "Bảng thi đấu"];
          }

          const activeSubTab = subTabs.includes(bracketActiveSubTab) ? bracketActiveSubTab : subTabs[0];

          const getTrackedMatchIds = (teamId: number | null, allMatches: any[]) => {
            if (!teamId) return new Set<number>();
            const pathIds = new Set<number>();
            const directMatches = allMatches.filter(m => m.TeamAID === teamId || m.TeamBID === teamId);
            directMatches.forEach(m => {
              pathIds.add(m.MatchID);
              let nextId = m.NextMatchID;
              while (nextId) {
                pathIds.add(nextId);
                const parent = allMatches.find(pm => pm.MatchID === nextId);
                nextId = parent ? parent.NextMatchID : null;
              }
            });
            return pathIds;
          };

          const trackedMatchIds = getTrackedMatchIds(trackedTeamId, matches);

          const matchesSearch = (m: any) => {
            if (searchQuery.trim() === "") return true;
            const q = searchQuery.toLowerCase();
            const nameA = (m.TeamAName || "").toLowerCase();
            const nameB = (m.TeamBName || "").toLowerCase();
            return nameA.includes(q) || nameB.includes(q);
          };

          const matchesStatus = (m: any) => {
            if (statusFilter === "All") return true;
            if (statusFilter === "Live") return m.MatchStatus === "InProgress" || m.MatchStatus === "Live";
            if (statusFilter === "Upcoming") return m.MatchStatus === "Scheduled" || m.MatchStatus === "Ready";
            if (statusFilter === "Completed") return m.MatchStatus === "Completed" || m.MatchStatus === "ByeCompleted";
            return true;
          };

          const getTeamPlaceholder = (match: any, slot: "TeamA" | "TeamB", allMatches: any[]) => {
            if (isGroupKnockout && allMatches.filter(m => m.GroupName === "Knockout").length === 0) {
              if (slot === "TeamA") return `Hạng 1 Bảng ${match.MatchNo * 2 - 1}`;
              return `Hạng 2 Bảng ${match.MatchNo * 2}`;
            }
            const child = allMatches.find(c => c.NextMatchID === match.MatchID && c.NextMatchSlot === slot);
            if (child) {
              const roundName = child.KnockoutRound || `Trận #${child.MatchID}`;
              return `Thắng ${roundName} ${child.MatchNo}`;
            }
            return "Chờ đối thủ (TBD)";
          };

          const formatMatchDateTime = (dateStr: string | null) => {
            if (!dateStr) return "Chờ lịch";
            const d = new Date(dateStr);
            const day = String(d.getDate()).padStart(2, "0");
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, "0");
            const minutes = String(d.getMinutes()).padStart(2, "0");
            return `${day}/${month}/${year} · ${hours}:${minutes}`;
          };

          const renderMatchStatusBadge = (status: string) => {
            let className = "match-status-badge ";
            let text = status;
            switch (status) {
              case "Scheduled":
                className += "match-status-scheduled";
                text = "Chưa diễn ra";
                break;
              case "Ready":
                className += "match-status-ready";
                text = "Sẵn sàng";
                break;
              case "InProgress":
              case "Live":
                className += "match-status-live";
                text = "Live";
                break;
              case "Completed":
                className += "match-status-completed";
                text = "Đã xong";
                break;
              case "Forfeit":
                className += "match-status-forfeit";
                text = "Xử thua";
                break;
              case "ByeCompleted":
              case "Bye":
                className += "match-status-bye";
                text = "Miễn đấu";
                break;
              default:
                className += "match-status-scheduled";
            }
            return <span className={className}>{text}</span>;
          };

          const renderMatchCard = (m: any, isPlaceholder: boolean = false) => {
            const isLive = m.MatchStatus === "InProgress" || m.MatchStatus === "Live";
            const isCompleted = m.MatchStatus === "Completed" || m.MatchStatus === "ByeCompleted";
            const isBye = m.MatchStatus === "ByeCompleted" || m.ScoreText === "BYE";
            
            const teamAId = m.TeamAID;
            const teamBId = m.TeamBID;
            const teamAName = m.TeamAName || (isPlaceholder ? getTeamPlaceholder(m, "TeamA", matches) : "TBD");
            const teamBName = m.TeamBName || (isPlaceholder ? getTeamPlaceholder(m, "TeamB", matches) : "TBD");

            const isWinnerA = isCompleted && m.WinnerTeamID === teamAId && teamAId !== undefined;
            const isWinnerB = isCompleted && m.WinnerTeamID === teamBId && teamBId !== undefined;
            const isLoserA = isCompleted && m.WinnerTeamID !== teamAId && teamAId !== undefined;
            const isLoserB = isCompleted && m.WinnerTeamID !== teamBId && teamBId !== undefined;

            let cardClass = "bracket-match-card";
            const isMatched = matchesSearch(m) && matchesStatus(m);

            if (trackedTeamId) {
              if (trackedMatchIds.has(m.MatchID)) {
                cardClass += " highlighted";
              } else {
                cardClass += " dimmed";
              }
            } else if (searchQuery || statusFilter !== "All") {
              if (isMatched) {
                cardClass += " highlighted";
              } else {
                cardClass += " dimmed";
              }
            }

            let parsedScores: any[] = [];
            if (m.ScoreJson) {
              try { parsedScores = JSON.parse(m.ScoreJson); } catch (e) {}
            }

            return (
              <div key={m.MatchID || `mock-${m.RoundNo}-${m.MatchNo}`} id={`match-card-${m.MatchID}`} className={cardClass}>
                <div className="bracket-match-header">
                  <span className="bracket-match-id">
                    #{m.MatchID || "TBD"}
                  </span>
                  {renderMatchStatusBadge(isBye ? "Bye" : m.MatchStatus)}
                </div>

                <div className="bracket-match-teams">
                  {/* Team A */}
                  <div 
                    className={`bracket-team-row ${isWinnerA ? "bracket-team-row-winner" : ""} ${isLoserA ? "bracket-team-row-loser" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (teamAId) setTrackedTeamId(trackedTeamId === teamAId ? null : teamAId);
                    }}
                    style={{ cursor: teamAId ? "pointer" : "default" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", minWidth: 0, flex: 1 }}>
                      <span className={`bracket-team-name ${isWinnerA ? "bracket-team-name-winner" : ""}`} title={teamAName} style={{ flexShrink: 1 }}>
                        🔵 {teamAName} {isWinnerA && "✓"}
                      </span>
                      {teamAId && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowPlayerProfile(teamAId, teamAName);
                          }}
                          style={{
                            cursor: "pointer",
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "9px",
                            fontWeight: "800",
                            color: "#2563eb",
                            background: "#eff6ff",
                            border: "1px solid #dbeafe",
                            padding: "2px 6px",
                            borderRadius: "9999px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#2563eb";
                            e.currentTarget.style.color = "#ffffff";
                            e.currentTarget.style.borderColor = "#2563eb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#eff6ff";
                            e.currentTarget.style.color = "#2563eb";
                            e.currentTarget.style.borderColor = "#dbeafe";
                          }}
                          title="Xem hồ sơ đối thủ"
                        >
                          <LuEye size={10} />
                          <span>View</span>
                        </span>
                      )}
                    </div>
                    <span className="bracket-team-score">{m.TeamASetWon ?? (isWinnerA ? "W" : (isLoserA ? "L" : "-"))}</span>
                  </div>

                  {/* Team B */}
                  <div 
                    className={`bracket-team-row ${isWinnerB ? "bracket-team-row-winner" : ""} ${isLoserB ? "bracket-team-row-loser" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (teamBId) setTrackedTeamId(trackedTeamId === teamBId ? null : teamBId);
                    }}
                    style={{ cursor: teamBId ? "pointer" : "default" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", minWidth: 0, flex: 1 }}>
                      <span className={`bracket-team-name ${isWinnerB ? "bracket-team-name-winner" : ""}`} title={teamBName} style={{ flexShrink: 1 }}>
                        🔴 {teamBName} {isWinnerB && "✓"}
                      </span>
                      {teamBId && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowPlayerProfile(teamBId, teamBName);
                          }}
                          style={{
                            cursor: "pointer",
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "9px",
                            fontWeight: "800",
                            color: "#2563eb",
                            background: "#eff6ff",
                            border: "1px solid #dbeafe",
                            padding: "2px 6px",
                            borderRadius: "9999px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#2563eb";
                            e.currentTarget.style.color = "#ffffff";
                            e.currentTarget.style.borderColor = "#2563eb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#eff6ff";
                            e.currentTarget.style.color = "#2563eb";
                            e.currentTarget.style.borderColor = "#dbeafe";
                          }}
                          title="Xem hồ sơ đối thủ"
                        >
                          <LuEye size={10} />
                          <span>View</span>
                        </span>
                      )}
                    </div>
                    <span className="bracket-team-score">{m.TeamBSetWon ?? (isWinnerB ? "W" : (isLoserB ? "L" : "-"))}</span>
                  </div>
                </div>

                {/* Set scores line */}
                {parsedScores.length > 0 && (
                  <div className="bracket-set-scores" style={{ color: isLive ? "#ef4444" : "#64748b" }}>
                    {isLive && <span className="live-dot" style={{ display: "inline-block", width: "6px", height: "6px", background: "#ef4444", borderRadius: "50%", marginRight: "4px", animation: "pulseLive 1s infinite" }} />}
                    Set: {parsedScores.map(s => `${s.teamAScore ?? 0}-${s.teamBScore ?? 0}`).join(", ")}
                  </div>
                )}

                {/* Metadata footer */}
                {!isPlaceholder && (
                  <div className="bracket-match-meta">
                    <span className="bracket-meta-court">🏟️ {m.CourtName || "Chờ xếp sân"}</span>
                    <span className="bracket-meta-time">⏱️ {formatMatchDateTime(m.ScheduledStart)}</span>
                  </div>
                )}
                
                {isBye && (
                  <div style={{ fontSize: "10.5px", color: "#64748b", fontStyle: "italic", textAlign: "center", marginTop: "2px" }}>
                    Advanced by BYE
                  </div>
                )}
              </div>
            );
          };

          const renderOverviewTab = () => {
            const total = matches.length;
            const completed = matches.filter(m => m.MatchStatus === "Completed" || m.MatchStatus === "ByeCompleted").length;
            const live = matches.filter(m => m.MatchStatus === "InProgress" || m.MatchStatus === "Live").length;
            const waiting = matches.filter(m => m.MatchStatus === "Ready").length;
            const activeCourts = Array.from(new Set(matches.filter(m => m.MatchStatus === "InProgress").map(m => m.CourtName).filter(Boolean))).length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            const filteredLiveList = matches.filter(m => m.MatchStatus === "InProgress" || m.MatchStatus === "Live").filter(matchesSearch);
            const filteredUpcomingList = matches.filter(m => m.MatchStatus === "Scheduled" || m.MatchStatus === "Ready").filter(matchesSearch).slice(0, 5);

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ background: "#ffffff", border: "1px solid var(--tm-border)", borderRadius: "16px", padding: "20px", boxShadow: "var(--tm-shadow)" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "900", color: "#073b2b", textTransform: "uppercase" }}>Tiến Độ Giải Đấu</h4>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--tm-muted)", marginBottom: "8px", fontWeight: "700" }}>
                    <span>{completed} / {total} Trận đấu đã hoàn thành</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #10b981, #059669)", borderRadius: "10px" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px" }}>
                    <div style={{ background: "#eff6ff", border: "1px solid #dbeafe", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: "10px", color: "#1e40af", fontWeight: "800", textTransform: "uppercase" }}>Đang diễn ra</span>
                      <strong style={{ fontSize: "20px", color: "#1e3a8a" }}>{live} Live</strong>
                    </div>
                    <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: "10px", color: "#854d0e", fontWeight: "800", textTransform: "uppercase" }}>Chờ thi đấu</span>
                      <strong style={{ fontSize: "20px", color: "#78350f" }}>{waiting} Trận</strong>
                    </div>
                    <div style={{ background: "#f0fdf4", border: "1px solid #d1faf0", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: "10px", color: "#166534", fontWeight: "800", textTransform: "uppercase" }}>Sân đang chạy</span>
                      <strong style={{ fontSize: "20px", color: "#064e3b" }}>{activeCourts} Sân</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
                  <div style={{ background: "#ffffff", border: "1px solid var(--tm-border)", borderRadius: "16px", padding: "20px", boxShadow: "var(--tm-shadow)" }}>
                    <h4 style={{ margin: "0 0 16px 0", fontSize: "13px", fontWeight: "900", color: "#ef4444", borderBottom: "2px solid #fee2e2", paddingBottom: "8px", textTransform: "uppercase" }}>🔥 Trận đấu Live</h4>
                    {filteredLiveList.length === 0 ? (
                      <p style={{ fontSize: "12px", color: "var(--tm-muted)", textAlign: "center", padding: "20px 0" }}>Không có trận đấu nào đang thi đấu hoặc khớp bộ lọc.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {filteredLiveList.map(m => renderMatchCard(m))}
                      </div>
                    )}
                  </div>
                  <div style={{ background: "#ffffff", border: "1px solid var(--tm-border)", borderRadius: "16px", padding: "20px", boxShadow: "var(--tm-shadow)" }}>
                    <h4 style={{ margin: "0 0 16px 0", fontSize: "13px", fontWeight: "900", color: "#2563eb", borderBottom: "2px solid #dbeafe", paddingBottom: "8px", textTransform: "uppercase" }}>📅 Lịch thi đấu sắp diễn ra</h4>
                    {filteredUpcomingList.length === 0 ? (
                      <p style={{ fontSize: "12px", color: "var(--tm-muted)", textAlign: "center", padding: "20px 0" }}>Không có trận đấu sắp diễn ra hoặc khớp bộ lọc.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {filteredUpcomingList.map(m => renderMatchCard(m))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          };

          const renderKnockoutTree = () => {
            const targetMatches = knockoutMatches.length > 0 ? knockoutMatches : matches;
            
            if (targetMatches.length === 0) {
              const mockRounds: any[] = [];
              const groupCount = groupNames.length || 4;
              
              if (groupCount >= 4) {
                mockRounds.push({ name: "Tứ kết", matches: Array.from({ length: 4 }, (_, idx) => ({ MatchID: -(idx + 1), RoundNo: 1, MatchNo: idx + 1, KnockoutRound: "Tứ kết", MatchStatus: "Scheduled", NextMatchID: -(Math.floor(idx / 2) + 5) })), info: "4 trận" });
                mockRounds.push({ name: "Bán kết", matches: Array.from({ length: 2 }, (_, idx) => ({ MatchID: -(idx + 5), RoundNo: 2, MatchNo: idx + 1, KnockoutRound: "Bán kết", MatchStatus: "Scheduled", NextMatchID: -7 })), info: "2 trận" });
                mockRounds.push({ name: "Chung kết", matches: [{ MatchID: -7, RoundNo: 3, MatchNo: 1, KnockoutRound: "Chung kết", MatchStatus: "Scheduled" }], info: "1 trận" });
              } else {
                mockRounds.push({ name: "Bán kết", matches: Array.from({ length: 2 }, (_, idx) => ({ MatchID: -(idx + 1), RoundNo: 1, MatchNo: idx + 1, KnockoutRound: "Bán kết", MatchStatus: "Scheduled", NextMatchID: -3 })), info: "2 trận" });
                mockRounds.push({ name: "Chung kết", matches: [{ MatchID: -3, RoundNo: 2, MatchNo: 1, KnockoutRound: "Chung kết", MatchStatus: "Scheduled" }], info: "1 trận" });
              }

              return (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ background: "#fff7ed", border: "1px solid #ffedd5", color: "#c2410c", padding: "12px 16px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", marginBottom: "20px" }}>
                    ⚠️ Vòng bảng chưa kết thúc. Dưới đây là sơ đồ nhánh đấu dự kiến của vòng loại trực tiếp.
                  </div>
                  
                  <div style={{ position: "relative" }}>


                    <div id="bracket-tree-viewport" style={{ overflowX: "auto", overflowY: "visible", width: "100%", scrollBehavior: "smooth" }}>
                      <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, display: "inline-block", position: "relative" }}>
                        
                        <div className="bracket-tree-container" style={{ minHeight: "auto", height: `${mockRounds[0].matches.length * 150}px`, position: "relative" }}>
                          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
                            {connections.map(c => (
                              <path key={c.id} d={c.path} fill="none" stroke={c.isHighlighted ? "#B91C1C" : (c.isWinnerKnown ? "#EF4444" : "#FCA5A5")} strokeWidth={c.isHighlighted ? 3 : 1.5} style={{ transition: "stroke 0.2s, stroke-width 0.2s" }} />
                            ))}
                          </svg>

                          {mockRounds.map((round, rIdx) => (
                            <div key={rIdx} className="bracket-round-column">
                              <div className="bracket-column-header-container">
                                <span className="bracket-column-header-title">{round.name}</span>
                                <span className="bracket-column-header-info">{round.info}</span>
                              </div>
                              {round.matches.map((m: any) => renderMatchCard(m, true))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const matchesByRound: Record<string, any[]> = {};
            targetMatches.forEach(m => {
              const rName = m.KnockoutRound || `Vòng ${m.RoundNo}`;
              if (!matchesByRound[rName]) matchesByRound[rName] = [];
              matchesByRound[rName].push(m);
            });

            const sortedRounds = Object.keys(matchesByRound).sort((a, b) => {
              const rA = matchesByRound[a][0]?.RoundNo || 0;
              const rB = matchesByRound[b][0]?.RoundNo || 0;
              return rA - rB;
            });

            const maxMatches = Math.max(...sortedRounds.map(r => matchesByRound[r].length));
            const baseHeight = maxMatches * 260;

            return (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {trackedTeamId && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "8px 16px", borderRadius: "10px", marginBottom: "16px", fontSize: "12px", fontWeight: "700", color: "#1d4ed8" }}>
                    <span>🔍 Đang hiển thị lộ trình đi tiếp của đội đã chọn</span>
                    <button 
                      onClick={() => setTrackedTeamId(null)}
                      style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", textDecoration: "underline", fontWeight: "800", padding: 0 }}
                    >
                      Bỏ theo dõi
                    </button>
                  </div>
                )}

                {sortedRounds.length > 0 && (
                  <div className="bracket-mobile-round-nav">
                    <button 
                      type="button"
                      onClick={() => {
                        const nextIdx = Math.max(activeMobileRoundIdx - 1, 0);
                        setActiveMobileRoundIdx(nextIdx);
                        const col = document.getElementById(`round-col-${sortedRounds[nextIdx]}`);
                        col?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                      }}
                      disabled={activeMobileRoundIdx === 0}
                      className="mobile-nav-btn"
                    >
                      ◀ Trước
                    </button>
                    
                    <div className="mobile-round-indicator">
                      <span className="mobile-round-name">{sortedRounds[activeMobileRoundIdx]}</span>
                      <span className="mobile-round-progress">Vòng {activeMobileRoundIdx + 1} / {sortedRounds.length}</span>
                    </div>

                    <button 
                      type="button"
                      onClick={() => {
                        const nextIdx = Math.min(activeMobileRoundIdx + 1, sortedRounds.length - 1);
                        setActiveMobileRoundIdx(nextIdx);
                        const col = document.getElementById(`round-col-${sortedRounds[nextIdx]}`);
                        col?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                      }}
                      disabled={activeMobileRoundIdx === sortedRounds.length - 1}
                      className="mobile-nav-btn"
                    >
                      Sau ▶
                    </button>
                  </div>
                )}

                <div style={{ position: "relative" }}>


                  <div id="bracket-tree-viewport" onScroll={handleScroll} style={{ overflowX: "auto", overflowY: "visible", width: "100%", scrollBehavior: "smooth" }}>
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, display: "inline-block", position: "relative" }}>
                      
                      <div className="bracket-tree-container" style={{ minHeight: "auto", height: `${baseHeight}px`, position: "relative" }}>
                        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
                          {connections.map(c => (
                            <path key={c.id} d={c.path} fill="none" stroke={c.isHighlighted ? "#B91C1C" : (c.isWinnerKnown ? "#EF4444" : "#FCA5A5")} strokeWidth={c.isHighlighted ? 3 : 1.5} style={{ transition: "stroke 0.2s, stroke-width 0.2s" }} />
                          ))}
                        </svg>

                        {sortedRounds.map((roundName, rIdx) => {
                          const rMatches = [...matchesByRound[roundName]].sort((a,b) => a.MatchNo - b.MatchNo);
                          const total = rMatches.length;
                          const done = rMatches.filter(m => m.MatchStatus === "Completed" || m.MatchStatus === "ByeCompleted").length;
                          const rPct = total > 0 ? Math.round((done / total) * 100) : 0;

                          return (
                            <div key={roundName} id={`round-col-${roundName}`} className="bracket-round-column">
                              <div className="bracket-column-header-container">
                                <span className="bracket-column-header-title">{roundName}</span>
                                <span className="bracket-column-header-info">{done}/{total} Đã xong ({rPct}%)</span>
                              </div>
                              {rMatches.map(m => renderMatchCard(m))}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>
                </div>

              </div>
            );
          };

          const handleScroll = (e: any) => {
            const container = e.currentTarget;
            const scrollLeft = container.scrollLeft;
            const colWidth = container.clientWidth;
            const activeIdx = Math.round(scrollLeft / colWidth);

            const targetMatches = knockoutMatches.length > 0 ? knockoutMatches : matches;
            const matchesByRound: Record<string, any[]> = {};
            targetMatches.forEach(m => {
              const rName = m.KnockoutRound || `Vòng ${m.RoundNo}`;
              if (!matchesByRound[rName]) matchesByRound[rName] = [];
              matchesByRound[rName].push(m);
            });
            const sRounds = Object.keys(matchesByRound).sort((a, b) => {
              const rA = matchesByRound[a][0]?.RoundNo || 0;
              const rB = matchesByRound[b][0]?.RoundNo || 0;
              return rA - rB;
            });

            if (activeIdx >= 0 && activeIdx < sRounds.length) {
              setActiveMobileRoundIdx(activeIdx);
            }
          };

          return (
            <div>
              <div className="bracket-compact-toolbar">
                <div className="toolbar-section">
                  <span className="toolbar-label">Nội dung:</span>
                  <select 
                    value={selectedDivisionId || ""} 
                    onChange={(e) => setSelectedDivisionId(Number(e.target.value))}
                    className="toolbar-select"
                  >
                    {divisions.map(div => (
                      <option key={div.DivisionID} value={div.DivisionID}>{div.DivisionName}</option>
                    ))}
                  </select>
                </div>

                {subTabs.length > 1 && (
                  <div className="toolbar-section tabs-group">
                    {subTabs.map(tab => (
                      <button
                        key={tab}
                        onClick={() => setBracketActiveSubTab(tab)}
                        className={`toolbar-tab-btn ${activeSubTab === tab ? "active" : ""}`}
                      >
                        {tab === "Overview" ? "Tổng quan" : (tab === "Knockout" ? "Vòng Knockout" : tab)}
                      </button>
                    ))}
                  </div>
                )}

                <div className="toolbar-section">
                  <input 
                    type="text" 
                    placeholder="Tìm VĐV..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="toolbar-search-input"
                    style={{ marginRight: "6px" }}
                  />
                  <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="toolbar-select"
                    style={{ marginRight: "12px" }}
                  >
                    <option value="All">Tất cả trận</option>
                    <option value="Live">Đang đấu (Live)</option>
                    <option value="Upcoming">Sắp đấu (Upcoming)</option>
                    <option value="Completed">Đã xong (Completed)</option>
                  </select>

                  {/* Zoom Controls inside Toolbar */}
                  <div className="zoom-group">
                    <span className="toolbar-label">Thu phóng:</span>
                    <div className="toolbar-btn-group">
                      <button type="button" onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))} className="toolbar-zoom-btn" title="Phóng to">➕</button>
                      <button type="button" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="toolbar-zoom-btn" title="Thu nhỏ">➖</button>
                      <button type="button" onClick={() => setZoom(1.0)} className="toolbar-zoom-btn">Reset</button>
                    </div>
                  </div>
                </div>
              </div>

              {matches.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", border: "1px solid var(--tm-border)", borderRadius: "16px", background: "#fff" }}>
                  <p className="text-slate-400">Sơ đồ nhánh đấu và lịch thi đấu chưa được ban tổ chức tạo.</p>
                </div>
              ) : (
                <div>
                  {activeSubTab === "Overview" && renderOverviewTab()}

                  {activeSubTab === "Knockout" && renderKnockoutTree()}

                  {activeSubTab === "Bảng thi đấu" && (() => {
                    const filteredRRMatches = matches.filter(matchesSearch).filter(matchesStatus);
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
                        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
                          <div style={{ flex: "1 1 320px" }}>
                            <h4 style={{ fontSize: "14px", fontWeight: "900", color: "#073b2b", marginBottom: "12px", textTransform: "uppercase" }}>Bảng xếp hạng</h4>
                            <div className="tm-table-wrapper">
                              <table className="tm-table">
                                <thead>
                                  <tr>
                                    <th>Hạng</th>
                                    <th>Đội</th>
                                    <th style={{ textAlign: "center" }}>Trận</th>
                                    <th style={{ textAlign: "center" }}>Thắng</th>
                                    <th style={{ textAlign: "center" }}>PD</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {standings.map((s, idx) => (
                                    <tr key={s.StandingID}>
                                      <td style={{ fontWeight: "bold" }}>#{s.RankNo || idx + 1}</td>
                                      <td style={{ fontWeight: "700", color: "#0f172a" }}>
                                        {s.TeamName}
                                        {s.TeamID && (
                                          <span 
                                            onClick={() => handleShowPlayerProfile(s.TeamID, s.TeamName)}
                                            style={{
                                              cursor: "pointer",
                                              marginLeft: "8px",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "3px",
                                              fontSize: "9px",
                                              fontWeight: "800",
                                              color: "#2563eb",
                                              background: "#eff6ff",
                                              border: "1px solid #dbeafe",
                                              padding: "2px 6px",
                                              borderRadius: "9999px",
                                              textTransform: "uppercase",
                                              letterSpacing: "0.5px",
                                              transition: "all 0.2s"
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = "#2563eb";
                                              e.currentTarget.style.color = "#ffffff";
                                              e.currentTarget.style.borderColor = "#2563eb";
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = "#eff6ff";
                                              e.currentTarget.style.color = "#2563eb";
                                              e.currentTarget.style.borderColor = "#dbeafe";
                                            }}
                                            title="Xem hồ sơ đối thủ"
                                          >
                                            <LuEye size={10} />
                                            <span>View</span>
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ textAlign: "center" }}>{s.Played}</td>
                                      <td style={{ textAlign: "center", color: "#10b981", fontWeight: "700" }}>{s.Won}</td>
                                      <td style={{ textAlign: "center" }}>{s.PointDifference}</td>
                                    </tr>
                                  ))}
                                  {standings.length === 0 && (
                                    <tr>
                                      <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8" }}>Chưa có dữ liệu bảng xếp hạng</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div style={{ flex: "1.8 1 450px" }}>
                            <h4 style={{ fontSize: "14px", fontWeight: "900", color: "#073b2b", marginBottom: "12px", textTransform: "uppercase" }}>Danh sách trận đấu ({filteredRRMatches.length})</h4>
                            {filteredRRMatches.length === 0 ? (
                              <p style={{ fontSize: "12px", color: "var(--tm-muted)", padding: "16px 0" }}>Không tìm thấy trận đấu nào khớp bộ lọc.</p>
                            ) : (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                                {filteredRRMatches.map(m => renderMatchCard(m))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {groupNames.includes(activeSubTab) && (() => {
                    const groupMatches = groupStageMatches.filter(m => m.GroupName === activeSubTab).filter(matchesSearch).filter(matchesStatus);
                    const groupStandings = standings.filter(s => s.GroupName === activeSubTab).sort((a,b) => a.RankNo - b.RankNo);
                    
                    return (
                      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 300px" }}>
                          <h4 style={{ fontSize: "13px", fontWeight: "900", color: "#073b2b", marginBottom: "12px", textTransform: "uppercase" }}>Bảng xếp hạng {activeSubTab}</h4>
                          <div className="tm-table-wrapper">
                            <table className="tm-table" style={{ fontSize: "12.5px" }}>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Đội</th>
                                  <th style={{ textAlign: "center" }}>P</th>
                                  <th style={{ textAlign: "center" }}>W</th>
                                  <th style={{ textAlign: "center" }}>PD</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupStandings.map((s, idx) => (
                                  <tr key={s.StandingID}>
                                    <td style={{ fontWeight: "bold" }}>#{s.RankNo || idx + 1}</td>
                                    <td style={{ fontWeight: "700", color: "#0f172a" }}>{s.TeamName}</td>
                                    <td style={{ textAlign: "center" }}>{s.Played}</td>
                                    <td style={{ textAlign: "center", color: "#10b981", fontWeight: "700" }}>{s.Won}</td>
                                    <td style={{ textAlign: "center" }}>{s.PointDifference}</td>
                                  </tr>
                                ))}
                                {groupStandings.length === 0 && (
                                  <tr>
                                    <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8" }}>Chưa có dữ liệu bảng xếp hạng</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div style={{ flex: "1.8 1 420px" }}>
                          <h4 style={{ fontSize: "13px", fontWeight: "900", color: "#073b2b", marginBottom: "12px", textTransform: "uppercase" }}>Trận đấu {activeSubTab} ({groupMatches.length})</h4>
                          {groupMatches.length === 0 ? (
                            <p style={{ fontSize: "12px", color: "var(--tm-muted)", padding: "16px 0" }}>Không tìm thấy trận đấu nào khớp bộ lọc.</p>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                              {groupMatches.map(m => renderMatchCard(m))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === "standings" && (
          <div>
            {/* Division Selector */}
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "24px" }}>
              {divisions.map((div) => (
                <button
                  key={div.DivisionID}
                  onClick={() => setSelectedDivisionId(div.DivisionID)}
                  className={`tm-btn ${selectedDivisionId === div.DivisionID ? "tm-btn-primary" : "tm-btn-secondary"}`}
                  style={{ padding: "6px 16px", fontSize: "0.75rem" }}
                >
                  {div.DivisionName}
                </button>
              ))}
            </div>

            {(() => {
              const selectedDiv = divisions.find(d => d.DivisionID === selectedDivisionId);
              if (selectedDiv?.Status !== "Completed") return null;

              const finalMatch = matches.find(m => m.KnockoutRound === "Chung kết");
              const thirdMatch = matches.find(m => m.KnockoutRound === "Tranh hạng 3");
              
              let champName = "";
              let runnerUpName = "";
              let thirdName = "";

              if (selectedDiv.BracketType === "RoundRobin") {
                const sortedStandings = [...standings].sort((a,b) => (a.RankNo || 99) - (b.RankNo || 99));
                champName = sortedStandings[0]?.TeamName || "Chưa xác định";
                runnerUpName = sortedStandings[1]?.TeamName || "Chưa xác định";
                thirdName = sortedStandings[2]?.TeamName || "Chưa xác định";
              } else {
                if (finalMatch && finalMatch.WinnerTeamID) {
                  champName = finalMatch.WinnerTeamID === finalMatch.TeamAID ? finalMatch.TeamAName : finalMatch.TeamBName;
                  runnerUpName = finalMatch.WinnerTeamID === finalMatch.TeamAID ? finalMatch.TeamBName : finalMatch.TeamAName;
                }
                if (thirdMatch && thirdMatch.WinnerTeamID) {
                  thirdName = thirdMatch.WinnerTeamID === thirdMatch.TeamAID ? thirdMatch.TeamAName : thirdMatch.TeamBName;
                }
              }

              if (!champName && !runnerUpName) return null;

              const getTeamCodeByName = (teamName: string) => {
                if (!teamName) return "";
                const found = standings.find(s => s.TeamName === teamName);
                if (found?.TeamCode) return found.TeamCode;
                const matchFound = matches.find(m => m.TeamAName === teamName || m.TeamBName === teamName);
                if (matchFound) {
                  if (matchFound.TeamAName === teamName && matchFound.TeamACode) return matchFound.TeamACode;
                  if (matchFound.TeamBName === teamName && matchFound.TeamBCode) return matchFound.TeamBCode;
                }
                return "";
              };

              const getPrizeText = (place: number) => {
                if (!tournament || !tournament.PrizeInfo) {
                  if (place === 1) return "20.000.000 VNĐ";
                  if (place === 2) return "10.000.000 VNĐ";
                  return "5.000.000 VNĐ";
                }
                const info = tournament.PrizeInfo.toLowerCase();
                if (place === 1) {
                  const m = info.match(/(nhất|vô địch|champion|1st)[:\-\s]+([\d\.,\s]+(vnđ|vnd|đ|đồng|triệu)?)/i);
                  return m ? m[2].trim().toUpperCase() : "20.000.000 VNĐ";
                } else if (place === 2) {
                  const m = info.match(/(nhì|á quân|runner|2nd)[:\-\s]+([\d\.,\s]+(vnđ|vnd|đ|đồng|triệu)?)/i);
                  return m ? m[2].trim().toUpperCase() : "10.000.000 VNĐ";
                } else {
                  const m = info.match(/(ba|hạng ba|third|3rd)[:\-\s]+([\d\.,\s]+(vnđ|vnd|đ|đồng|triệu)?)/i);
                  return m ? m[2].trim().toUpperCase() : "5.000.000 VNĐ";
                }
              };

              return (
                <div style={{ 
                  position: "relative",
                  overflow: "hidden",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "24px",
                  padding: "40px 24px 28px 24px",
                  textAlign: "center",
                  marginBottom: "32px",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.03)"
                }}>
                  {/* Floating Gold Confetti / Sparkles */}
                  <div style={{ position: "absolute", top: "10%", left: "12%", width: "8px", height: "8px", background: "#fef08a", transform: "rotate(45deg)", opacity: 0.6 }} />
                  <div style={{ position: "absolute", top: "25%", right: "10%", width: "6px", height: "12px", background: "#fde047", transform: "rotate(15deg)", opacity: 0.5 }} />
                  <div style={{ position: "absolute", bottom: "35%", left: "6%", width: "10px", height: "5px", background: "#ca8a04", transform: "rotate(-30deg)", opacity: 0.4 }} />
                  <div style={{ position: "absolute", bottom: "20%", right: "18%", width: "8px", height: "8px", background: "#fef08a", transform: "rotate(20deg)", opacity: 0.6 }} />
                  <div style={{ position: "absolute", top: "15%", right: "25%", width: "10px", height: "10px", background: "#fde047", transform: "rotate(10deg)", opacity: 0.4 }} />
                  <div style={{ position: "absolute", top: "35%", left: "25%", width: "6px", height: "6px", background: "#eab308", transform: "rotate(45deg)", opacity: 0.5 }} />

                  {/* Header Title */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ marginBottom: "8px" }}>
                      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" />
                        <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                        <path d="M12 2a5 5 0 0 0-5 5v5h10V7a5 5 0 0 0-5-5z" />
                      </svg>
                    </div>
                    <h4 style={{ margin: "0", fontSize: "1.65rem", fontWeight: "900", color: "#0f172a", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                      KẾT QUẢ CHUNG CUỘC
                    </h4>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginTop: "6px", marginBottom: "36px" }}>
                      <div style={{ height: "1px", width: "80px", background: "linear-gradient(to right, transparent, #eab308)" }} />
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#b45309", letterSpacing: "2.5px", textTransform: "uppercase" }}>Vinh danh chiến thắng</span>
                      <div style={{ height: "1px", width: "80px", background: "linear-gradient(to left, transparent, #eab308)" }} />
                    </div>
                  </div>

                  {/* 3-Column Podium Flexbox */}
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: "28px", flexWrap: "wrap", padding: "10px 0" }}>
                    
                    {/* 2nd Place (Left) */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "200px" }}>
                      {/* Card */}
                      <div style={{ 
                        position: "relative",
                        background: "#ffffff",
                        border: "2px solid #cbd5e1",
                        borderRadius: "16px",
                        padding: "28px 12px 14px 12px",
                        width: "100%",
                        boxShadow: "0 10px 25px rgba(148,163,184,0.1)",
                        zIndex: 3,
                        marginBottom: "-4px"
                      }}>
                        {/* Medal */}
                        <div style={{ position: "absolute", top: "-28px", left: "50%", transform: "translateX(-50%)" }}>
                          <svg width="56" height="56" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                            <path d="M 30,75 C 15,60 15,40 30,25 C 32,23 35,26 33,28 C 20,41 20,59 33,72 C 35,74 32,77 30,75 Z" fill="#94a3b8" />
                            <path d="M 70,75 C 85,60 85,40 70,25 C 68,23 65,26 67,28 C 80,41 80,59 67,72 C 65,74 68,77 70,75 Z" fill="#94a3b8" />
                            <circle cx="50" cy="50" r="32" fill="url(#silver-grad)" stroke="#94a3b8" strokeWidth="2" />
                            <circle cx="50" cy="50" r="26" fill="none" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 2" />
                            <text x="50" y="58" fontFamily="'Inter', sans-serif" fontWeight="900" fontSize="28" fill="#475569" textAnchor="middle">2</text>
                            <defs>
                              <linearGradient id="silver-grad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#f8fafc" />
                                <stop offset="50%" stopColor="#cbd5e1" />
                                <stop offset="100%" stopColor="#94a3b8" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>

                        {/* Team Logo */}
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: "6px" }}>
                            <path d="M 20,10 L 80,10 C 80,10 85,50 50,90 C 15,50 20,10 20,10 Z" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
                            <text x="50" y="28" fontFamily="'Inter', sans-serif" fontWeight="900" fontSize="8" fill="#ffffff" textAnchor="middle" letterSpacing="1">FPT YOUTH</text>
                            <g stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round">
                              <line x1="35" y1="65" x2="55" y2="45" />
                              <path d="M 50,40 C 45,35 55,25 60,30 C 65,35 55,45 50,40 Z" fill="#cbd5e1" />
                              <line x1="65" y1="65" x2="45" y2="45" />
                              <path d="M 50,40 C 55,35 45,25 40,30 C 35,35 45,45 50,40 Z" fill="#cbd5e1" />
                            </g>
                            <circle cx="50" cy="50" r="10" fill="#cbd5e1" />
                            <circle cx="50" cy="50" r="8" fill="none" stroke="#0f172a" strokeWidth="1.5" strokeDasharray="2 2" />
                            <text x="50" y="78" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="7" fill="#cbd5e1" textAnchor="middle">PICKLEBALL</text>
                          </svg>
                        </div>

                        {/* Team Name */}
                        <div style={{ fontWeight: "800", fontSize: "13.5px", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "2px" }} title={runnerUpName}>
                          {runnerUpName}
                        </div>

                        {/* Team Code */}
                        <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "600", marginBottom: "10px", textTransform: "uppercase" }}>
                          {getTeamCodeByName(runnerUpName) || "FPT YOUTH STAR 03"}
                        </div>

                        {/* Medal Badge Pill */}
                        <div style={{ 
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)",
                          color: "#ffffff",
                          padding: "4px 14px",
                          borderRadius: "9999px",
                          fontSize: "10px",
                          fontWeight: "800",
                          boxShadow: "0 3px 8px rgba(148,163,184,0.2)"
                        }}>
                          ⭐ HẠNG NHÌ
                        </div>

                        {/* Divider */}
                        <div style={{ height: "1px", background: "#f1f5f9", margin: "12px 0 10px 0" }} />

                        {/* Prize */}
                        <div style={{ fontSize: "9px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Giải thưởng</div>
                        <div style={{ fontSize: "13px", color: "#475569", fontWeight: "800", marginTop: "2px" }}>
                          {getPrizeText(2)}
                        </div>
                      </div>

                      {/* Pedestal */}
                      <div style={{ position: "relative", width: "100%", height: "45px", zIndex: 1 }}>
                        <div style={{ height: "12px", borderRadius: "50%", background: "linear-gradient(90deg, #f1f5f9, #cbd5e1, #f1f5f9)", border: "1px solid #94a3b8", position: "absolute", top: "-6px", left: 0, right: 0, zIndex: 2 }} />
                        <div style={{ 
                          height: "38px", 
                          background: "linear-gradient(90deg, #475569, #94a3b8, #475569)", 
                          borderRadius: "0 0 50% 50% / 0 0 6px 6px", 
                          border: "1px solid #475569", 
                          borderTop: "none", 
                          boxShadow: "0 8px 16px rgba(148,163,184,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          zIndex: 1
                        }}>
                          {/* Wreath ornament */}
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f1f5f9" strokeWidth="1.5">
                            <path d="M 6,18 C 3,14 3,10 6,6" />
                            <path d="M 18,18 C 21,14 21,10 18,6" />
                            <text x="12" y="16" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#f1f5f9" textAnchor="middle">2</text>
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* 1st Place (Center - Champion) */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "230px" }}>
                      {/* Card */}
                      <div style={{ 
                        position: "relative",
                        background: "#ffffff",
                        border: "2px solid #fbbf24",
                        borderRadius: "20px",
                        padding: "32px 14px 16px 14px",
                        width: "100%",
                        boxShadow: "0 15px 35px rgba(245,158,11,0.15)",
                        zIndex: 4,
                        marginBottom: "-4px"
                      }}>
                        {/* Medal */}
                        <div style={{ position: "absolute", top: "-32px", left: "50%", transform: "translateX(-50%)" }}>
                          <svg width="64" height="64" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                            <path d="M 30,75 C 15,60 15,40 30,25 C 32,23 35,26 33,28 C 20,41 20,59 33,72 C 35,74 32,77 30,75 Z" fill="#eab308" />
                            <path d="M 70,75 C 85,60 85,40 70,25 C 68,23 65,26 67,28 C 80,41 80,59 67,72 C 65,74 68,77 70,75 Z" fill="#eab308" />
                            <circle cx="50" cy="50" r="32" fill="url(#gold-grad)" stroke="#ca8a04" strokeWidth="2" />
                            <circle cx="50" cy="50" r="26" fill="none" stroke="#fef08a" strokeWidth="1" strokeDasharray="3 2" />
                            <text x="50" y="58" fontFamily="'Inter', sans-serif" fontWeight="900" fontSize="28" fill="#78350f" textAnchor="middle">1</text>
                            <defs>
                              <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#fef08a" />
                                <stop offset="50%" stopColor="#eab308" />
                                <stop offset="100%" stopColor="#ca8a04" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>

                        {/* Team Logo */}
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <svg width="46" height="46" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: "8px" }}>
                            <path d="M 20,10 L 80,10 C 80,10 85,50 50,90 C 15,50 20,10 20,10 Z" fill="#0f172a" stroke="#f59e0b" strokeWidth="2.5" />
                            <text x="50" y="28" fontFamily="'Inter', sans-serif" fontWeight="900" fontSize="8" fill="#ffffff" textAnchor="middle" letterSpacing="1">FPT YOUTH</text>
                            <g stroke="#f59e0b" strokeWidth="3" strokeLinecap="round">
                              <line x1="35" y1="65" x2="55" y2="45" />
                              <path d="M 50,40 C 45,35 55,25 60,30 C 65,35 55,45 50,40 Z" fill="#f59e0b" />
                              <line x1="65" y1="65" x2="45" y2="45" />
                              <path d="M 50,40 C 55,35 45,25 40,30 C 35,35 45,45 50,40 Z" fill="#f59e0b" />
                            </g>
                            <circle cx="50" cy="50" r="10" fill="#f59e0b" />
                            <circle cx="50" cy="50" r="8" fill="none" stroke="#0f172a" strokeWidth="1.5" strokeDasharray="2 2" />
                            <text x="50" y="78" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="7" fill="#f59e0b" textAnchor="middle">PICKLEBALL</text>
                          </svg>
                        </div>

                        {/* Team Name */}
                        <div style={{ fontWeight: "900", fontSize: "15.5px", color: "#1e3a8a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "2px" }} title={champName}>
                          {champName}
                        </div>

                        {/* Team Code */}
                        <div style={{ fontSize: "11px", color: "#475569", fontWeight: "700", marginBottom: "12px", textTransform: "uppercase" }}>
                          {getTeamCodeByName(champName) || "FPT YOUTH STAR 08"}
                        </div>

                        {/* Medal Badge Pill */}
                        <div style={{ 
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          color: "#ffffff",
                          padding: "5px 18px",
                          borderRadius: "9999px",
                          fontSize: "11px",
                          fontWeight: "900",
                          boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
                          letterSpacing: "0.5px"
                        }}>
                          🏆 VÔ ĐỊCH
                        </div>

                        {/* Divider */}
                        <div style={{ height: "1px", background: "#fef3c7", margin: "14px 0 12px 0" }} />

                        {/* Prize */}
                        <div style={{ fontSize: "9px", color: "#d97706", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Giải thưởng</div>
                        <div style={{ fontSize: "15px", color: "#b45309", fontWeight: "900", marginTop: "2px" }}>
                          {getPrizeText(1)}
                        </div>
                      </div>

                      {/* Pedestal */}
                      <div style={{ position: "relative", width: "100%", height: "55px", zIndex: 2 }}>
                        <div style={{ height: "16px", borderRadius: "50%", background: "linear-gradient(90deg, #fef3c7, #fde047, #fef3c7)", border: "1px solid #f59e0b", position: "absolute", top: "-8px", left: 0, right: 0, zIndex: 2 }} />
                        <div style={{ 
                          height: "47px", 
                          background: "linear-gradient(90deg, #b45309, #d97706, #b45309)", 
                          borderRadius: "0 0 50% 50% / 0 0 8px 8px", 
                          border: "1px solid #b45309", 
                          borderTop: "none", 
                          boxShadow: "0 10px 25px rgba(217,119,6,0.35)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          zIndex: 1
                        }}>
                          {/* Wreath ornament */}
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fef3c7" strokeWidth="1.5" style={{ marginBottom: "-2px" }}>
                            <path d="M 6,18 C 3,14 3,10 6,6" />
                            <path d="M 18,18 C 21,14 21,10 18,6" />
                          </svg>
                          <span style={{ fontSize: "8px", fontWeight: "900", color: "#fef3c7", letterSpacing: "1px", textTransform: "uppercase" }}>CHAMPION</span>
                        </div>
                      </div>
                    </div>

                    {/* 3rd Place (Right) */}
                    {thirdName && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "200px" }}>
                        {/* Card */}
                        <div style={{ 
                          position: "relative",
                          background: "#ffffff",
                          border: "2px solid #ca8a04",
                          borderRadius: "16px",
                          padding: "28px 12px 14px 12px",
                          width: "100%",
                          boxShadow: "0 10px 25px rgba(217,119,6,0.08)",
                          zIndex: 3,
                          marginBottom: "-4px"
                        }}>
                          {/* Medal */}
                          <div style={{ position: "absolute", top: "-28px", left: "50%", transform: "translateX(-50%)" }}>
                            <svg width="56" height="56" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                              <path d="M 30,75 C 15,60 15,40 30,25 C 32,23 35,26 33,28 C 20,41 20,59 33,72 C 35,74 32,77 30,75 Z" fill="#d97706" />
                              <path d="M 70,75 C 85,60 85,40 70,25 C 68,23 65,26 67,28 C 80,41 80,59 67,72 C 65,74 68,77 70,75 Z" fill="#d97706" />
                              <circle cx="50" cy="50" r="32" fill="url(#bronze-grad)" stroke="#ca8a04" strokeWidth="2" />
                              <circle cx="50" cy="50" r="26" fill="none" stroke="#ffedd5" strokeWidth="1" strokeDasharray="3 2" />
                              <text x="50" y="58" fontFamily="'Inter', sans-serif" fontWeight="900" fontSize="28" fill="#7c2d12" textAnchor="middle">3</text>
                              <defs>
                                <linearGradient id="bronze-grad" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#ffedd5" />
                                  <stop offset="50%" stopColor="#fed7aa" />
                                  <stop offset="100%" stopColor="#d97706" />
                                </linearGradient>
                              </defs>
                            </svg>
                          </div>

                          {/* Team Logo */}
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: "6px" }}>
                              <path d="M 20,10 L 80,10 C 80,10 85,50 50,90 C 15,50 20,10 20,10 Z" fill="#0f172a" stroke="#d97706" strokeWidth="2" />
                              <text x="50" y="28" fontFamily="'Inter', sans-serif" fontWeight="900" fontSize="8" fill="#ffffff" textAnchor="middle" letterSpacing="1">FPT YOUTH</text>
                              <g stroke="#d97706" strokeWidth="3" strokeLinecap="round">
                                <line x1="35" y1="65" x2="55" y2="45" />
                                <path d="M 50,40 C 45,35 55,25 60,30 C 65,35 55,45 50,40 Z" fill="#d97706" />
                                <line x1="65" y1="65" x2="45" y2="45" />
                                <path d="M 50,40 C 55,35 45,25 40,30 C 35,35 45,45 50,40 Z" fill="#d97706" />
                              </g>
                              <circle cx="50" cy="50" r="10" fill="#d97706" />
                              <circle cx="50" cy="50" r="8" fill="none" stroke="#0f172a" strokeWidth="1.5" strokeDasharray="2 2" />
                              <text x="50" y="78" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="7" fill="#d97706" textAnchor="middle">PICKLEBALL</text>
                            </svg>
                          </div>

                          {/* Team Name */}
                          <div style={{ fontWeight: "800", fontSize: "13.5px", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "2px" }} title={thirdName}>
                            {thirdName}
                          </div>

                          {/* Team Code */}
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "600", marginBottom: "10px", textTransform: "uppercase" }}>
                            {getTeamCodeByName(thirdName) || "FPT YOUTH STAR 17"}
                          </div>

                          {/* Medal Badge Pill */}
                          <div style={{ 
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "linear-gradient(135deg, #fed7aa 0%, #d97706 100%)",
                            color: "#ffffff",
                            padding: "4px 14px",
                            borderRadius: "9999px",
                            fontSize: "10px",
                            fontWeight: "800",
                            boxShadow: "0 3px 8px rgba(217,119,6,0.2)"
                          }}>
                            ⭐ HẠNG BA
                          </div>

                          {/* Divider */}
                          <div style={{ height: "1px", background: "#f1f5f9", margin: "12px 0 10px 0" }} />

                          {/* Prize */}
                          <div style={{ fontSize: "9px", color: "#d97706", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Giải thưởng</div>
                          <div style={{ fontSize: "13px", color: "#9a3412", fontWeight: "800", marginTop: "2px" }}>
                            {getPrizeText(3)}
                          </div>
                        </div>

                        {/* Pedestal */}
                        <div style={{ position: "relative", width: "100%", height: "35px", zIndex: 1 }}>
                          <div style={{ height: "12px", borderRadius: "50%", background: "linear-gradient(90deg, #ffedd5, #fed7aa, #ffedd5)", border: "1px solid #d97706", position: "absolute", top: "-6px", left: 0, right: 0, zIndex: 2 }} />
                          <div style={{ 
                            height: "30px", 
                            background: "linear-gradient(90deg, #9a3412, #d97706, #9a3412)", 
                            borderRadius: "0 0 50% 50% / 0 0 6px 6px", 
                            border: "1px solid #9a3412", 
                            borderTop: "none", 
                            boxShadow: "0 6px 12px rgba(217,119,6,0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                            zIndex: 1
                          }}>
                            {/* Wreath ornament */}
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffedd5" strokeWidth="1.5">
                              <path d="M 6,18 C 3,14 3,10 6,6" />
                              <path d="M 18,18 C 21,14 21,10 18,6" />
                              <text x="12" y="16" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#ffedd5" textAnchor="middle">3</text>
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Footer Brand Logo Line */}
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    gap: "8px", 
                    marginTop: "36px", 
                    paddingTop: "18px", 
                    borderTop: "1px solid #e2e8f0" 
                  }}>
                    <svg width="18" height="18" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <path d="M 20,10 L 80,10 C 80,10 85,50 50,90 C 15,50 20,10 20,10 Z" fill="#0f172a" stroke="#f97316" strokeWidth="2.5" />
                      <circle cx="50" cy="50" r="15" fill="#f97316" />
                    </svg>
                    <span style={{ 
                      fontSize: "11px", 
                      fontWeight: "900", 
                      color: "#94a3b8", 
                      letterSpacing: "1.5px", 
                      textTransform: "uppercase" 
                    }}>
                      {tournament ? tournament.TournamentName : "FPT YOUTH PICKLEBALL CHAMPIONSHIP"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {standings.length === 0 ? (() => {
              const selectedDiv = divisions.find(d => d.DivisionID === selectedDivisionId);
              if (selectedDiv?.Status === "Completed") return null;

              return (
                <div style={{ padding: "48px", textAlign: "center", border: "1px solid var(--tm-border)", borderRadius: "16px", background: "#fff" }}>
                  <p className="text-slate-400">
                    {selectedDiv?.BracketType === "SingleElimination" || selectedDiv?.BracketType === "GroupKnockout"
                      ? "Nội dung thi đấu loại trực tiếp đang diễn ra. Bạn có thể theo dõi sơ đồ và lịch thi đấu tại tab \"Nhánh đấu / Lịch đấu\" bên trên."
                      : "Bảng xếp hạng rỗng hoặc nội dung này chưa có kết quả."}
                  </p>
                </div>
              );
            })() : (() => {
              const hasGroups = standings.some(st => st.GroupName);
              if (hasGroups) {
                const grouped: Record<string, any[]> = {};
                standings.forEach(st => {
                  const g = st.GroupName || "Chưa phân bảng";
                  if (!grouped[g]) grouped[g] = [];
                  grouped[g].push(st);
                });
                const sortedGroups = Object.keys(grouped).sort();
                const getGroupColor = (name: string) => {
                  const hash = name.charCodeAt(name.length - 1) || 0;
                  const hue = (hash * 37) % 360;
                  return `hsl(${hue}, 85%, 45%)`;
                };

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "24px" }}>
                    {sortedGroups.map(g => (
                      <div key={g} style={{ border: "1px solid var(--tm-border)", borderRadius: "16px", padding: "20px", background: "#fff", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}>
                        <h4 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: "700", color: getGroupColor(g), borderBottom: `2px solid ${getGroupColor(g)}`, paddingBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>🏆 {g}</span>
                          <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", background: "#f1f5f9", borderRadius: "12px", color: "#64748b" }}>{grouped[g].length} Đội</span>
                        </h4>
                        <div className="tm-table-wrapper" style={{ boxShadow: "none", border: "none" }}>
                          <table className="tm-table">
                            <thead>
                              <tr>
                                <th>Hạng</th>
                                <th>Đội</th>
                                <th style={{ textAlign: "center" }}>Đã chơi</th>
                                <th style={{ textAlign: "center" }}>Thắng</th>
                                <th style={{ textAlign: "center" }}>Thua</th>
                                <th style={{ textAlign: "center" }}>Hiệu số</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grouped[g].map((st, idx) => (
                                <tr key={st.StandingID}>
                                  <td style={{ fontWeight: "bold", color: getGroupColor(g) }}>#{idx + 1}</td>
                                  <td style={{ fontWeight: "700", color: "#0f172a" }}>
                                    {st.TeamName}
                                    {st.TeamID && (
                                      <span 
                                        onClick={() => handleShowPlayerProfile(st.TeamID, st.TeamName)}
                                        style={{
                                          cursor: "pointer",
                                          marginLeft: "8px",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px",
                                          fontSize: "9px",
                                          fontWeight: "800",
                                          color: "#2563eb",
                                          background: "#eff6ff",
                                          border: "1px solid #dbeafe",
                                          padding: "2px 6px",
                                          borderRadius: "9999px",
                                          textTransform: "uppercase",
                                          letterSpacing: "0.5px",
                                          transition: "all 0.2s"
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = "#2563eb";
                                          e.currentTarget.style.color = "#ffffff";
                                          e.currentTarget.style.borderColor = "#2563eb";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = "#eff6ff";
                                          e.currentTarget.style.color = "#2563eb";
                                          e.currentTarget.style.borderColor = "#dbeafe";
                                        }}
                                        title="Xem hồ sơ đối thủ"
                                      >
                                        <LuEye size={10} />
                                        <span>View</span>
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: "center" }}>{st.Played}</td>
                                  <td style={{ textAlign: "center", color: "#16a34a", fontWeight: "600" }}>{st.Won}</td>
                                  <td style={{ textAlign: "center", color: "#ef4444" }}>{st.Lost}</td>
                                  <td style={{ textAlign: "center", fontFamily: "monospace" }}>{st.PointDifference}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              return (
                <div className="tm-table-wrapper">
                  <table className="tm-table">
                    <thead>
                      <tr>
                        <th>Hạng</th>
                        <th>Đội thi đấu</th>
                        <th style={{ textAlign: "center" }}>Đã chơi</th>
                        <th style={{ textAlign: "center" }}>Thắng</th>
                        <th style={{ textAlign: "center" }}>Thua</th>
                        <th style={{ textAlign: "center" }}>Hiệu số điểm (+/-)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((st) => (
                        <tr key={st.StandingID}>
                          <td style={{ fontWeight: "bold", color: "var(--tm-primary)" }}>#{st.RankNo}</td>
                          <td style={{ fontWeight: "700", color: "#0f172a" }}>
                            {st.TeamName}
                            {st.TeamID && (
                              <span 
                                onClick={() => handleShowPlayerProfile(st.TeamID, st.TeamName)}
                                style={{
                                  cursor: "pointer",
                                  marginLeft: "8px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  fontSize: "9px",
                                  fontWeight: "800",
                                  color: "#2563eb",
                                  background: "#eff6ff",
                                  border: "1px solid #dbeafe",
                                  padding: "2px 6px",
                                  borderRadius: "9999px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                  transition: "all 0.2s"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#2563eb";
                                  e.currentTarget.style.color = "#ffffff";
                                  e.currentTarget.style.borderColor = "#2563eb";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#eff6ff";
                                  e.currentTarget.style.color = "#2563eb";
                                  e.currentTarget.style.borderColor = "#dbeafe";
                                }}
                                title="Xem hồ sơ đối thủ"
                              >
                                <LuEye size={10} />
                                <span>View</span>
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>{st.Played}</td>
                          <td style={{ textAlign: "center", color: "#16a34a" }}>{st.Won}</td>
                          <td style={{ textAlign: "center", color: "#ef4444" }}>{st.Lost}</td>
                          <td style={{ textAlign: "center", fontFamily: "monospace" }}>{st.PointDifference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Register Modal */}
      {registerModalOpen && selectedDivision && (() => {
        const isSingles = selectedDivision.CompetitionFormat === "MenSingles" || 
                          selectedDivision.CompetitionFormat === "WomenSingles" || 
                          selectedDivision.CompetitionFormat === "Singles";
        const showAthlete2Form = !isSingles && partnerOption === "ManualForm";
        const maxTeams = selectedDivision.MaxTeams || 48;
        const registeredCount = (selectedDivision as any).RegisteredCount || 0;
        const paidCount = (selectedDivision as any).PaidCount || 0;
        
        // Progress circle calculation
        const fields1 = [
          athlete1.phoneNumber,
          athlete1.fullName,
          athlete1.rating,
          athlete1.province,
          athlete1.gender,
          athlete1.dateOfBirth,
          athlete1.photoUrl,
          athlete1.cccdUrl
        ];
        
        const fields2 = !isSingles && partnerOption === "ManualForm" ? [
          athlete2.phoneNumber,
          athlete2.fullName,
          athlete2.rating,
          athlete2.province,
          athlete2.gender,
          athlete2.dateOfBirth,
          athlete2.photoUrl,
          athlete2.cccdUrl
        ] : [];

        const allFields = [...fields1, ...fields2];
        const filled = allFields.filter(val => val !== undefined && val !== null && val !== "" && val !== 0 && val !== 0.0).length;
        const percentComplete = Math.round((filled / allFields.length) * 100) || 0;

        const inputStyle = {
          width: "100%",
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: "12px",
          color: "#0f172a",
          padding: "12px 16px",
          outline: "none",
          fontSize: "0.95rem",
          marginTop: "8px",
          height: "48px",
          transition: "all 0.2s"
        };

        const getInputStyle = (hasError: boolean) => ({
          ...inputStyle,
          borderColor: hasError ? "#ef4444" : "#cbd5e1",
          boxShadow: hasError ? "0 0 0 3px rgba(239, 68, 68, 0.1)" : "none"
        });

        return (
          <div className="tm-modal-backdrop" style={{ overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, padding: "20px" }}>
            <div className="tm-modal-content" style={{ 
              maxWidth: "1000px", 
              width: "100%", 
              margin: "auto",
              background: "#ffffff",
              borderRadius: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh"
            }}>
              {/* Modal Header */}
              <div style={{
                background: "#ffffff",
                padding: "24px 32px",
                color: "#1e293b",
                position: "relative",
                borderBottom: "1px solid #e2e8f0"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: "800", margin: 0, color: "#0f172a", textTransform: "uppercase" }}>
                    {tournament.TournamentName}
                  </h3>
                  <span style={{ 
                    background: "#047857", 
                    color: "#ffffff", 
                    padding: "4px 12px", 
                    borderRadius: "20px", 
                    fontSize: "0.75rem", 
                    fontWeight: "800",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ffffff", display: "inline-block" }}></span>
                    Đang mở đăng ký
                  </span>
                </div>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.9rem", color: "#64748b", fontWeight: "600" }}>
                  Nội dung: {selectedDivision.DivisionName}
                </p>
                <button 
                  onClick={() => setRegisterModalOpen(false)}
                  style={{ 
                    position: "absolute", 
                    top: "24px", 
                    right: "32px", 
                    background: "transparent", 
                    border: "none", 
                    fontSize: "1.5rem", 
                    color: "#64748b", 
                    cursor: "pointer" 
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Grid Content Layout */}
              <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", flex: 1, overflow: "hidden" }}>
                
                {/* Left Sidebar */}
                <div style={{ 
                  background: "#f4f6fc", 
                  padding: "24px", 
                  borderRight: "1px solid #e2e8f0", 
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px"
                }}>
                  {/* Progress Card */}
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "24px 20px", borderRadius: "16px", textAlign: "center", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
                    <div style={{ position: "relative", width: "110px", height: "110px", margin: "0 auto 16px auto" }}>
                      <svg width="110" height="110" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                        <circle cx="60" cy="60" r="48" fill="none" stroke="#047857" strokeWidth="8" 
                                strokeDasharray={`${2 * Math.PI * 48}`} 
                                strokeDashoffset={`${2 * Math.PI * 48 * (1 - percentComplete / 100)}`} 
                                strokeLinecap="round" transform="rotate(-90 60 60)" />
                      </svg>
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                        <p style={{ fontSize: "1.5rem", fontWeight: "800", margin: 0, color: "#0f172a" }}>{percentComplete}%</p>
                        <p style={{ fontSize: "0.7rem", color: "#64748b", margin: 0, textTransform: "uppercase", fontWeight: "bold", letterSpacing: "0.5px" }}>Hoàn tất</p>
                      </div>
                    </div>
                    <p style={{ fontSize: "0.9rem", fontWeight: "700", color: "#0f172a", margin: "0 0 6px 0" }}>Tiến trình đăng ký</p>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0, lineHeight: "1.5" }}>Vui lòng điền đầy đủ các thông tin bắt buộc.</p>
                  </div>

                  {/* Details vertical list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontSize: "0.85rem", color: "#334155" }}>
                    <div>
                      <p style={{ margin: "0 0 6px 0", fontWeight: "700", color: "#64748b", fontSize: "0.75rem", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        ĐỊA ĐIỂM
                      </p>
                      <p style={{ margin: 0, color: "#0f172a", fontWeight: "600", lineHeight: "1.4", paddingLeft: "22px" }}>{tournament.Location}</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px 0", fontWeight: "700", color: "#64748b", fontSize: "0.75rem", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        THỜI GIAN
                      </p>
                      <p style={{ margin: 0, color: "#0f172a", fontWeight: "600", paddingLeft: "22px" }}>{formatDate(tournament.StartDate)} - {formatDate(tournament.EndDate)}</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px 0", fontWeight: "700", color: "#64748b", fontSize: "0.75rem", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        GIỚI HẠN DUPR
                      </p>
                      <p style={{ margin: 0, color: "#e11d48", fontWeight: "700", paddingLeft: "22px" }}>{selectedDivision.MinDUPR || 0.0} - {selectedDivision.MaxDUPR || 8.0}</p>
                    </div>
                  </div>

                  {/* Assistance section */}
                  <div style={{ 
                    marginTop: "auto", 
                    background: "#eefaf2", 
                    border: "1px solid #d1fae5", 
                    borderRadius: "16px", 
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px"
                  }}>
                    <p style={{ margin: 0, fontWeight: "800", color: "#047857", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      HỖ TRỢ ĐĂNG KÝ
                    </p>
                    <a 
                      href="https://zalo.me/g/745jaepg9znc0dxgb6lk" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "12px", 
                        background: "#ffffff", 
                        padding: "12px", 
                        borderRadius: "12px", 
                        border: "1px solid #cbd5e1",
                        textDecoration: "none"
                      }}
                    >
                      <div style={{ 
                        background: "#0068ff", 
                        color: "#ffffff", 
                        fontWeight: "bold", 
                        width: "36px", 
                        height: "36px", 
                        borderRadius: "50%", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        fontSize: "1.1rem" 
                      }}>
                        Z
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "700", color: "#0f172a" }}>Zalo: Amakirk Open</p>
                        <p style={{ margin: 0, fontSize: "0.7rem", color: "#64748b", fontWeight: "500" }}>Phản hồi trong 5 phút</p>
                      </div>
                    </a>
                  </div>
                </div>

                {/* Right Form Content */}
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#ffffff" }}>
                  <div style={{ padding: "32px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "28px" }}>
                    
                    {/* Registration Options (Doubles only) */}
                    {!isSingles && !paymentData && (
                      <div style={{ 
                        background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", 
                        padding: "20px", 
                        borderRadius: "16px", 
                        border: "1px solid #cbd5e1" 
                      }}>
                        <label className="tm-form-label" style={{ marginBottom: "12px", fontWeight: "800", color: "#1e293b", fontSize: "0.9rem" }}>
                          Tùy chọn tìm kiếm đồng đội
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                          {[
                            { id: "ExistingPartner", label: "Đã có đồng đội (Mời qua SĐT/Email)" },
                            { id: "SuggestOnly", label: "Hệ thống gợi ý đồng đội phù hợp DUPR" },
                            { id: "AutoMatch", label: "Hệ thống tự ghép đồng đội" },
                            { id: "ManualForm", label: "Tự điền thông tin cả 2 (Đăng ký trực tiếp)" },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setPartnerOption(opt.id as any);
                                setSuccess("");
                                setError("");
                              }}
                              className={`tm-btn ${partnerOption === opt.id ? "tm-btn-primary" : "tm-btn-secondary"}`}
                              style={{ 
                                padding: "10px 14px", 
                                fontSize: "0.8rem", 
                                textAlign: "left", 
                                display: "block", 
                                width: "100%",
                                borderRadius: "10px",
                                fontWeight: "600"
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {partnerOption === "ExistingPartner" && (
                          <div style={{ marginTop: "16px" }}>
                            <label className="tm-form-label" style={{ fontWeight: "700" }}>Email hoặc Số điện thoại đồng đội *</label>
                            <input
                              type="text"
                              className="tm-form-input"
                              placeholder="Nhập email hoặc số điện thoại đồng đội để hệ thống gửi lời mời..."
                              value={partnerContact}
                              onChange={(e) => setPartnerContact(e.target.value)}
                              style={{ borderRadius: "8px", marginTop: "6px" }}
                            />
                          </div>
                        )}

                        {partnerOption === "SuggestOnly" && (
                          <div style={{ marginTop: "16px" }}>
                            <button type="button" onClick={handleRegisterDoubles} className="tm-btn tm-btn-accent" style={{ fontSize: "0.8rem", padding: "8px 16px", borderRadius: "8px" }}>
                              Tìm gợi ý đồng đội phù hợp DUPR
                            </button>
                            {suggestions.length > 0 && (
                              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                                {suggestions.map((p) => (
                                  <div key={p.UserID} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "0.8rem" }}>
                                    <div>
                                      <p style={{ fontWeight: "750", margin: 0, color: "#0f172a" }}>{p.FullName}</p>
                                      <p style={{ color: "#64748b", fontSize: "0.75rem", margin: "2px 0 0 0" }}>DUPR: <strong style={{ color: "#e11d48" }}>{p.DUPR}</strong> | Giới tính: {p.Gender === "Male" ? "Nam" : "Nữ"}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPartnerContact(p.Email || p.PhoneNumber);
                                        setPartnerOption("ExistingPartner");
                                      }}
                                      className="tm-btn tm-btn-primary"
                                      style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: "6px" }}
                                    >
                                      Chọn mời
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Status Messages */}
                    {error && <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", color: "#b91c1c", padding: "14px", borderRadius: "12px", fontSize: "0.875rem", fontWeight: "600" }}>⚠️ {error}</div>}
                    {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "14px", borderRadius: "12px", fontSize: "0.875rem", fontWeight: "600" }}>✅ {success}</div>}

                    {paymentData ? (
                      /* Payment Details Flow */
                      <div style={{ display: "flex", flexDirection: "column", gap: "20px", textAlign: "center", padding: "12px 0" }}>
                        <div style={{ 
                          background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)", 
                          border: "1px solid #a7f3d0", 
                          padding: "24px", 
                          borderRadius: "16px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                        }}>
                          <p style={{ fontWeight: "800", fontSize: "1rem", color: "#065f46", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>Yêu cầu thanh toán lệ phí giải</p>
                          <p style={{ fontSize: "2.5rem", fontWeight: "950", color: "#059669", margin: "14px 0" }}>
                            {paymentData.amount.toLocaleString()} VNĐ
                          </p>
                          <div style={{ background: "#fff", border: "1px dashed #f59e0b", padding: "12px", borderRadius: "8px", display: "inline-block", margin: "0 auto" }}>
                            <p style={{ fontSize: "0.8rem", color: "#b45309", fontWeight: "700", margin: 0 }}>
                              ⚠️ Lưu ý: Vé giữ chỗ sẽ bị hủy tự động nếu không thanh toán trong 10 phút.
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={handleSendPayOSPayment} 
                          disabled={registerLoading} 
                          className="tm-btn tm-btn-primary" 
                          style={{ 
                            width: "100%", 
                            padding: "14px", 
                            fontSize: "0.95rem", 
                            fontWeight: "bold",
                            background: "linear-gradient(135deg, #10b981, #059669)",
                            border: "none",
                            boxShadow: "0 4px 6px rgba(16, 185, 129, 0.2)",
                            borderRadius: "12px",
                            cursor: "pointer"
                          }}
                        >
                          {registerLoading ? "Đang kết nối cổng..." : "Thanh toán VietQR qua cổng PayOS (Nhận Link ngay)"}
                        </button>
                        <button onClick={() => setPaymentData(null)} style={{ fontSize: "0.8rem", color: "#64748b", background: "transparent", cursor: "pointer", border: "none", textDecoration: "underline", fontWeight: "600" }}>
                          Quay lại chỉnh sửa thông tin
                        </button>
                      </div>
                    ) : (
                      /* Normal Form Fields Flow */
                      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                        {/* Athlete 1 Form Block */}
                        <div>
                          <h4 style={{ 
                            fontSize: "1.1rem", 
                            fontWeight: "800", 
                            color: "#0f172a", 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "8px", 
                            borderBottom: "1px solid #f1f5f9", 
                            paddingBottom: "12px", 
                            marginBottom: "24px" 
                          }}>
                            <span style={{ color: "#047857", display: "inline-flex", alignItems: "center" }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            </span>
                            Thông tin vận động viên {isSingles ? "" : "1 (Trưởng nhóm)"}
                          </h4>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" }}>
                            <div className="tm-form-group">
                              <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Số điện thoại *</label>
                              <input 
                                type="text" 
                                placeholder="090 123 4567" 
                                style={getInputStyle(!!formErrors.phoneNumber1)} 
                                value={athlete1.phoneNumber} 
                                onChange={(e) => setAthlete1({ ...athlete1, phoneNumber: e.target.value })} 
                                required 
                              />
                              {formErrors.phoneNumber1 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.phoneNumber1}</span>}
                            </div>
                            
                            <div className="tm-form-group">
                              <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Họ và tên *</label>
                              <input 
                                type="text" 
                                placeholder="Nguyễn Văn A" 
                                style={getInputStyle(!!formErrors.fullName1)} 
                                value={athlete1.fullName} 
                                onChange={(e) => setAthlete1({ ...athlete1, fullName: e.target.value })} 
                                required 
                              />
                              {formErrors.fullName1 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.fullName1}</span>}
                            </div>
                            
                            <div className="tm-form-group">
                              <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Email nhận Chứng chỉ *</label>
                              <input 
                                type="email" 
                                placeholder="example@gmail.com" 
                                style={getInputStyle(!!formErrors.email1)} 
                                value={athlete1.email} 
                                onChange={(e) => setAthlete1({ ...athlete1, email: e.target.value })} 
                                required 
                              />
                              {formErrors.email1 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.email1}</span>}
                            </div>
                            
                            <div className="tm-form-group">
                              <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Điểm DUPR *</label>
                              <input 
                                type="number" 
                                step="0.01" 
                                placeholder="4.50" 
                                style={getInputStyle(!!formErrors.rating1)} 
                                value={athlete1.rating || ""} 
                                onChange={(e) => setAthlete1({ ...athlete1, rating: Number(e.target.value) })} 
                                required 
                              />
                              <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "6px", display: "block", fontStyle: "italic", lineHeight: "1.4" }}>
                                Vui lòng cung cấp điểm DUPR chính xác nhất tính đến ngày đăng ký.
                              </span>
                              {formErrors.rating1 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.rating1}</span>}
                            </div>
                            
                            <div className="tm-form-group">
                              <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Tỉnh/Thành phố *</label>
                              <select 
                                style={getInputStyle(!!formErrors.province1)} 
                                value={athlete1.province} 
                                onChange={(e) => setAthlete1({ ...athlete1, province: e.target.value })} 
                                required
                              >
                                <option value="">Chọn tỉnh thành</option>
                                <option value="Đà Nẵng">Đà Nẵng</option>
                                <option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
                                <option value="Hà Nội">Hà Nội</option>
                                <option value="Quảng Nam">Quảng Nam</option>
                                <option value="Khánh Hòa">Khánh Hòa</option>
                                <option value="Lâm Đồng">Lâm Đồng</option>
                                <option value="Khác">Tỉnh thành khác</option>
                              </select>
                              {formErrors.province1 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.province1}</span>}
                            </div>
                            
                            <div className="tm-form-group">
                              <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Giới tính *</label>
                              <div style={{ display: "flex", gap: "24px", height: "48px", alignItems: "center" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", cursor: "pointer", color: "#334155", fontWeight: "500" }}>
                                  <input 
                                    type="radio" 
                                    name="gender1" 
                                    value="Male" 
                                    checked={athlete1.gender === "Male"} 
                                    onChange={() => setAthlete1({ ...athlete1, gender: "Male" })} 
                                    style={{ width: "20px", height: "20px", accentColor: "#047857", cursor: "pointer" }}
                                  />
                                  Nam
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", cursor: "pointer", color: "#334155", fontWeight: "500" }}>
                                  <input 
                                    type="radio" 
                                    name="gender1" 
                                    value="Female" 
                                    checked={athlete1.gender === "Female"} 
                                    onChange={() => setAthlete1({ ...athlete1, gender: "Female" })} 
                                    style={{ width: "20px", height: "20px", accentColor: "#047857", cursor: "pointer" }}
                                  />
                                  Nữ
                                </label>
                              </div>
                              {formErrors.gender1 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.gender1}</span>}
                            </div>
                            
                            <div className="tm-form-group">
                              <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Ngày sinh *</label>
                              <input 
                                type="date" 
                                style={getInputStyle(!!formErrors.dateOfBirth1)} 
                                value={athlete1.dateOfBirth} 
                                onChange={(e) => setAthlete1({ ...athlete1, dateOfBirth: e.target.value })} 
                                required 
                              />
                              {formErrors.dateOfBirth1 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.dateOfBirth1}</span>}
                            </div>

                            {/* Avatar dashed upload box */}
                            <div className="tm-form-group" style={{ gridColumn: "span 2" }}>
                              <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Ảnh cá nhân vận động viên *</label>
                              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "athlete1")} style={{ display: "none" }} id="avatar-1-upload" />
                              <label htmlFor="avatar-1-upload" style={{ 
                                display: "flex", 
                                flexDirection: "column", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                padding: "40px 28px", 
                                border: "2px dashed #b2c0cc", 
                                borderRadius: "16px", 
                                cursor: "pointer", 
                                background: "#ffffff",
                                marginTop: "8px",
                                transition: "all 0.2s"
                              }}>
                                {athlete1.photoUrl ? (
                                  <div style={{ textAlign: "center" }}>
                                    <img src={athlete1.photoUrl} alt="Avatar 1" style={{ width: "120px", height: "120px", borderRadius: "12px", objectFit: "cover", marginBottom: "12px" }} />
                                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#047857", fontWeight: "700" }}>Thay đổi ảnh cá nhân</p>
                                  </div>
                                ) : (
                                  <div style={{ textAlign: "center" }}>
                                    <div style={{ 
                                      width: "56px", 
                                      height: "56px", 
                                      borderRadius: "50%", 
                                      background: "#f0fdf4", 
                                      display: "flex", 
                                      alignItems: "center", 
                                      justifyContent: "center", 
                                      margin: "0 auto 16px auto" 
                                    }}>
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                        <circle cx="12" cy="13" r="4" />
                                        <line x1="21" y1="9" x2="21" y2="15" />
                                        <line x1="18" y1="12" x2="24" y2="12" />
                                      </svg>
                                    </div>
                                    <p style={{ margin: "0 0 6px 0", fontSize: "0.9rem", fontWeight: "600", color: "#334155" }}>
                                      Kéo thả ảnh hoặc <span style={{ color: "#047857", textDecoration: "underline", fontWeight: "700" }}>Tải lên</span>
                                    </p>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
                                      Định dạng JPG, PNG. Tối đa 5MB. Ảnh rõ mặt.
                                    </p>
                                  </div>
                                )}
                              </label>
                            </div>

                            {/* DUPR Profile Link/ID input */}
                            <div className="tm-form-group" style={{ gridColumn: "span 2" }}>
                              <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Link Profile DUPR hoặc DUPR ID *</label>
                              <input 
                                type="text"
                                placeholder="Ví dụ: https://mydupr.com/dashboard/player/123456/info hoặc DUPR-ID-12345"
                                style={getInputStyle(!!formErrors.cccdUrl1)}
                                value={athlete1.cccdUrl}
                                onChange={(e) => setAthlete1({ ...athlete1, cccdUrl: e.target.value })}
                                required
                              />
                              {formErrors.cccdUrl1 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.cccdUrl1}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Athlete 2 Form Block (Doubles only) */}
                        {showAthlete2Form && (
                          <div style={{ marginTop: "16px", borderTop: "1px solid #f1f5f9", paddingTop: "32px" }}>
                            <h4 style={{ 
                              fontSize: "1.1rem", 
                              fontWeight: "800", 
                              color: "#0f172a", 
                              display: "flex", 
                              alignItems: "center", 
                              gap: "8px", 
                              borderBottom: "1px solid #f1f5f9", 
                              paddingBottom: "12px", 
                              marginBottom: "24px" 
                            }}>
                              <span style={{ color: "#047857", display: "inline-flex", alignItems: "center" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                              </span>
                              Thông tin đồng đội (Vận động viên 2)
                            </h4>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" }}>
                              <div className="tm-form-group">
                                <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Số điện thoại *</label>
                                <input 
                                  type="text" 
                                  placeholder="090 123 4567" 
                                  style={getInputStyle(!!formErrors.phoneNumber2)} 
                                  value={athlete2.phoneNumber} 
                                  onChange={(e) => setAthlete2({ ...athlete2, phoneNumber: e.target.value })} 
                                  required 
                                />
                                {formErrors.phoneNumber2 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.phoneNumber2}</span>}
                              </div>
                              
                              <div className="tm-form-group">
                                <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Họ và tên *</label>
                                <input 
                                  type="text" 
                                  placeholder="Nguyễn Văn B" 
                                  style={getInputStyle(!!formErrors.fullName2)} 
                                  value={athlete2.fullName} 
                                  onChange={(e) => setAthlete2({ ...athlete2, fullName: e.target.value })} 
                                  required 
                                />
                                {formErrors.fullName2 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.fullName2}</span>}
                              </div>
                              
                              <div className="tm-form-group">
                                <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Email nhận Chứng chỉ *</label>
                                <input 
                                  type="email" 
                                  placeholder="example@gmail.com" 
                                  style={getInputStyle(!!formErrors.email2)} 
                                  value={athlete2.email} 
                                  onChange={(e) => setAthlete2({ ...athlete2, email: e.target.value })} 
                                  required 
                                />
                                {formErrors.email2 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.email2}</span>}
                              </div>
                              
                              <div className="tm-form-group">
                                <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Điểm DUPR *</label>
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="4.50" 
                                  style={getInputStyle(!!formErrors.rating2)} 
                                  value={athlete2.rating || ""} 
                                  onChange={(e) => setAthlete2({ ...athlete2, rating: Number(e.target.value) })} 
                                  required 
                                />
                                <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "6px", display: "block", fontStyle: "italic", lineHeight: "1.4" }}>
                                  Vui lòng cung cấp điểm DUPR chính xác nhất tính đến ngày đăng ký.
                                </span>
                                {formErrors.rating2 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.rating2}</span>}
                              </div>
                              
                              <div className="tm-form-group">
                                <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Tỉnh/Thành phố *</label>
                                <select 
                                  style={getInputStyle(!!formErrors.province2)} 
                                  value={athlete2.province} 
                                  onChange={(e) => setAthlete2({ ...athlete2, province: e.target.value })} 
                                  required
                                >
                                  <option value="">Chọn tỉnh thành</option>
                                  <option value="Đà Nẵng">Đà Nẵng</option>
                                  <option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
                                  <option value="Hà Nội">Hà Nội</option>
                                  <option value="Quảng Nam">Quảng Nam</option>
                                  <option value="Khánh Hòa">Khánh Hòa</option>
                                  <option value="Lâm Đồng">Lâm Đồng</option>
                                  <option value="Khác">Tỉnh thành khác</option>
                                </select>
                                {formErrors.province2 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.province2}</span>}
                              </div>
                              
                              <div className="tm-form-group">
                                <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Giới tính *</label>
                                <div style={{ display: "flex", gap: "24px", height: "48px", alignItems: "center" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", cursor: "pointer", color: "#334155", fontWeight: "500" }}>
                                    <input 
                                      type="radio" 
                                      name="gender2" 
                                      value="Male" 
                                      checked={athlete2.gender === "Male"} 
                                      onChange={() => setAthlete2({ ...athlete2, gender: "Male" })} 
                                      style={{ width: "20px", height: "20px", accentColor: "#047857", cursor: "pointer" }}
                                    />
                                    Nam
                                  </label>
                                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", cursor: "pointer", color: "#334155", fontWeight: "500" }}>
                                    <input 
                                      type="radio" 
                                      name="gender2" 
                                      value="Female" 
                                      checked={athlete2.gender === "Female"} 
                                      onChange={() => setAthlete2({ ...athlete2, gender: "Female" })} 
                                      style={{ width: "20px", height: "20px", accentColor: "#047857", cursor: "pointer" }}
                                    />
                                    Nữ
                                  </label>
                                </div>
                                {formErrors.gender2 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.gender2}</span>}
                              </div>
                              
                              <div className="tm-form-group">
                                <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Ngày sinh *</label>
                                <input 
                                  type="date" 
                                  style={getInputStyle(!!formErrors.dateOfBirth2)} 
                                  value={athlete2.dateOfBirth} 
                                  onChange={(e) => setAthlete2({ ...athlete2, dateOfBirth: e.target.value })} 
                                  required 
                                />
                                {formErrors.dateOfBirth2 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.dateOfBirth2}</span>}
                              </div>

                              {/* Avatar dashed upload box 2 */}
                              <div className="tm-form-group" style={{ gridColumn: "span 2" }}>
                                <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Ảnh cá nhân đồng đội *</label>
                                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "athlete2")} style={{ display: "none" }} id="avatar-2-upload" />
                                <label htmlFor="avatar-2-upload" style={{ 
                                  display: "flex", 
                                  flexDirection: "column", 
                                  alignItems: "center", 
                                  justifyContent: "center", 
                                  padding: "40px 28px", 
                                  border: "2px dashed #b2c0cc", 
                                  borderRadius: "16px", 
                                  cursor: "pointer", 
                                  background: "#ffffff",
                                  marginTop: "8px",
                                  transition: "all 0.2s"
                                }}>
                                  {athlete2.photoUrl ? (
                                    <div style={{ textAlign: "center" }}>
                                      <img src={athlete2.photoUrl} alt="Avatar 2" style={{ width: "120px", height: "120px", borderRadius: "12px", objectFit: "cover", marginBottom: "12px" }} />
                                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#047857", fontWeight: "700" }}>Thay đổi ảnh cá nhân</p>
                                    </div>
                                  ) : (
                                    <div style={{ textAlign: "center" }}>
                                      <div style={{ 
                                        width: "56px", 
                                        height: "56px", 
                                        borderRadius: "50%", 
                                        background: "#f0fdf4", 
                                        display: "flex", 
                                        alignItems: "center", 
                                        justifyContent: "center", 
                                        margin: "0 auto 16px auto" 
                                      }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                          <circle cx="12" cy="13" r="4" />
                                          <line x1="21" y1="9" x2="21" y2="15" />
                                          <line x1="18" y1="12" x2="24" y2="12" />
                                        </svg>
                                      </div>
                                      <p style={{ margin: "0 0 6px 0", fontSize: "0.9rem", fontWeight: "600", color: "#334155" }}>
                                        Kéo thả ảnh hoặc <span style={{ color: "#047857", textDecoration: "underline" }}>Tải lên</span>
                                      </p>
                                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
                                        Định dạng JPG, PNG. Tối đa 5MB. Ảnh rõ mặt.
                                      </p>
                                    </div>
                                  )}
                                </label>
                              </div>

                              {/* DUPR Profile Link/ID input 2 */}
                              <div className="tm-form-group" style={{ gridColumn: "span 2" }}>
                                <label className="tm-form-label" style={{ fontWeight: "600", color: "#334155" }}>Link Profile DUPR hoặc DUPR ID đồng đội *</label>
                                <input 
                                  type="text"
                                  placeholder="Ví dụ: https://mydupr.com/dashboard/player/123456/info hoặc DUPR-ID-12345"
                                  style={getInputStyle(!!formErrors.cccdUrl2)}
                                  value={athlete2.cccdUrl || ""}
                                  onChange={(e) => setAthlete2({ ...athlete2, cccdUrl: e.target.value })}
                                  required
                                />
                                {formErrors.cccdUrl2 && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>{formErrors.cccdUrl2}</span>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Policy Disclaimer */}
                    <div style={{
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "16px",
                      padding: "20px",
                      marginTop: "24px",
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start",
                      textAlign: "left"
                    }}>
                      <span style={{ fontSize: "20px" }}>⚠️</span>
                      <div style={{ flex: 1 }}>
                        <h5 style={{ margin: "0 0 6px 0", fontSize: "0.875rem", fontWeight: "750", color: "#92400e" }}>
                          Điều khoản & Quy định thanh toán lệ phí giải đấu
                        </h5>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.8rem", color: "#b45309", lineHeight: "1.5" }}>
                          <li>Trong trường hợp phát hiện điểm DUPR hoặc thông tin cá nhân khai báo không chính xác, Ban tổ chức sẽ <strong>Từ chối hồ sơ</strong> và thực hiện hoàn tiền theo quy chế giải đấu.</li>
                          <li>Trường hợp vận động viên chủ động hủy đăng ký sau khi đã thanh toán thành công sẽ <strong>Không được hoàn trả lệ phí</strong> dưới mọi hình thức.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Fixed Footer */}
                  {!paymentData && (
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      padding: "20px 32px", 
                      borderTop: "1px solid #e2e8f0", 
                      background: "#ffffff" 
                    }}>
                      {/* Left side: Fee card */}
                      <div style={{ 
                        background: "#f1f5f9", 
                        padding: "8px 20px", 
                        borderRadius: "12px", 
                        display: "flex", 
                        flexDirection: "column",
                        gap: "2px"
                      }}>
                        <span style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>Lệ phí dự kiến</span>
                        <span style={{ fontSize: "1.15rem", fontWeight: "900", color: "#047857" }}>
                          {selectedDivision.RegistrationFee.toLocaleString()} VNĐ
                        </span>
                      </div>

                      {/* Right side: Actions */}
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <button 
                          type="button" 
                          onClick={() => setRegisterModalOpen(false)} 
                          style={{ 
                            background: "transparent", 
                            border: "none", 
                            color: "#64748b", 
                            fontWeight: "700", 
                            fontSize: "0.9rem", 
                            cursor: "pointer" 
                          }}
                        >
                          Hủy
                        </button>
                        
                        <button 
                          type="button" 
                          onClick={() => {
                            if (selectedDivision) {
                              const draftData = {
                                partnerOption,
                                partnerContact,
                                athlete1,
                                athlete2,
                              };
                              if (typeof window !== "undefined") {
                                localStorage.setItem(`tournament_reg_draft_${tournamentId}_${selectedDivision.DivisionID}`, JSON.stringify(draftData));
                                alert("Đã lưu nháp thông tin đăng ký thành công!");
                              }
                            }
                            setRegisterModalOpen(false);
                          }}
                          style={{ 
                            background: "#ffffff", 
                            border: "1px solid #cbd5e1", 
                            color: "#334155", 
                            padding: "10px 24px", 
                            borderRadius: "30px", 
                            fontSize: "0.9rem", 
                            fontWeight: "700", 
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          💾 Lưu nháp
                        </button>

                        <button 
                          type="button" 
                          onClick={() => isSingles ? handleRegisterSingles(selectedDivision) : handleRegisterDoubles()}
                          disabled={registerLoading}
                          style={{ 
                            background: "#047857", 
                            color: "#ffffff", 
                            border: "none", 
                            padding: "12px 28px", 
                            borderRadius: "30px", 
                            fontSize: "0.9rem", 
                            fontWeight: "800", 
                            cursor: "pointer",
                            boxShadow: "0 4px 6px rgba(4, 120, 87, 0.2)" 
                          }}
                        >
                          {registerLoading ? "Đang xử lý..." : "Hoàn tất đăng ký"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* Suitable Teammates Matching Modal */}
      {matchingModalOpen && (
        <div className="tm-modal-backdrop" style={{ overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100, padding: "20px" }}>
          <div className="tm-modal-content" style={{ 
            maxWidth: "640px", 
            width: "100%", 
            margin: "auto",
            background: "#ffffff",
            borderRadius: "24px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
            border: "1px solid rgba(226, 232, 240, 0.8)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "85vh"
          }}>
            {/* Modal Header */}
            <div style={{
              background: "#ffffff",
              padding: "20px 28px",
              color: "#1e293b",
              position: "relative",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: "800", margin: 0, color: "#0f172a", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🤝</span> Người chơi phù hợp đánh đôi
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Danh sách gợi ý dựa trên trình độ, khu vực và khung giờ thi đấu.
                </p>
              </div>
              <button 
                onClick={() => {
                  setMatchingModalOpen(false);
                  setInvitingPlayer(null);
                }}
                style={{ 
                  background: "transparent", 
                  border: "none", 
                  fontSize: "1.5rem", 
                  color: "#64748b", 
                  cursor: "pointer",
                  padding: "4px"
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, background: "#f8fafc" }}>
              {loadingPlayers ? (
                <div style={{ textAlign: "center", padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "32px", height: "32px", border: "3px solid #047857", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} className="animate-spin" />
                  <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Đang phân tích và tìm kiếm người chơi phù hợp...</p>
                </div>
              ) : suitablePlayers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px", background: "#ffffff", borderRadius: "16px", border: "1.5px dashed #cbd5e1" }}>
                  <span style={{ fontSize: "40px", display: "block", marginBottom: "16px" }}>👥</span>
                  <h4 style={{ margin: "0 0 8px 0", color: "#0f172a", fontSize: "0.95rem", fontWeight: "700" }}>Chưa tìm thấy người chơi phù hợp</h4>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: "1.5" }}>
                    Hãy thử cập nhật lại khung giờ rảnh trong Hồ sơ chơi bóng của bạn hoặc quay lại sau.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {suitablePlayers.map((item) => {
                    const player = item.profile || item;
                    const isExpanded = expandedPlayerIds.includes(player.UserID);
                    const status = invitationStatus[player.UserID];
                    
                    // Format time helper
                    const formatTimeLocal = (timeVal: any) => {
                      if (!timeVal) return "";
                      const str = String(timeVal);
                      if (str.includes("T")) {
                        const parts = str.split("T")[1];
                        return parts ? parts.substring(0, 5) : str.substring(0, 5);
                      }
                      return str.substring(0, 5);
                    };

                    return (
                      <div key={player.UserID} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", gap: "14px" }}>
                        {/* Player Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                            {player.AvatarURL ? (
                              <img src={player.AvatarURL} alt={player.FullName} style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: "2px solid #e2e8f0" }} />
                            ) : (
                              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#f0fdf4", color: "#047857", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "1.1rem", border: "2px solid #e2e8f0" }}>
                                {player.FullName ? player.FullName.charAt(0).toUpperCase() : "P"}
                              </div>
                            )}
                            <div>
                              <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "800", color: "#0f172a" }}>{player.FullName}</h4>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                                <span style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.7rem", padding: "2px 8px", borderRadius: "4px", fontWeight: "600" }}>
                                  {player.PlayingRole || "Người chơi"}
                                </span>
                                <span style={{ background: player.Gender === "Female" ? "#fce7f3" : "#dbeafe", color: player.Gender === "Female" ? "#be185d" : "#1d4ed8", fontSize: "0.7rem", padding: "2px 8px", borderRadius: "4px", fontWeight: "600" }}>
                                  {player.Gender === "Female" ? "Nữ" : "Nam"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>DUPR Rating</span>
                            <span style={{ fontSize: "1.1rem", fontWeight: "900", color: "#ef4444" }}>{player.Rating || player.SkillLevel || "3.5"}</span>
                          </div>
                        </div>

                        {/* Player Basic Info Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", fontSize: "0.8rem" }}>
                          <div>
                            <span style={{ color: "#64748b" }}>📍 Khu vực: </span>
                            <strong style={{ color: "#334155" }}>{player.Address || "Hà Nội"}</strong>
                          </div>
                          <div>
                            <span style={{ color: "#64748b" }}>⏱️ Lịch trống: </span>
                            <strong style={{ color: "#047857" }}>
                              {player.AvailableStartTime ? `${formatTimeLocal(player.AvailableStartTime)} - ${formatTimeLocal(player.AvailableEndTime)}` : "Cả ngày"}
                            </strong>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", border: "1px dashed #e2e8f0", borderRadius: "8px", fontSize: "0.8rem", background: "#fafafa" }}>
                            <div>
                              <span style={{ color: "#64748b" }}>Kinh nghiệm: </span>
                              <strong style={{ color: "#334155" }}>{player.ExperienceYears || "0"} năm thi đấu</strong>
                            </div>
                            {player.PlayStyle && (
                              <div>
                                <span style={{ color: "#64748b" }}>Phong cách chơi: </span>
                                <span style={{ color: "#334155" }}>{player.PlayStyle}</span>
                              </div>
                            )}
                            {player.Goal && (
                              <div>
                                <span style={{ color: "#64748b" }}>Mục tiêu: </span>
                                <span style={{ color: "#334155" }}>{player.Goal}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                          <button
                            type="button"
                            onClick={() => handleToggleExpandPlayer(player.UserID)}
                            style={{ background: "transparent", border: "none", color: "#047857", cursor: "pointer", fontSize: "0.8rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px", padding: 0 }}
                          >
                            {isExpanded ? "Thu gọn hồ sơ ▲" : "Xem hồ sơ chi tiết ▼"}
                          </button>

                          {status?.sent ? (
                            <span style={{ background: "#dcfce7", color: "#166534", fontSize: "0.8rem", padding: "6px 16px", borderRadius: "8px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              ✓ Đã gửi lời mời
                            </span>
                          ) : invitingPlayer?.UserID === player.UserID ? (
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                type="button"
                                disabled={status?.sending}
                                onClick={() => handleSendInviteToPlayer(player)}
                                style={{ background: "#047857", color: "#ffffff", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "0.8rem", fontWeight: "700", cursor: "pointer" }}
                              >
                                {status?.sending ? "Đang gửi..." : "Xác nhận gửi"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setInvitingPlayer(null)}
                                style={{ background: "#e2e8f0", color: "#475569", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "0.8rem", fontWeight: "700", cursor: "pointer" }}
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setInvitingPlayer(player);
                                setCustomInviteMsg(`Chào bạn, mình muốn gửi lời mời ghép cặp cùng tham gia giải đấu ${tournament?.TournamentName || ""} nhé!`);
                              }}
                              style={{ background: "#047857", color: "#ffffff", border: "none", borderRadius: "8px", padding: "6px 16px", fontSize: "0.8rem", fontWeight: "750", cursor: "pointer", transition: "all 0.2s" }}
                            >
                              Gửi lời mời ghép cặp
                            </button>
                          )}
                        </div>

                        {/* Inline custom invitation msg area */}
                        {invitingPlayer?.UserID === player.UserID && (
                          <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Lời nhắn gửi tới {player.FullName}:</label>
                            <textarea
                              value={customInviteMsg}
                              onChange={(e) => setCustomInviteMsg(e.target.value)}
                              rows={2}
                              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.8rem", outline: "none" }}
                            />
                          </div>
                        )}

                        {/* Error warning */}
                        {status?.error && (
                          <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "-4px", display: "block" }}>
                            ⚠️ {status.error}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 28px",
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              textAlign: "right"
            }}>
              <button 
                onClick={() => {
                  setMatchingModalOpen(false);
                  setInvitingPlayer(null);
                }}
                className="tm-btn"
                style={{ 
                  background: "#ffffff", 
                  border: "1px solid #cbd5e1", 
                  color: "#334155", 
                  borderRadius: "8px", 
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini-Profile Modal */}
      {showProfileModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(6px)"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "24px",
            width: "100%",
            maxWidth: "400px",
            boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 24px",
              borderBottom: "1px solid #f1f5f9"
            }}>
              <span style={{ 
                fontSize: "15px", 
                fontWeight: "800", 
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <LuUser size={16} style={{ color: "#2563eb" }} />
                <span>Thông tin vận động viên</span>
              </span>
              <button 
                onClick={() => setShowProfileModal(false)}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e2e8f0";
                  e.currentTarget.style.color = "#0f172a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.color = "#64748b";
                }}
                title="Đóng"
              >
                <LuX size={14} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: "24px", overflowY: "auto", maxHeight: "400px", background: "#f8fafc" }}>
              {profileLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: "12px" }}>
                  <div style={{ width: "32px", height: "32px", border: "3px solid #eff6ff", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ fontSize: "13px", color: "#64748b" }}>Đang tải thông tin...</span>
                </div>
              ) : profileMembers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: "13px" }}>
                  Không tìm thấy thông tin hồ sơ của vận động viên này.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {profileMembers.map((member, index) => {
                    const initials = member.FullName ? member.FullName.split(" ").pop()?.slice(0, 2).toUpperCase() : "AA";
                    
                    return (
                      <div key={member.AthleteID || index} style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "center", 
                        background: "#ffffff", 
                        borderRadius: "18px", 
                        padding: "24px 20px", 
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
                      }}>
                        {/* Member Tag */}
                        <span style={{ 
                          alignSelf: "flex-start", 
                          background: "#f1f5f9", 
                          color: "#475569", 
                          fontSize: "9px", 
                          fontWeight: "800", 
                          padding: "3px 8px", 
                          borderRadius: "6px", 
                          textTransform: "uppercase", 
                          letterSpacing: "0.5px", 
                          marginBottom: "16px" 
                        }}>
                          Vận động viên #{index + 1}
                        </span>

                        {/* Avatar */}
                        <div style={{ marginBottom: "16px" }}>
                          {member.PhotoURL ? (
                            <img 
                              src={member.PhotoURL} 
                              alt={member.FullName} 
                              style={{ 
                                width: "90px", 
                                height: "90px", 
                                borderRadius: "50%", 
                                objectFit: "cover", 
                                border: "3px solid #ffffff",
                                boxShadow: "0 8px 16px -4px rgba(0,0,0,0.15)"
                              }} 
                            />
                          ) : (
                            <div style={{ 
                              width: "90px", 
                              height: "90px", 
                              borderRadius: "50%", 
                              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", 
                              color: "#ffffff", 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center", 
                              fontSize: "28px", 
                              fontWeight: "750", 
                              border: "3px solid #ffffff",
                              boxShadow: "0 8px 16px -4px rgba(0,0,0,0.15)"
                            }}>
                              {initials}
                            </div>
                          )}
                        </div>

                        {/* Player Name */}
                        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "800", color: "#0f172a", textAlign: "center" }}>
                          {member.FullName}
                        </h3>

                        {/* DUPR Badge */}
                        <div style={{ 
                          background: "#fffbeb", 
                          color: "#b45309", 
                          fontSize: "11px", 
                          fontWeight: "800", 
                          padding: "4px 14px", 
                          borderRadius: "9999px",
                          marginBottom: "16px",
                          border: "1px solid #fde68a",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}>
                          ⭐ DUPR: {member.Rating !== null && member.Rating !== undefined ? Number(member.Rating).toFixed(2) : "Chưa cập nhật"}
                        </div>

                        {/* Personal Stats Grid */}
                        <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "10px", border: "1px solid #f1f5f9", textAlign: "center" }}>
                            <span style={{ display: "block", fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "800", marginBottom: "4px", letterSpacing: "0.3px" }}>Giới tính</span>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", fontWeight: "700", color: "#334155" }}>
                              {member.Gender === "Male" ? (
                                <>
                                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6" }} />
                                  <span>Nam</span>
                                </>
                              ) : member.Gender === "Female" ? (
                                <>
                                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ec4899" }} />
                                  <span>Nữ</span>
                                </>
                              ) : (
                                <span>Chưa rõ</span>
                              )}
                            </div>
                          </div>
                          <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "10px", border: "1px solid #f1f5f9", textAlign: "center" }}>
                            <span style={{ display: "block", fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "800", marginBottom: "4px", letterSpacing: "0.3px" }}>Khu vực</span>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "13px", fontWeight: "700", color: "#334155" }}>
                              <LuMapPin size={12} style={{ color: "#64748b" }} />
                              <span>{member.Province || "N/A"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              textAlign: "right"
            }}>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="tm-btn"
                style={{ 
                  background: "#2563eb", 
                  color: "#ffffff", 
                  border: "none",
                  borderRadius: "12px", 
                  padding: "10px 20px",
                  fontSize: "0.85rem",
                  fontWeight: "750",
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(37, 99, 235, 0.2)"
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate & Prize Modal */}
      {showCertModal && selectedCertReg && (() => {
        // Resolve rank based on database or override selector
        let rankValue: number | null = null;
        if (certRankOverride === "auto") {
          rankValue = selectedCertReg.rank;
        } else if (certRankOverride === "1") {
          rankValue = 1;
        } else if (certRankOverride === "2") {
          rankValue = 2;
        } else if (certRankOverride === "3") {
          rankValue = 3;
        } else {
          rankValue = null;
        }

        const athleteNames = selectedCertReg.members && selectedCertReg.members.length > 0
          ? selectedCertReg.members.map((m: any) => m.FullName).join(" - ")
          : selectedCertReg.FullName || "Vận động viên";

        const isChampion = rankValue === 1;
        const isRunnerUp = rankValue === 2;
        const isThird = rankValue === 3;
        const isWinner = isChampion || isRunnerUp || isThird;

        // Visual properties based on rank
        let titleColor = "#065f46"; // default green for participation
        let certTitle = "CHỨNG NHẬN THAM GIA";
        let certSub = "Đã hoàn thành thi đấu giải";
        let rewardText = "Hộp quà lưu niệm BTC & Huy hiệu lưu niệm";
        let cardBg = "linear-gradient(135deg, #fdfbf7 0%, #f7f3eb 100%)";
        let rankLabel = "Chứng nhận hoàn thành giải đấu";
        let badgeIcon = "🎁";

        if (isChampion) {
          titleColor = "#92400e"; // gold
          certTitle = "CHỨNG NHẬN VÔ ĐỊCH";
          certSub = "Đạt thành tích xuất sắc HẠNG 1 (VÔ ĐỊCH)";
          rewardText = "CÚP VÔ ĐỊCH, Huy chương Vàng & Tiền thưởng 5.000.000 VNĐ";
          cardBg = "linear-gradient(135deg, #fdfbf7 0%, #fffbeb 100%)";
          rankLabel = "Giải Vô Địch (Hạng 1)";
          badgeIcon = "🏆";
        } else if (isRunnerUp) {
          titleColor = "#4b5563"; // silver
          certTitle = "CHỨNG NHẬN Á QUÂN";
          certSub = "Đạt thành tích xuất sắc HẠNG 2 (Á QUÂN)";
          rewardText = "Huy chương Bạc & Tiền thưởng 3.000.000 VNĐ";
          cardBg = "linear-gradient(135deg, #fdfbf7 0%, #f3f4f6 100%)";
          rankLabel = "Giải Á Quân (Hạng 2)";
          badgeIcon = "🥈";
        } else if (isThird) {
          titleColor = "#b45309"; // bronze
          certTitle = "CHỨNG NHẬN HẠNG BA";
          certSub = "Đạt thành tích HẠNG 3 (ĐỒNG GIẢI BA)";
          rewardText = "Huy chương Đồng & Tiền thưởng 1.500.000 VNĐ";
          cardBg = "linear-gradient(135deg, #fdfbf7 0%, #fdf5e2 100%)";
          rankLabel = "Đồng Giải Ba (Hạng 3)";
          badgeIcon = "🥉";
        }

        return (
          <div className="cert-modal-overlay" style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(6px)",
            padding: "20px"
          }}>
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                .cert-modal-overlay {
                  background: none !important;
                  backdrop-filter: none !important;
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  display: block !important;
                }
                .cert-modal-card {
                  box-shadow: none !important;
                  border: none !important;
                  max-width: 100% !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .printable-certificate-container {
                  visibility: visible !important;
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  border: none !important;
                  box-shadow: none !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .printable-certificate-container * {
                  visibility: visible !important;
                }
                .cert-test-controls, .cert-modal-header, .cert-modal-footer-btns {
                  display: none !important;
                }
              }
            `}</style>
            
            <div className="cert-modal-card" style={{
              background: "#ffffff",
              borderRadius: "24px",
              width: "100%",
              maxWidth: "680px",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.3)",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              animation: "zoomIn 0.3s ease-out"
            }}>
              {/* Modal Header */}
              <div className="cert-modal-header" style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid #f1f5f9"
              }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                  🏆 Chứng nhận điện tử & Giải thưởng
                </span>
                <button 
                  onClick={() => setShowCertModal(false)}
                  style={{
                    border: "none",
                    background: "#f1f5f9",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#64748b",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#e2e8f0";
                    e.currentTarget.style.color = "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f1f5f9";
                    e.currentTarget.style.color = "#64748b";
                  }}
                >
                  <LuX size={14} />
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: "24px", overflowY: "auto", maxHeight: "80vh" }}>
                {/* Preview Test Controls */}
                <div className="cert-test-controls" style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  background: "#f1f5f9",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  fontSize: "12px",
                  color: "#475569",
                  border: "1px solid #e2e8f0"
                }}>
                  <span>💡 <strong>Preview Test:</strong> Chọn hạng để xem thử mẫu chứng nhận:</span>
                  <select 
                    value={certRankOverride} 
                    onChange={(e) => setCertRankOverride(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      fontWeight: "700",
                      outline: "none",
                      fontSize: "12px",
                      color: "#1e293b",
                      cursor: "pointer"
                    }}
                  >
                    <option value="auto">Hạng thực tế từ giải đấu</option>
                    <option value="1">Hạng 1 (Vô địch)</option>
                    <option value="2">Hạng 2 (Á quân)</option>
                    <option value="3">Hạng 3 (Đồng hạng ba)</option>
                    <option value="none">Hạng khác (Chỉ tham gia)</option>
                  </select>
                </div>

                {selectedCertReg.loading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px" }}>
                    <div style={{ width: "32px", height: "32px", border: "3px solid #f3e8ff", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <span style={{ fontSize: "13px", color: "#64748b" }}>Đang khởi tạo chứng chỉ...</span>
                  </div>
                ) : (
                  /* Certificate Canvas (Printable Area) */
                  <div className="printable-certificate-container" style={{
                    background: cardBg,
                    border: "8px double #d97706",
                    borderRadius: "16px",
                    padding: "32px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    fontFamily: "var(--font-sans, system-ui)"
                  }}>
                    {/* Inner thin border */}
                    <div style={{
                      position: "absolute",
                      inset: "8px",
                      border: "1px solid #fde68a",
                      pointerEvents: "none",
                      borderRadius: "8px"
                    }} />

                    {/* Header Seal Banner */}
                    <div style={{
                      fontSize: "9px",
                      fontWeight: "800",
                      color: "#b45309",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      marginBottom: "12px"
                    }}>
                      Hệ Thống Giải Đấu Pickleball Chuyên Nghiệp • PickleClub
                    </div>

                    {/* Ribbon or Icon */}
                    <span style={{ fontSize: "28px", marginBottom: "8px" }}>🏆</span>

                    {/* Main Title */}
                    <h1 style={{
                      margin: "0 0 4px 0",
                      fontSize: "24px",
                      fontWeight: "900",
                      color: titleColor,
                      letterSpacing: "0.5px"
                    }}>
                      {certTitle}
                    </h1>
                    
                    <div style={{
                      width: "120px",
                      height: "2px",
                      background: isWinner ? "linear-gradient(90deg, transparent, #d97706, transparent)" : "linear-gradient(90deg, transparent, #059669, transparent)",
                      margin: "8px 0 16px 0"
                    }} />

                    <p style={{ margin: "0", fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                      Ban Tổ Chức Giải Đấu trân trọng trao tặng cho
                    </p>

                    {/* Recipient Name */}
                    <h2 style={{
                      margin: "12px 0 6px 0",
                      fontSize: "22px",
                      fontWeight: "850",
                      color: "#0f172a"
                    }}>
                      {athleteNames}
                    </h2>

                    <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#475569", maxWidth: "480px", lineHeight: "1.6" }}>
                      Đã hoàn thành thi đấu xuất sắc nội dung <strong>{selectedCertReg.DivisionName}</strong> (Mã đội: {selectedCertReg.TeamCode}) tại giải đấu <strong>{tournament?.TournamentName}</strong> tổ chức tại {tournament?.Location || "PickleClub Center"}.
                    </p>

                    {/* Prize description block */}
                    <div style={{
                      background: isWinner ? "#fffbeb" : "#f0fdf4",
                      border: isWinner ? "1.5px solid #fef3c7" : "1.5px solid #d1fae5",
                      borderRadius: "14px",
                      padding: "16px 20px",
                      width: "100%",
                      maxWidth: "460px",
                      marginBottom: "24px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
                    }}>
                      <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "800", color: isWinner ? "#b45309" : "#047857", letterSpacing: "0.5px" }}>
                        {rankLabel}
                      </span>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{badgeIcon}</span>
                        <span>{rewardText}</span>
                      </div>
                    </div>

                    {/* Footer stamps / Signatures */}
                    <div style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      paddingTop: "12px",
                      borderTop: "1px dashed #e2e8f0"
                    }}>
                      {/* Left: Signature */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", gap: "4px" }}>
                        <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Đại Diện Ban Tổ Chức</span>
                        <div style={{ fontFamily: "serif", fontSize: "16px", fontWeight: "bold", fontStyle: "italic", color: "#334155", margin: "4px 0", letterSpacing: "1px" }}>
                          PickleClub President
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#475569" }}>Lê Thanh Sơn (Đã ký)</span>
                      </div>

                      {/* Middle Gold Seal Badge */}
                      <div style={{
                        width: "66px",
                        height: "66px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
                        border: "3px dashed #ffffff",
                        boxShadow: "0 0 12px rgba(217, 119, 6, 0.35)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontWeight: "900",
                        fontSize: "8px",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        lineHeight: 1.1
                      }}>
                        <span>VALID</span>
                        <span style={{ fontSize: "6px", opacity: 0.9 }}>STAMP</span>
                      </div>

                      {/* Right: Date */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right", gap: "4px" }}>
                        <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Ngày Cấp Chứng Nhận</span>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>
                          {new Date().toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer (Controls) */}
              <div className="cert-modal-footer-btns" style={{
                padding: "16px 24px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px"
              }}>
                <button 
                  onClick={() => setShowCertModal(false)}
                  className="tm-btn"
                  style={{
                    background: "#ffffff",
                    color: "#475569",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "10px 20px",
                    fontSize: "0.85rem",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
                >
                  Đóng
                </button>
                <button 
                  onClick={() => window.print()}
                  className="tm-btn"
                  disabled={selectedCertReg.loading}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "12px",
                    padding: "10px 24px",
                    fontSize: "0.85rem",
                    fontWeight: "800",
                    cursor: "pointer",
                    boxShadow: "0 4px 10px rgba(124, 58, 237, 0.25)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  🖨️ In & Tải xuống PDF
                </button>
                {(selectedCertReg.certificatePdfUrl || selectedCertReg.CertificatePdfUrl) && (
                  <button 
                    onClick={() => window.open(selectedCertReg.certificatePdfUrl || selectedCertReg.CertificatePdfUrl, "_blank")}
                    className="tm-btn"
                    style={{
                      background: "#ffffff",
                      color: "#059669",
                      border: "1.5px solid #059669",
                      borderRadius: "12px",
                      padding: "10px 20px",
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: "0 4px 10px rgba(5, 150, 105, 0.1)"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f0fdf4"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
                  >
                    📎 Tải File Đính Kèm (PDF/Ảnh)
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
