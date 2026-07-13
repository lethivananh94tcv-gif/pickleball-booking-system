"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { tournamentApi, Tournament, TournamentDivision } from "@/services/tournamentApi";
import { getUser } from "@/utils/authStorage";
import styles from "./AdminTournamentManagePage.module.css";

export default function AdminTournamentManagePage({ params }: { params: Promise<{ id: string }> }) {
  const routerParams = useParams();
  const id = (routerParams?.id as string) || "";
  const tournamentId = parseInt(id, 10);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<TournamentDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState<string>("Bảng A");

  // Auth & tab states
  const [isStaff, setIsStaff] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"operations" | "registrations">("operations");

  const [registrations, setRegistrations] = useState<any[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  // Division Create Modal state
  const [divModalOpen, setDivModalOpen] = useState(false);
  const [divFormData, setDivFormData] = useState({
    divisionName: "",
    genderRequirement: "Mixed",
    ageGroup: "Open",
    competitionFormat: "MenSingles",
    bracketType: "SingleElimination",
    registrationFee: 0,
    maxTeams: 16,
    minDUPR: "",
    maxDUPR: "",
    minAge: "",
    maxAge: "",
  });

  // Court allocation form state
  const [courtInput, setCourtInput] = useState("1, 2");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [durationInput, setDurationInput] = useState(60);
  const [breakInput, setBreakInput] = useState(10);
  const [dailyStartHour, setDailyStartHour] = useState("07:00");
  const [dailyEndHour, setDailyEndHour] = useState("22:00");
  const [schedulingLoading, setSchedulingLoading] = useState(false);

  // Score reporting modal state
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [setScores, setSetScores] = useState([
    { setNo: 1, teamAScore: 0, teamBScore: 0 },
    { setNo: 2, teamAScore: 0, teamBScore: 0 },
    { setNo: 3, teamAScore: 0, teamBScore: 0 },
  ]);
  const [adminOverride, setAdminOverride] = useState(false);

  const loadData = () => {
    if (isNaN(tournamentId)) return;
    setLoading(true);
    Promise.all([
      tournamentApi.getTournamentDetail(tournamentId),
      tournamentApi.getDivisions(tournamentId),
    ])
      .then(([tourn, divs]) => {
        setTournament(tourn);
        setDivisions(divs);
        if (divs.length > 0 && !selectedDivisionId) {
          setSelectedDivisionId(divs[0].DivisionID);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Không thể tải thông tin giải quản trị.");
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    loadData();
    const user = getUser();
    const role = String(user?.RoleName || user?.role || user?.roles?.[0] || "").toLowerCase();
    if (role.includes("staff")) {
      setIsStaff(true);
      setActiveTab("registrations");
    }
    if (role.includes("admin")) {
      setIsAdmin(true);
    }
  }, [tournamentId]);
  const loadMatches = () => {
    if (!selectedDivisionId) return;
    tournamentApi
      .getMatches(tournamentId, selectedDivisionId)
      .then((data) => setMatches(data))
      .catch((err) => console.error("Error loading matches", err));
      
    tournamentApi
      .getStandings(tournamentId, selectedDivisionId)
      .then((data) => setStandings(data))
      .catch((err) => console.error("Error loading standings", err));
  };

  const loadRegistrations = () => {
    if (!selectedDivisionId) return;
    setRegistrationsLoading(true);
    tournamentApi
      .getRegistrations(tournamentId, selectedDivisionId)
      .then((data) => setRegistrations(data))
      .catch((err) => console.error("Error loading registrations", err))
      .finally(() => setRegistrationsLoading(false));
  };

  const handleRegistrationAction = async (registrationId: number, action: "verify" | "checkin", currentValue: boolean) => {
    try {
      setError("");
      setSuccess("");
      await tournamentApi.updateRegistrationAction(registrationId, action, !currentValue);
      setSuccess(action === "verify" ? "Cập nhật duyệt thông tin DUPR thành công!" : "Cập nhật điểm danh check-in thành công!");
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || "Thao tác thất bại.");
    }
  };

  const handleRejectRegistration = async (registrationId: number, teamName: string) => {
    const reason = prompt(
      `Bạn có chắc chắn muốn TỪ CHỐI và yêu cầu HOÀN TIỀN cho đội "${teamName}"?\n\nVui lòng nhập lý do từ chối kèm thông tin tài khoản nhận tiền của VĐV:\n(Ví dụ: Điểm DUPR khai khống. [Bank: VCB] [STK: 123456] [Name: NGUYEN VAN A])`
    );
    if (reason === null) return; // User clicked Cancel
    
    const trimmed = reason.trim();
    if (!trimmed) {
      alert("Vui lòng nhập lý do từ chối hồ sơ và thông tin hoàn tiền để gửi lên Admin đối soát.");
      return;
    }

    try {
      setError("");
      setSuccess("");
      await tournamentApi.updateRegistrationAction(registrationId, "reject", trimmed);
      setSuccess(`Đã gửi yêu cầu từ chối & hoàn tiền cho đội "${teamName}" lên hệ thống Admin thành công!`);
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || "Thao tác thất bại.");
    }
  };

  useEffect(() => {
    if (selectedDivisionId) {
      loadMatches();
      loadRegistrations();
    }
  }, [selectedDivisionId]);

  const handleCreateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...divFormData,
        registrationFee: Number(divFormData.registrationFee),
        maxTeams: Number(divFormData.maxTeams),
        minDUPR: divFormData.minDUPR ? Number(divFormData.minDUPR) : null,
        maxDUPR: divFormData.maxDUPR ? Number(divFormData.maxDUPR) : null,
        minAge: divFormData.minAge ? Number(divFormData.minAge) : null,
        maxAge: divFormData.maxAge ? Number(divFormData.maxAge) : null,
      };
      await tournamentApi.createDivision(tournamentId, payload);
      setSuccess("Tạo mới nội dung thi đấu thành công!");
      setDivModalOpen(false);
      // Reset form
      setDivFormData({
        divisionName: "",
        genderRequirement: "Mixed",
        ageGroup: "Open",
        competitionFormat: "MenSingles",
        bracketType: "SingleElimination",
        registrationFee: 0,
        maxTeams: 16,
        minDUPR: "",
        maxDUPR: "",
        minAge: "",
        maxAge: "",
      });
      // Reload division list
      const updatedDivs = await tournamentApi.getDivisions(tournamentId);
      setDivisions(updatedDivs);
      if (updatedDivs.length > 0) {
        setSelectedDivisionId(updatedDivs[updatedDivs.length - 1].DivisionID);
      }
    } catch (err: any) {
      setError(err.message || "Tạo nội dung thi đấu thất bại.");
    }
  };

  const handleGenerateMatches = async (bracketType: "SingleElimination" | "RoundRobin") => {
    if (!selectedDivisionId) return;
    setError("");
    setSuccess("");
    try {
      let res;
      if (bracketType === "SingleElimination") {
        res = await tournamentApi.generateBracket(tournamentId, selectedDivisionId);
      } else {
        res = await tournamentApi.generateSchedule(tournamentId, selectedDivisionId);
      }
      setSuccess(res.message || "Khởi tạo sơ đồ nhánh đấu và lịch đấu thành công!");
      loadMatches();
    } catch (err: any) {
      setError(err.message || "Khởi tạo nhánh đấu thất bại.");
    }
  };

  const handleGenerateGroups = async (groupCount: number) => {
    if (!selectedDivisionId) return;
    setError("");
    setSuccess("");
    try {
      const res = await tournamentApi.generateGroups(tournamentId, selectedDivisionId, groupCount);
      setSuccess("Khởi tạo lịch đấu vòng bảng thành công!");
      loadMatches();
    } catch (err: any) {
      setError(err.message || "Khởi tạo vòng bảng thất bại.");
    }
  };

  const handleGenerateKnockout = async () => {
    if (!selectedDivisionId) return;
    setError("");
    setSuccess("");
    try {
      const res = await tournamentApi.generateKnockout(tournamentId, selectedDivisionId);
      setSuccess("Tạo nhánh đấu loại trực tiếp chéo từ kết quả vòng bảng thành công!");
      loadMatches();
    } catch (err: any) {
      setError(err.message || "Tạo nhánh đấu loại trực tiếp thất bại.");
    }
  };

  const handleAllocateCourts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDivisionId) return;
    setError("");
    setSuccess("");
    setSchedulingLoading(true);
    try {
      const courts = courtInput.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
      if (courts.length === 0) {
        throw new Error("Vui lòng nhập danh sách ID sân hợp lệ (Ví dụ: 1, 2)");
      }
      const payload: any = {
        courtIds: courts,
        startDateTime: new Date(startTimeInput).toISOString(),
        matchDurationMinutes: durationInput,
        breakMinutes: breakInput,
        dailyStartHour: dailyStartHour,
        dailyEndHour: dailyEndHour,
      };
      if (endDateInput) {
        payload.endDateTime = new Date(endDateInput).toISOString();
      }
      const res = await tournamentApi.allocateSchedule(tournamentId, selectedDivisionId, payload);
      setSuccess(res.message || "Xếp lịch sân đấu thành công!");
      loadMatches();
    } catch (err: any) {
      setError(err.message || "Xếp lịch sân thất bại.");
    } finally {
      setSchedulingLoading(false);
    }
  };

  const handleResetMatches = async () => {
    if (!selectedDivisionId) return;
    if (!confirm("BẠN CÓ CHẮC CHẮN MUỐN XÓA? Việc này sẽ xóa TOÀN BỘ lịch thi đấu, kết quả, và bảng xếp hạng của nội dung này!")) return;
    
    setError("");
    setSuccess("");
    try {
      await tournamentApi.deleteSchedule(tournamentId, selectedDivisionId);
      setSuccess("Đã xóa toàn bộ lịch thi đấu. Bạn có thể xếp lại từ đầu.");
      loadMatches();
      const stdRes = await tournamentApi.getStandings(tournamentId, selectedDivisionId);
      setStandings(stdRes);
    } catch (err: any) {
      setError(err.message || "Xóa lịch thi đấu thất bại.");
    }
  };

  const handleSetMatchReady = async (matchId: number) => {
    try {
      setError("");
      setSuccess("");
      await tournamentApi.setMatchReady(tournamentId, matchId);
      setSuccess("Đã chuyển trận đấu sang trạng thái Sẵn sàng (Ready)!");
      loadMatches();
    } catch (err: any) {
      setError(err.message || "Thao tác thất bại.");
    }
  };

  const handleStartMatch = async (matchId: number) => {
    try {
      setError("");
      setSuccess("");
      await tournamentApi.startMatch(tournamentId, matchId);
      setSuccess("Trận đấu chính thức bắt đầu (InProgress)!");
      loadMatches();
      loadData();
    } catch (err: any) {
      setError(err.message || "Thao tác thất bại.");
    }
  };
  const handleOpenScore = (match: any) => {
    setSelectedMatch(match);
    if (match.MatchStatus === "Completed") {
      setAdminOverride(true);
      if (match.ScoreJson) {
        try {
          const parsed = JSON.parse(match.ScoreJson);
          const formatted = parsed.map((s: any) => ({
            setNo: s.setNo || s.SetNo || 1,
            teamAScore: s.teamAScore ?? s.TeamAScore ?? 0,
            teamBScore: s.teamBScore ?? s.TeamBScore ?? 0
          }));
          while (formatted.length < 3) {
            formatted.push({ setNo: formatted.length + 1, teamAScore: 0, teamBScore: 0 });
          }
          setSetScores(formatted);
        } catch (e) {
          setSetScores([
            { setNo: 1, teamAScore: 0, teamBScore: 0 },
            { setNo: 2, teamAScore: 0, teamBScore: 0 },
            { setNo: 3, teamAScore: 0, teamBScore: 0 },
          ]);
        }
      } else {
        setSetScores([
          { setNo: 1, teamAScore: 0, teamBScore: 0 },
          { setNo: 2, teamAScore: 0, teamBScore: 0 },
          { setNo: 3, teamAScore: 0, teamBScore: 0 },
        ]);
      }
    } else {
      setAdminOverride(false);
      setSetScores([
        { setNo: 1, teamAScore: 0, teamBScore: 0 },
        { setNo: 2, teamAScore: 0, teamBScore: 0 },
        { setNo: 3, teamAScore: 0, teamBScore: 0 },
      ]);
    }
    setScoreModalOpen(true);
  };

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDivisionId || !selectedMatch) return;
    setError("");
    setSuccess("");
    try {
      const validSets = setScores.filter((s) => s.teamAScore > 0 || s.teamBScore > 0);
      if (validSets.length === 0) {
        throw new Error("Vui lòng nhập tỷ số cho ít nhất 1 set đấu.");
      }
      await tournamentApi.reportMatchScore(tournamentId, selectedMatch.MatchID, {
        sets: validSets,
        adminOverride: adminOverride,
      });
      setSuccess("Cập nhật tỷ số trận đấu thành công!");
      setScoreModalOpen(false);
      loadMatches();
      loadData();
    } catch (err: any) {
      setError(err.message || "Ghi nhận tỷ số thất bại.");
    }
  };
  if (loading) {
    return (
      <div className={styles.wrapper} style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Đang tải thông tin giải quản trị...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className={styles.wrapper} style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p className="text-red-400 text-lg">Không tìm thấy thông tin giải đấu.</p>
      </div>
    );
  }

  const selectedDiv = divisions.find((d) => d.DivisionID === selectedDivisionId);

  return (
    <div className={styles.wrapper}>
      {/* Top Header Bar matching Admin Layout */}
      <header className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumbs}>
            <span>Quản trị</span>
            <span className={styles.chevron}>&gt;</span>
            <span>Giải đấu</span>
            <span className={styles.chevron}>&gt;</span>
            <span className={styles.currentCrumb}>Điều hành giải đấu</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button onClick={() => window.location.href = "/admin/tournaments"} className={styles.btnBack}>
            ← Danh sách giải đấu
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={styles.contentArea}>
        <div className={styles.titleArea}>
          <h2 className={styles.greetTitle}>Điều hành: {tournament.TournamentName}</h2>
          <p className={styles.greetDesc}>
            Cấu hình nội dung thi đấu, chia bảng/nhánh, xếp lịch sân tự động và cập nhật tỉ số các trận đấu trực tiếp.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-sm text-center">
            {success}
          </div>
        )}

        <div className={styles.detailsLayout}>
          {/* Left panel: Division list */}
          <div className={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 className={styles.panelTitle} style={{ marginBottom: 0 }}>Nội dung thi đấu</h3>
              {!isStaff && (
                <button onClick={() => setDivModalOpen(true)} className={styles.btnPrimary} style={{ padding: "6px 12px", fontSize: "11px" }}>
                  ➕ Thêm
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {divisions.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "12px", textAlign: "center", padding: "20px 0" }}>Chưa có nội dung thi đấu nào.</p>
              ) : (
                divisions.map((div) => (
                  <button
                    key={div.DivisionID}
                    onClick={() => setSelectedDivisionId(div.DivisionID)}
                    className={`${styles.divButton} ${selectedDivisionId === div.DivisionID ? styles.divButtonActive : ""}`}
                  >
                    <span className={styles.divName}>{div.DivisionName}</span>
                    <span className={styles.divSub}>
                      {div.CompetitionFormat === "MixedDoubles" ? "Đôi Nam Nữ" : div.CompetitionFormat === "Doubles" ? "Đấu Đôi" : "Đấu Đơn"} | {div.BracketType === "SingleElimination" ? "Loại trực tiếp (SE)" : div.BracketType === "GroupKnockout" ? "Vòng bảng + Loại trực tiếp" : "Đấu vòng tròn (RR)"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Controls & Matches */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", flex: 1 }}>
            {selectedDivisionId && (
              <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "8px" }}>
                <button 
                  onClick={() => setActiveTab("operations")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: activeTab === "operations" ? "#2563eb" : "transparent",
                    color: activeTab === "operations" ? "#ffffff" : "#64748b",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "14px"
                  }}
                >
                  Điều hành & Trận đấu
                </button>
                <button 
                  onClick={() => setActiveTab("registrations")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: activeTab === "registrations" ? "#2563eb" : "transparent",
                    color: activeTab === "registrations" ? "#ffffff" : "#64748b",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "14px"
                  }}
                >
                  Duyệt & Check-in
                </button>
              </div>
            )}

            {selectedDivisionId && !isStaff && activeTab === "operations" && (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>🛠️ Điều hành & Tự động xếp sân</h3>

                <div className={styles.stepGrid}>
                  {/* Step 1: Generate Matches/Bracket */}
                  <div className={styles.stepCard}>
                    <h4 className={styles.stepTitle}>1. Sinh lịch / sơ đồ thi đấu</h4>
                    <p className={styles.stepDesc}>
                      Rút thăm bốc thăm và tạo lịch đấu dựa trên danh sách các vận động viên đã hoàn thành thanh toán.
                    </p>
                    <div style={{ display: "flex", gap: "10px", marginTop: "auto", paddingTop: "12px" }}>
                      {selectedDiv?.BracketType === "GroupKnockout" ? (
                        <>
                          {matches.length === 0 ? (
                            <button
                              onClick={() => {
                                const cnt = prompt("Vui lòng nhập số lượng bảng đấu (ví dụ: 2, 4, 8...):", "8");
                                if (cnt) {
                                  const num = parseInt(cnt, 10);
                                  if (!isNaN(num) && num >= 2) {
                                    handleGenerateGroups(num);
                                  } else {
                                    alert("Số lượng bảng đấu không hợp lệ.");
                                  }
                                }
                              }}
                              className={styles.btnAccent}
                              style={{ flex: 1, fontSize: "11px", padding: "8px" }}
                            >
                              Chia bảng đấu vòng tròn
                            </button>
                          ) : (
                            <>
                              {!matches.some(m => m.GroupName === "Knockout") ? (() => {
                                const groupStageNotFinished = matches.some(m => (m.MatchStage === "Group" || (m.GroupName !== "Knockout" && !m.KnockoutRound)) && ["Scheduled", "Ready", "InProgress"].includes(m.MatchStatus));
                                const isGroupCompleted = selectedDiv?.Status === "GroupCompleted";
                                const isBtnDisabled = !isGroupCompleted || groupStageNotFinished;

                                return (
                                  <button
                                    onClick={handleGenerateKnockout}
                                    disabled={isBtnDisabled}
                                    className={styles.btnAccent}
                                    style={{
                                      flex: 1,
                                      fontSize: "11px",
                                      padding: "8px",
                                      opacity: isBtnDisabled ? 0.6 : 1,
                                      cursor: isBtnDisabled ? "not-allowed" : "pointer"
                                    }}
                                    title={groupStageNotFinished ? "Vòng bảng chưa hoàn thành hết tất cả các trận đấu" : (!isGroupCompleted ? "Trạng thái nội dung chưa chuyển sang GroupCompleted" : "")}
                                  >
                                    Tạo nhánh Knockout ({groupStageNotFinished ? "Vòng bảng chưa xong" : "Sẵn sàng!"})
                                  </button>
                                );
                              })() : (
                                <div style={{ color: "#22c55e", fontSize: "11px", fontWeight: "bold", textAlign: "center", width: "100%", padding: "8px 0" }}>
                                  ✓ Đã hoàn tất chia bảng & dựng nhánh SE
                                </div>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleGenerateMatches("SingleElimination")} className={styles.btnAccent} style={{ flex: 1, fontSize: "11px", padding: "8px" }}>
                            Nhánh loại trực tiếp (SE)
                          </button>
                          <button onClick={() => handleGenerateMatches("RoundRobin")} className={styles.btnSecondary} style={{ flex: 1, fontSize: "11px", padding: "8px" }}>
                            Bảng vòng tròn (RR)
                          </button>
                        </>
                      )}
                    </div>
                    {matches.length > 0 && (
                      <div style={{ marginTop: "12px", textAlign: "right" }}>
                        <button 
                          onClick={handleResetMatches} 
                          style={{ fontSize: "11px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontWeight: "600" }}
                        >
                          Làm lại từ đầu (Xóa lịch hiện tại)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Auto Scheduling & Blocking */}
                  <form onSubmit={handleAllocateCourts} className={styles.stepCard}>
                    <h4 className={styles.stepTitle}>2. Tự động xếp sân & Khóa lịch đặt</h4>
                    
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>ID các sân tổ chức giải (cách nhau bằng dấu phẩy)</label>
                      <input
                        type="text"
                        required
                        className={styles.formInput}
                        value={courtInput}
                        onChange={(e) => setCourtInput(e.target.value)}
                      />
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      <div className={styles.formGroup} style={{ flex: "1 1 120px", minWidth: 0 }}>
                        <label className={styles.formLabel}>Thời gian bắt đầu lượt đầu tiên</label>
                        <input
                          type="datetime-local"
                          required
                          className={styles.formInput}
                          value={startTimeInput}
                          onChange={(e) => setStartTimeInput(e.target.value)}
                        />
                      </div>
                      <div className={styles.formGroup} style={{ flex: "1 1 120px", minWidth: 0 }}>
                        <label className={styles.formLabel}>Ngày kết thúc giải (Tùy chọn)</label>
                        <input
                          type="date"
                          className={styles.formInput}
                          value={endDateInput}
                          onChange={(e) => setEndDateInput(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      <div className={styles.formGroup} style={{ flex: "1 1 120px", minWidth: 0 }}>
                        <label className={styles.formLabel}>Thời lượng (phút)</label>
                        <input
                          type="number"
                          required
                          className={styles.formInput}
                          value={durationInput}
                          onChange={(e) => setDurationInput(Number(e.target.value))}
                        />
                      </div>
                      <div className={styles.formGroup} style={{ flex: "1 1 120px", minWidth: 0 }}>
                        <label className={styles.formLabel}>Nghỉ giữa ca (phút)</label>
                        <input
                          type="number"
                          required
                          className={styles.formInput}
                          value={breakInput}
                          onChange={(e) => setBreakInput(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" }}>
                      <div className={styles.formGroup} style={{ flex: "1 1 120px", minWidth: 0 }}>
                        <label className={styles.formLabel}>Khung giờ HĐ (Bắt đầu)</label>
                        <input
                          type="time"
                          required
                          className={styles.formInput}
                          value={dailyStartHour}
                          onChange={(e) => setDailyStartHour(e.target.value)}
                        />
                      </div>
                      <div className={styles.formGroup} style={{ flex: "1 1 120px", minWidth: 0 }}>
                        <label className={styles.formLabel}>Khung giờ HĐ (Kết thúc)</label>
                        <input
                          type="time"
                          required
                          className={styles.formInput}
                          value={dailyEndHour}
                          onChange={(e) => setDailyEndHour(e.target.value)}
                        />
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={schedulingLoading || selectedDiv?.Status === "Completed" || selectedDiv?.Status === "Cancelled"} 
                      className={styles.btnPrimary} 
                      style={{ width: "100%", marginTop: "8px" }}
                    >
                      {schedulingLoading ? "Đang sắp xếp..." : "Xếp sân & Tự động khóa sân"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Match list */}
            {selectedDivisionId && activeTab === "operations" && (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>🏆 Lịch thi đấu trực tiếp</h3>

                {matches.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "32px 0", margin: 0 }}>Chưa có trận đấu nào được khởi tạo.</p>
                ) : (() => {
                  const grouped: Record<string, any[]> = {};
                  matches.forEach(m => {
                    const g = m.GroupName || "Chưa phân bảng";
                    if (!grouped[g]) grouped[g] = [];
                    grouped[g].push(m);
                  });
                  const sortedGroups = Object.keys(grouped).sort((a, b) => {
                    if (a === "Knockout") return 1;
                    if (b === "Knockout") return -1;
                    return a.localeCompare(b);
                  });

                  // If selectedGroupName is not in sortedGroups, default to the first one
                  const activeGroup = sortedGroups.includes(selectedGroupName) ? selectedGroupName : sortedGroups[0];
                  
                  // Get matches for active group
                  const groupMatches = grouped[activeGroup] || [];
                  
                  // Get standings for active group
                  const groupStandings = standings.filter(s => s.GroupName === activeGroup).sort((a,b) => a.RankNo - b.RankNo);

                  // Group matches by RoundNo or KnockoutRound
                  const matchesByRound: Record<string, any[]> = {};
                  groupMatches.forEach(m => {
                    const r = m.KnockoutRound || m.RoundNo || 0;
                    if (!matchesByRound[r]) matchesByRound[r] = [];
                    matchesByRound[r].push(m);
                  });
                  const sortedRounds = Object.keys(matchesByRound).sort((a,b) => {
                    const rA = matchesByRound[a][0]?.RoundNo || 0;
                    const rB = matchesByRound[b][0]?.RoundNo || 0;
                    return rA - rB;
                  });
                  
                  // Ongoing match
                  const ongoingMatch = groupMatches.find(m => m.MatchStatus === "InProgress");

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                      {/* Group Tabs */}
                      <div style={{ display: "flex", gap: "10px", borderBottom: "2px solid #e2e8f0", paddingBottom: "0px", overflowX: "auto" }}>
                        {sortedGroups.map(g => (
                          <button
                            key={g}
                            onClick={() => setSelectedGroupName(g)}
                            style={{
                              padding: "12px 24px",
                              fontWeight: "bold",
                              fontSize: "14px",
                              color: activeGroup === g ? "#2563eb" : "#64748b",
                              borderBottom: activeGroup === g ? "3px solid #2563eb" : "3px solid transparent",
                              background: "none",
                              borderTop: "none",
                              borderLeft: "none",
                              borderRight: "none",
                              cursor: "pointer",
                              transition: "all 0.2s"
                            }}
                          >
                            {g === "Knockout" ? "Vòng loại trực tiếp" : g}
                          </button>
                        ))}
                      </div>

                      {/* Content Split View */}
                      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
                        {/* Left: Standings */}
                        {activeGroup !== "Knockout" && (
                          <div style={{ flex: "1 1 300px", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "14px" }}>BẢNG XẾP HẠNG</span>
                              <span style={{ fontSize: "10px", background: "#fef08a", color: "#854d0e", padding: "4px 8px", borderRadius: "12px", fontWeight: "600" }}>TOP 2 VÀO TRONG</span>
                            </div>
                            <div className={styles.tableWrapper} style={{ border: "none", borderRadius: 0, margin: 0 }}>
                              <table className={styles.table} style={{ margin: 0, fontSize: "12px" }}>
                                <thead>
                                  <tr>
                                    <th style={{ width: "30px", textAlign: "center", padding: "8px 4px" }}>#</th>
                                    <th style={{ padding: "8px" }}>ĐỘI</th>
                                    <th style={{ textAlign: "center", padding: "8px 4px" }}>P</th>
                                    <th style={{ textAlign: "center", padding: "8px 4px" }}>PD</th>
                                    <th style={{ textAlign: "center", padding: "8px 4px" }}>PTS</th>
                                    <th style={{ textAlign: "center", padding: "8px 4px" }}>T.THÁI</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {groupStandings.map((s, idx) => (
                                    <tr key={s.StandingID}>
                                      <td style={{ textAlign: "center", padding: "8px 4px" }}>
                                        <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: idx < 2 ? "#fef08a" : "#f1f5f9", color: idx < 2 ? "#854d0e" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", margin: "0 auto", fontSize: "11px" }}>
                                          {s.RankNo || idx + 1}
                                        </div>
                                      </td>
                                      <td style={{ fontWeight: "700", color: "#1e293b", padding: "8px" }}>{s.TeamName}</td>
                                      <td style={{ textAlign: "center", fontWeight: "600", padding: "8px 4px" }}>{s.Played}</td>
                                      <td style={{ textAlign: "center", fontWeight: "bold", color: s.PointDifference > 0 ? "#16a34a" : (s.PointDifference < 0 ? "#ef4444" : "#64748b"), padding: "8px 4px" }}>
                                        {s.PointDifference > 0 ? `+${s.PointDifference}` : s.PointDifference}
                                      </td>
                                      <td style={{ textAlign: "center", fontWeight: "bold", color: "#2563eb", fontSize: "13px", padding: "8px 4px" }}>{s.Won}</td>
                                      <td style={{ textAlign: "center", padding: "8px 4px" }}>
                                        {idx < 2 ? (
                                          <span style={{ background: "#22c55e", color: "white", padding: "2px 6px", borderRadius: "12px", fontSize: "10px", fontWeight: "bold" }}>VÀO</span>
                                        ) : (
                                          <span style={{ color: "#94a3b8", fontSize: "10px", fontWeight: "600" }}>CHỜ</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {groupStandings.length === 0 && (
                                    <tr>
                                      <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: "16px" }}>Chưa có dữ liệu bảng xếp hạng</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Right: Matches */}
                        <div style={{ flex: "1.5 1 450px", display: "flex", flexDirection: "column", gap: "16px" }}>
                          
                          {/* Ongoing Match */}
                          {ongoingMatch && (
                            <div style={{ border: "2px solid #3b82f6", borderRadius: "16px", padding: "16px", background: "#ffffff", boxShadow: "0 10px 15px -3px rgba(59, 130, 246, 0.1)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", animation: "pulse 2s infinite" }} />
                                <div style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b", letterSpacing: "0.5px" }}>TRẬN ĐANG DIỄN RA</div>
                              </div>
                              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                                <div style={{ textAlign: "center", flex: 1 }}>
                                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "bold", margin: "0 auto 8px" }}>
                                    {ongoingMatch.TeamAName?.substring(0, 2).toUpperCase() || "T1"}
                                  </div>
                                  <div style={{ fontWeight: "800", fontSize: "15px", color: "#0f172a" }}>{ongoingMatch.TeamAName}</div>
                                </div>
                                
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "0 16px" }}>
                                  <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                                    <div style={{ fontSize: "36px", fontWeight: "900", color: "#2563eb" }}>{ongoingMatch.TeamASetWon ?? 0}</div>
                                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#94a3b8" }}>:</div>
                                    <div style={{ fontSize: "36px", fontWeight: "900", color: "#0f172a" }}>{ongoingMatch.TeamBSetWon ?? 0}</div>
                                  </div>
                                  <div style={{ background: "#f1f5f9", padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600", color: "#64748b", marginTop: "6px" }}>
                                    #{ongoingMatch.MatchID} • {ongoingMatch.CourtName}
                                  </div>
                                </div>

                                <div style={{ textAlign: "center", flex: 1 }}>
                                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#f8fafc", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "bold", margin: "0 auto 8px" }}>
                                    {ongoingMatch.TeamBName?.substring(0, 2).toUpperCase() || "T2"}
                                  </div>
                                  <div style={{ fontWeight: "800", fontSize: "15px", color: "#0f172a" }}>{ongoingMatch.TeamBName}</div>
                                </div>
                              </div>
                              <div style={{ textAlign: "center", marginTop: "16px" }}>
                                <button onClick={() => handleOpenScore(ongoingMatch)} className={styles.btnPrimary} style={{ padding: "8px 20px", fontSize: "13px", borderRadius: "8px", fontWeight: "bold", boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)" }}>
                                  Cập nhật điểm
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Matches by Round */}
                          <div style={{ fontWeight: "800", color: "#94a3b8", letterSpacing: "1px", fontSize: "13px", marginTop: "8px" }}>
                            LỊCH THI ĐẤU THEO VÒNG
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            {sortedRounds.map(r => (
                              <div key={r}>
                                <div style={{ fontWeight: "800", color: "#1e293b", marginBottom: "12px", fontSize: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
                                  <span style={{ textTransform: "uppercase" }}>{isNaN(Number(r)) ? r : `VÒNG ${r}`}</span>
                                  <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                  {matchesByRound[r].map(m => (
                                    <div key={m.MatchID} style={{ display: "flex", alignItems: "center", padding: "12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", transition: "all 0.2s", cursor: "default" }}>
                                      
                                      <div style={{ flex: "0 0 90px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <div style={{ fontWeight: "800", color: "#2563eb", fontSize: "13px" }}>#{m.MatchID}</div>
                                        <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "600" }}>{m.CourtName || "Sân ?"}</div>
                                        <div style={{ color: "#94a3b8", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                                          ⏱ {m.ScheduledStart ? `${new Date(m.ScheduledStart).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - ${new Date(m.ScheduledStart).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}` : "Chưa xếp"}
                                        </div>
                                      </div>

                                      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
                                        <div style={{ fontWeight: "700", textAlign: "right", flex: 1, paddingRight: "12px", color: "#1e293b", fontSize: "13px" }}>
                                          {m.TeamAName || "Đợi đối thủ"}
                                        </div>
                                        
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "6px 12px", borderRadius: "8px", minWidth: "60px" }}>
                                          {m.MatchStatus === "Completed" ? (
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "900", fontSize: "15px", color: "#2563eb" }}>
                                                <span>{m.TeamASetWon ?? 0}</span>
                                                <span style={{ color: "#cbd5e1" }}>-</span>
                                                <span style={{ color: "#0f172a" }}>{m.TeamBSetWon ?? 0}</span>
                                              </div>
                                              {isAdmin && (
                                                <button
                                                  onClick={() => handleOpenScore(m)}
                                                  className={styles.btnSecondary}
                                                  style={{ padding: "2px 6px", fontSize: "10px", borderRadius: "4px", fontWeight: "600", marginTop: "2px" }}
                                                >
                                                  ✏️ Sửa điểm
                                                </button>
                                              )}
                                            </div>
                                          ) : (
                                            <span style={{ fontWeight: "700", color: "#94a3b8", fontSize: "12px" }}>
                                              {m.TeamAID && m.TeamBID && (
                                                <>
                                                  {m.MatchStatus === "Scheduled" && (
                                                    <button onClick={() => handleSetMatchReady(m.MatchID)} className={styles.btnSecondary} style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "6px", fontWeight: "600" }}>
                                                      Sẵn sàng
                                                    </button>
                                                  )}
                                                  {m.MatchStatus === "Ready" && (
                                                    <>
                                                      <button onClick={() => handleStartMatch(m.MatchID)} className={styles.btnAccent} style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "6px", fontWeight: "600" }}>
                                                        Bắt đầu
                                                      </button>
                                                      <button onClick={() => handleOpenScore(m)} className={styles.btnPrimary} style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "6px", fontWeight: "600" }}>
                                                        Nhập điểm
                                                      </button>
                                                    </>
                                                  )}
                                                  {m.MatchStatus === "InProgress" && (
                                                    <button onClick={() => handleOpenScore(m)} className={styles.btnPrimary} style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "6px", fontWeight: "600", background: "#ef4444", color: "#fff" }}>
                                                      Nhập điểm
                                                    </button>
                                                  )}
                                                </>
                                              )}
                                            </span>
                                          )}
                                        </div>

                                        <div style={{ fontWeight: "700", textAlign: "left", flex: 1, paddingLeft: "12px", color: "#1e293b", fontSize: "13px" }}>
                                          {m.TeamBName || "Đợi đối thủ"}
                                        </div>
                                      </div>

                                      <div style={{ flex: "0 0 110px", textAlign: "right", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                                        {m.MatchStatus === "ByeCompleted" || m.ScoreText === "BYE" ? (
                                          <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "800", background: "#f1f5f9", padding: "4px 8px", borderRadius: "6px" }}>Miễn thi đấu (BYE)</span>
                                        ) : m.MatchStatus === "Completed" ? (
                                          <span style={{ fontSize: "10px", color: "#10b981", fontWeight: "800", background: "#d1fae5", padding: "4px 8px", borderRadius: "6px" }}>KẾT THÚC</span>
                                        ) : (
                                          <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "600", background: "#f1f5f9", padding: "4px 8px", borderRadius: "6px" }}>{m.MatchStatus}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Registrations list */}
            {selectedDivisionId && activeTab === "registrations" && (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle} style={{ marginBottom: "20px" }}>Danh sách đội đăng ký & Xác minh Profile DUPR</h3>
                
                {registrationsLoading ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <p style={{ color: "#64748b" }}>Đang tải danh sách đăng ký...</p>
                  </div>
                ) : registrations.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <p style={{ color: "#64748b" }}>Chưa có đội đăng ký nào được ghi nhận cho nội dung này.</p>
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Đội</th>
                          <th>Mã Đội</th>
                          <th>Thành viên & Điểm DUPR</th>
                          <th>Profile DUPR</th>
                          <th>Thanh toán</th>
                          <th>Duyệt DUPR</th>
                          <th>Điểm danh</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrations.map((reg) => {
                          const isEligible = reg.registrationStatus === "Confirmed" && reg.paymentStatus === "Paid" && !reg.refundStatus;
                          return (
                            <tr key={reg.registrationId}>
                              <td style={{ fontWeight: "700", color: "#0f172a" }}>{reg.teamName}</td>
                              <td style={{ color: "#64748b", fontSize: "12px" }}>{reg.teamCode}</td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {reg.athletes.map((ath: any) => (
                                    <div key={ath.athleteId} style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                                      <span style={{ fontWeight: "600", fontSize: "13px" }}>
                                        {ath.fullName} ({ath.gender === "Male" ? "Nam" : "Nữ"})
                                      </span>
                                      <span style={{ color: "#64748b", fontSize: "11px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                                        <span>SĐT: {ath.phoneNumber}</span>
                                        <span>|</span>
                                        <span>DUPR: {ath.rating}</span>
                                        <a
                                          href={`https://mydupr.com/dashboard/browse?search=${encodeURIComponent(ath.fullName)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            color: "#16a34a",
                                            textDecoration: "underline",
                                            fontWeight: "bold",
                                            marginLeft: "4px"
                                          }}
                                          title="Tra cứu điểm trình trên DUPR"
                                        >
                                          🔍 DUPR
                                        </a>
                                        <a
                                          href={`https://www.google.com/search?q=${encodeURIComponent(ath.fullName + " dupr pickleball")}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            color: "#0284c7",
                                            textDecoration: "underline",
                                            fontWeight: "bold"
                                          }}
                                          title="Tìm kiếm trên Google"
                                        >
                                          Google
                                        </a>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {reg.athletes.map((ath: any) => (
                                    <div key={ath.athleteId} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                      {ath.cccdUrl ? (
                                        <a
                                          href={ath.cccdUrl.startsWith("http") ? ath.cccdUrl : `https://mydupr.com/dashboard/browse?search=${encodeURIComponent(ath.cccdUrl)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            padding: "4px 8px",
                                            fontSize: "11px",
                                            backgroundColor: "#f0fdf4",
                                            border: "1px solid #bbf7d0",
                                            borderRadius: "4px",
                                            color: "#166534",
                                            textDecoration: "none",
                                            fontWeight: "600",
                                            display: "inline-block"
                                          }}
                                        >
                                          Mở Profile DUPR 🔗
                                        </a>
                                      ) : (
                                        <span style={{ color: "#94a3b8", fontSize: "11px" }}>Chưa cung cấp</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <span className={`${styles.badge} ${
                                  reg.paymentStatus === 'Paid' ? styles.badgeCompleted : styles.badgePending
                                }`}>
                                  {reg.paymentStatus === 'Paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                </span>
                              </td>
                              <td>
                                <button
                                  disabled={!isEligible}
                                  onClick={() => handleRegistrationAction(reg.registrationId, "verify", reg.cccdVerified)}
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: reg.cccdVerified ? "#10b981" : "#cbd5e1",
                                    color: "#ffffff",
                                    cursor: isEligible ? "pointer" : "not-allowed",
                                    opacity: isEligible ? 1 : 0.6
                                  }}
                                  title={!isEligible ? "Cần hoàn tất thanh toán trước khi duyệt hồ sơ" : ""}
                                >
                                  {reg.cccdVerified ? "Đã duyệt" : "Chờ duyệt"}
                                </button>
                              </td>
                              <td>
                                <button
                                  disabled={!isEligible}
                                  onClick={() => handleRegistrationAction(reg.registrationId, "checkin", reg.isCheckedIn)}
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: reg.isCheckedIn ? "#3b82f6" : "#cbd5e1",
                                    color: "#ffffff",
                                    cursor: isEligible ? "pointer" : "not-allowed",
                                    opacity: isEligible ? 1 : 0.6
                                  }}
                                  title={!isEligible ? "Cần hoàn tất thanh toán trước khi check-in" : ""}
                                >
                                  {reg.isCheckedIn ? "Đã Check-in" : "Chưa điểm danh"}
                                </button>
                              </td>
                              <td>
                                {reg.refundStatus ? (
                                  <span style={{
                                    fontSize: "11px",
                                    fontWeight: "bold",
                                    color: "#d97706",
                                    backgroundColor: "#fef3c7",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    border: "1px solid #fcd34d",
                                    whiteSpace: "nowrap",
                                    display: "inline-block"
                                  }} title={`Yêu cầu hoàn tiền đang chờ Admin xử lý. Mã: ${reg.refundCode}`}>
                                    Chờ hoàn tiền
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleRejectRegistration(reg.registrationId, reg.teamName)}
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      borderRadius: "6px",
                                      border: "1px solid #ef4444",
                                      backgroundColor: "transparent",
                                      color: "#ef4444",
                                      cursor: "pointer",
                                      transition: "all 0.2s"
                                    }}
                                    onMouseOver={(e) => {
                                      (e.currentTarget as any).style.backgroundColor = "#ef4444";
                                      (e.currentTarget as any).style.color = "#ffffff";
                                    }}
                                    onMouseOut={(e) => {
                                      (e.currentTarget as any).style.backgroundColor = "transparent";
                                      (e.currentTarget as any).style.color = "#ef4444";
                                    }}
                                  >
                                    Từ chối
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Division Modal */}
      {divModalOpen && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleCreateDivision} className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Thêm nội dung thi đấu mới</h3>
              <button type="button" className={styles.modalClose} onClick={() => setDivModalOpen(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tên nội dung thi đấu</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đôi Nam Nữ 4.5"
                  className={styles.formInput}
                  value={divFormData.divisionName}
                  onChange={(e) => setDivFormData({ ...divFormData, divisionName: e.target.value })}
                />
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Hình thức</label>
                  <select
                    className={styles.formSelect}
                    value={divFormData.competitionFormat}
                    onChange={(e) => setDivFormData({ ...divFormData, competitionFormat: e.target.value })}
                  >
                    <option value="MenSingles">Đơn Nam (Men's Singles)</option>
                    <option value="WomenSingles">Đơn Nữ (Women's Singles)</option>
                    <option value="MenDoubles">Đôi Nam (Men's Doubles)</option>
                    <option value="WomenDoubles">Đôi Nữ (Women's Doubles)</option>
                    <option value="MixedDoubles">Đôi Nam Nữ (Mixed Doubles)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Thể thức</label>
                  <select
                    className={styles.formSelect}
                    value={divFormData.bracketType}
                    onChange={(e) => setDivFormData({ ...divFormData, bracketType: e.target.value })}
                  >
                    <option value="SingleElimination">Loại trực tiếp (SE)</option>
                    <option value="RoundRobin">Đấu vòng tròn (RR)</option>
                    <option value="GroupKnockout">Vòng bảng + Loại trực tiếp</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Giới tính</label>
                  <select
                    className={styles.formSelect}
                    value={divFormData.genderRequirement}
                    onChange={(e) => setDivFormData({ ...divFormData, genderRequirement: e.target.value })}
                  >
                    <option value="Mixed">Không giới hạn (Mixed)</option>
                    <option value="MaleOnly">Nam (Male Only)</option>
                    <option value="FemaleOnly">Nữ (Female Only)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nhóm tuổi</label>
                  <select
                    className={styles.formSelect}
                    value={divFormData.ageGroup}
                    onChange={(e) => setDivFormData({ ...divFormData, ageGroup: e.target.value })}
                  >
                    <option value="Open">Vô địch (Open)</option>
                    <option value="Youth">Trẻ (Youth &lt;18)</option>
                    <option value="Senior50">Trung niên 50+</option>
                    <option value="Senior60">Lão tướng 60+</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Min DUPR</label>
                  <input
                    type="number"
                    step="0.1"
                    className={styles.formInput}
                    value={divFormData.minDUPR}
                    onChange={(e) => setDivFormData({ ...divFormData, minDUPR: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Max DUPR</label>
                  <input
                    type="number"
                    step="0.1"
                    className={styles.formInput}
                    value={divFormData.maxDUPR}
                    onChange={(e) => setDivFormData({ ...divFormData, maxDUPR: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Lệ phí (VNĐ)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={divFormData.registrationFee}
                    onChange={(e) => setDivFormData({ ...divFormData, registrationFee: Number(e.target.value) })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Số đội tối đa</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={divFormData.maxTeams}
                    onChange={(e) => setDivFormData({ ...divFormData, maxTeams: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setDivModalOpen(false)} className={styles.btnCancelModal}>
                Hủy
              </button>
              <button type="submit" className={styles.btnSaveModal}>
                Thêm nội dung
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Score Reporting Modal */}
      {scoreModalOpen && selectedMatch && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleSubmitScore} className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Cập nhật tỉ số trận #{selectedMatch.MatchID}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setScoreModalOpen(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", textAlign: "center", fontSize: "12px", fontWeight: "bold", color: "#64748b", marginBottom: "8px" }}>
                <span>Set thi đấu</span>
                <span>Team A</span>
                <span>Team B</span>
              </div>

              {setScores.map((score, idx) => (
                <div key={score.setNo} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#475569" }}>Set {score.setNo}</span>
                  <input
                    type="number"
                    min="0"
                    className={styles.formInput}
                    style={{ textAlign: "center", fontWeight: "bold" }}
                    value={score.teamAScore}
                    onChange={(e) => {
                      const updated = [...setScores];
                      updated[idx].teamAScore = Number(e.target.value);
                      setSetScores(updated);
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    className={styles.formInput}
                    style={{ textAlign: "center", fontWeight: "bold" }}
                    value={score.teamBScore}
                    onChange={(e) => {
                      const updated = [...setScores];
                      updated[idx].teamBScore = Number(e.target.value);
                      setSetScores(updated);
                    }}
                  />
                </div>
              ))}
            </div>

            {error && (
              <div style={{ color: "#ef4444", fontSize: "12.5px", padding: "10px 20px", fontWeight: "bold", background: "#fef2f2", margin: "10px 20px", borderRadius: "8px", border: "1px solid #fca5a5" }}>
                ❌ {error}
              </div>
            )}

            {(selectedMatch.MatchStatus === "Completed" || selectedDiv?.Status === "Completed") && (
              <>
                <div style={{ padding: "0 20px 10px 20px", display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start" }}>
                  <input 
                    type="checkbox" 
                    id="adminOverride" 
                    checked={adminOverride} 
                    onChange={(e) => setAdminOverride(e.target.checked)} 
                  />
                  <label htmlFor="adminOverride" style={{ fontSize: "12.5px", color: "#ef4444", fontWeight: "bold", cursor: "pointer" }}>
                    ⚠️ Xác nhận ghi đè kết quả của Admin (Override)
                  </label>
                </div>
                {adminOverride && (
                  <>
                    <div style={{ margin: "0 20px 10px 20px", padding: "12px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "8px", color: "#92400e", fontSize: "12px", fontWeight: "600", lineHeight: "1.5" }}>
                      ⚠️ Cảnh báo: Bạn đang thực hiện ghi đè kết quả của trận đấu đã hoàn thành. Hành động này sẽ được ghi nhận vào hệ thống.
                    </div>
                    <div className={styles.formGroup} style={{ margin: "0 20px 10px 20px" }}>
                      <label className={styles.formLabel} style={{ fontSize: "11px", fontWeight: "700" }}>Lý do ghi đè kết quả *</label>
                      <input 
                        type="text" 
                        placeholder="Nhập lý do thay đổi kết quả (ví dụ: Trọng tài nhập sai)..."
                        className={styles.formInput} 
                        required
                        value={(selectedMatch as any).actionReason || ""}
                        onChange={(e) => {
                          const updated = { ...selectedMatch, actionReason: e.target.value };
                          setSelectedMatch(updated);
                        }}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setScoreModalOpen(false)} className={styles.btnCancelModal}>
                Hủy
              </button>
              <button 
                type="submit" 
                className={styles.btnSaveModal}
                disabled={((selectedMatch.MatchStatus === "Completed" || selectedDiv?.Status === "Completed") && !adminOverride)}
              >
                Lưu kết quả
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
