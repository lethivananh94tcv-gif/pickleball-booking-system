"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { tournamentApi, Tournament, TournamentDivision } from "@/services/tournamentApi";
import { getUser } from "@/utils/authStorage";
import { getCourts } from "@/services/courtApi";
import type { Court } from "@/types/court";
import styles from "./AdminTournamentManagePage.module.css";

const getNowLocalString = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

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
  const [zoom, setZoom] = useState<number>(1.0);
  const [adminTrackedTeamId, setAdminTrackedTeamId] = useState<number | null>(null);
  const [searchTeamQuery, setSearchTeamQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [activeMobileRoundIdx, setActiveMobileRoundIdx] = useState<number>(0);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState<string>("Bảng A");

  // Thuật toán tìm lộ trình nhánh đấu (Knockout Path) cho Admin
  const trackedMatchIds = useMemo(() => {
    const ids = new Set<number>();
    if (!adminTrackedTeamId) return ids;

    // Tìm tất cả các trận đấu có sự tham gia của đội này
    const teamMatches = matches.filter(m => 
      (m.GroupName === "Knockout" || m.KnockoutRound) && 
      (m.TeamAID === adminTrackedTeamId || m.TeamBID === adminTrackedTeamId)
    );

    teamMatches.forEach(tm => {
      ids.add(tm.MatchID);
      // Lân tìm các trận tiếp theo (NextMatchID)
      let nextId = tm.NextMatchID;
      while (nextId) {
        ids.add(nextId);
        const nextMatch = matches.find(m => m.MatchID === nextId);
        nextId = nextMatch?.NextMatchID;
      }
    });

    return ids;
  }, [adminTrackedTeamId, matches]);

  // Vẽ các đường nối SVG
  const updateConnectorLines = useCallback(() => {
    const canvas = document.querySelector(`.${styles.bracketTreeContainer}`) || document.querySelector(".bracket-tree-container");
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const newConnections: any[] = [];
    const knockoutMatches = matches.filter(m => m.GroupName === "Knockout" || m.KnockoutRound);
    const targetMatches = knockoutMatches.length > 0 ? knockoutMatches : [];

    targetMatches.forEach((m: any) => {
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

          const isHighlighted = adminTrackedTeamId && trackedMatchIds.has(m.MatchID) && trackedMatchIds.has(m.NextMatchID);
          const isWinnerKnown = m.MatchStatus === "Completed" || m.MatchStatus === "ByeCompleted";

          newConnections.push({
            id: `conn-${m.MatchID}-${m.NextMatchID}`,
            path,
            isHighlighted,
            isWinnerKnown
          });
        }
      }
    });
    setConnections(newConnections);
  }, [matches, adminTrackedTeamId, trackedMatchIds, zoom, selectedGroupName]);

  useEffect(() => {
    updateConnectorLines();
    const timer = setTimeout(() => {
      updateConnectorLines();
    }, 200);

    window.addEventListener("resize", updateConnectorLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateConnectorLines);
    };
  }, [updateConnectorLines, matches, selectedGroupName]);

  const handleScroll = (e: any) => {
    const container = e.target;
    const scrollLeft = container.scrollLeft;
    const width = container.offsetWidth;
    const colWidth = 290 + 72; // 290px + 72px gap
    const index = Math.round(scrollLeft / colWidth);
    
    const knockoutMatches = matches.filter(m => m.GroupName === "Knockout" || m.KnockoutRound);
    const targetMatches = knockoutMatches.length > 0 ? knockoutMatches : [];
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

    if (index >= 0 && index < sortedRounds.length) {
      setActiveMobileRoundIdx(index);
    }
  };

  // Auth & tab states
  const [isStaff, setIsStaff] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"operations" | "registrations" | "certificates">("operations");

  const [registrations, setRegistrations] = useState<any[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  // Certificate Management states
  const [sendingCertMap, setSendingCertMap] = useState<Record<number, boolean>>({});
  const [certOverrides, setCertOverrides] = useState<Record<number, string>>({});
  const [previewReg, setPreviewReg] = useState<any | null>(null);
  const [showAdminCertModal, setShowAdminCertModal] = useState(false);
  const [adminCertRankOverride, setAdminCertRankOverride] = useState<string>("auto");

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

  const [divRoundScheduleConfig, setDivRoundScheduleConfig] = useState<Array<{ roundName: string; roundNo: number; scheduledStart: string; courtId: number }>>([]);

  const getRoundsForConfig = (bracketType: string, maxTeams: number) => {
    if (bracketType === "SingleElimination") {
      const P = Math.pow(2, Math.ceil(Math.log2(maxTeams || 2)));
      const R = Math.log2(P);
      const rounds = [];
      for (let roundNo = 1; roundNo <= R; roundNo++) {
        let roundName = `Vòng ${roundNo}`;
        if (roundNo === R) roundName = "Chung kết";
        else if (roundNo === R - 1) roundName = "Bán kết";
        else if (roundNo === R - 2) roundName = "Tứ kết";
        else if (roundNo === R - 3) roundName = "Vòng 1/8";
        else if (roundNo === R - 4) roundName = "Vòng 1/16";
        rounds.push({ roundNo, roundName, scheduledStart: "", courtId: 0 });
      }
      return rounds;
    } else if (bracketType === "RoundRobin") {
      const R = maxTeams % 2 === 0 ? Math.max(1, maxTeams - 1) : maxTeams;
      const rounds = [];
      for (let roundNo = 1; roundNo <= R; roundNo++) {
        rounds.push({ roundNo, roundName: `Vòng ${roundNo}`, scheduledStart: "", courtId: 0 });
      }
      return rounds;
    } else {
      return [
        { roundNo: 1, roundName: "Vòng bảng 1", scheduledStart: "", courtId: 0 },
        { roundNo: 2, roundName: "Vòng bảng 2", scheduledStart: "", courtId: 0 },
        { roundNo: 3, roundName: "Vòng bảng 3", scheduledStart: "", courtId: 0 },
        { roundNo: 4, roundName: "Tứ kết", scheduledStart: "", courtId: 0 },
        { roundNo: 5, roundName: "Bán kết", scheduledStart: "", courtId: 0 },
        { roundNo: 6, roundName: "Chung kết", scheduledStart: "", courtId: 0 },
      ];
    }
  };

  useEffect(() => {
    if (divModalOpen) {
      setDivRoundScheduleConfig(getRoundsForConfig(divFormData.bracketType, Number(divFormData.maxTeams)));
    }
  }, [divFormData.bracketType, divFormData.maxTeams, divModalOpen]);

  // Court allocation form state
  const [courtInput, setCourtInput] = useState("1, 2");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [durationInput, setDurationInput] = useState(60);
  const [breakInput, setBreakInput] = useState(10);
  const [dailyStartHour, setDailyStartHour] = useState("07:00");
  const [dailyEndHour, setDailyEndHour] = useState("22:00");
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [selectedRoundFilterForScheduling, setSelectedRoundFilterForScheduling] = useState<number>(0);

  // Score reporting modal state
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [setScores, setSetScores] = useState([
    { setNo: 1, teamAScore: 0, teamBScore: 0 },
    { setNo: 2, teamAScore: 0, teamBScore: 0 },
    { setNo: 3, teamAScore: 0, teamBScore: 0 },
  ]);
  const [adminOverride, setAdminOverride] = useState(false);

  // Court lists & milestone states
  const [allCourts, setAllCourts] = useState<Court[]>([]);
  const [showMilestonesModal, setShowMilestonesModal] = useState(false);
  const [milestoneTimes, setMilestoneTimes] = useState<string[]>([]);
  const [milestoneCourts, setMilestoneCourts] = useState<number[]>([]);

  // Group count modal state
  const [showGroupCountModal, setShowGroupCountModal] = useState(false);
  const [groupCountInput, setGroupCountInput] = useState("8");

  useEffect(() => {
    getCourts()
      .then((res) => setAllCourts(res))
      .catch((err) => console.error("Error fetching system courts list", err));
  }, []);

  const roundsList = useMemo(() => {
    const knockoutMatches = matches.filter(m => m.GroupName === "Knockout" || m.KnockoutRound);
    const targetMatches = knockoutMatches.length > 0 ? knockoutMatches : matches;
    
    const uniqueRounds: Record<string, { roundNo: number; roundName: string; scheduledStart: string; courtId: number }> = {};
    targetMatches.forEach(m => {
      const key = `${m.RoundNo}-${m.KnockoutRound || `Vòng ${m.RoundNo}`}`;
      if (!uniqueRounds[key]) {
        uniqueRounds[key] = {
          roundNo: m.RoundNo,
          roundName: m.KnockoutRound || `Vòng ${m.RoundNo}`,
          scheduledStart: m.ScheduledStart ? new Date(new Date(m.ScheduledStart).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
          courtId: m.CourtID || 0
        };
      }
    });
    return Object.values(uniqueRounds).sort((a, b) => a.roundNo - b.roundNo);
  }, [matches]);

  useEffect(() => {
    if (roundsList.length > 0 && milestoneTimes.length === 0) {
      setMilestoneTimes(roundsList.map(r => r.scheduledStart));
      setMilestoneCourts(roundsList.map(r => r.courtId || 0));
    }
  }, [roundsList, milestoneTimes]);

  const handleSaveMilestones = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDivisionId) return;
    try {
      setError("");
      setSuccess("");
      const payload = roundsList.map((r, index) => {
        const val = milestoneTimes[index] || r.scheduledStart;
        if (!val) {
          throw new Error(`Vui lòng chọn thời gian cho ${r.roundName}`);
        }
        return {
          roundNo: r.roundNo,
          roundName: r.roundName,
          scheduledStart: new Date(val).toISOString(),
          courtId: milestoneCourts[index] || undefined
        };
      });

      await tournamentApi.updateRoundMilestones(tournamentId, selectedDivisionId, payload);
      setSuccess("Cập nhật thời gian thi đấu và phân bổ sân cho các vòng thành công!");
      setShowMilestonesModal(false);
      loadMatches();
    } catch (err: any) {
      setError(err.message || "Không thể cập nhật cột mốc thời gian và sân đấu.");
    }
  };

  const loadData = (isInitial = false) => {
    if (isNaN(tournamentId)) return;
    if (isInitial) {
      setLoading(true);
    }
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
      .finally(() => {
        if (isInitial) {
          setLoading(false);
        }
      });
  };
  useEffect(() => {
    loadData(true);
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

  const handleSendCertificate = async (registrationId: number, override: string) => {
    try {
      setSendingCertMap(prev => ({ ...prev, [registrationId]: true }));
      setError("");
      setSuccess("");
      await tournamentApi.sendCertificateEmail(registrationId, override);
      setSuccess("Đã gửi email chứng nhận giải đấu cho đội thành công!");
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || "Gửi email chứng nhận thất bại.");
    } finally {
      setSendingCertMap(prev => ({ ...prev, [registrationId]: false }));
    }
  };

  const handlePdfUpload = async (file: File, registrationId: number) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      setError("");
      setSuccess("");
      setSendingCertMap(prev => ({ ...prev, [registrationId]: true }));

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const uploadUrl = baseUrl.endsWith("/api") ? `${baseUrl}/tournaments/upload` : `${baseUrl}/api/tournaments/upload`;
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("pickleclub_token")}`
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Tải lên thất bại");
      }

      const uploadRes = await res.json();
      const pdfUrl = uploadRes.data.url;

      await tournamentApi.updateCertificatePdfUrl(registrationId, pdfUrl);
      setSuccess("Tải lên file đính kèm chứng nhận thành công!");
      loadRegistrations();
    } catch (err: any) {
      setError("Lỗi tải lên file: " + err.message);
    } finally {
      setSendingCertMap(prev => ({ ...prev, [registrationId]: false }));
    }
  };

  const handleClearPdfUrl = async (registrationId: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa file đính kèm chứng nhận này?")) return;
    try {
      setError("");
      setSuccess("");
      await tournamentApi.updateCertificatePdfUrl(registrationId, null);
      setSuccess("Đã xóa file đính kèm chứng nhận.");
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || "Xóa thất bại.");
    }
  };

  const handleSavePdfUrlManual = async (registrationId: number, url: string) => {
    try {
      setError("");
      setSuccess("");
      await tournamentApi.updateCertificatePdfUrl(registrationId, url.trim() || null);
      setSuccess("Cập nhật đường dẫn chứng nhận thành công!");
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || "Lưu thất bại.");
    }
  };

  useEffect(() => {
    if (selectedDivisionId) {
      loadMatches();
      loadRegistrations();
    }
  }, [selectedDivisionId, activeTab]);

  const handleCreateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const validRounds = divRoundScheduleConfig
        .filter(r => r.scheduledStart)
        .map(r => ({
          roundNo: r.roundNo,
          roundName: r.roundName,
          scheduledStart: new Date(r.scheduledStart).toISOString(),
          courtId: r.courtId || undefined
        }));

      const payload: any = {
        ...divFormData,
        registrationFee: Number(divFormData.registrationFee),
        maxTeams: Number(divFormData.maxTeams),
        minDUPR: divFormData.minDUPR ? Number(divFormData.minDUPR) : null,
        maxDUPR: divFormData.maxDUPR ? Number(divFormData.maxDUPR) : null,
        minAge: divFormData.minAge ? Number(divFormData.minAge) : null,
        maxAge: divFormData.maxAge ? Number(divFormData.maxAge) : null,
      };

      if (validRounds.length > 0) {
        payload.roundScheduleConfig = JSON.stringify(validRounds);
      }

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

  const promptRoundMilestones = async () => {
    if (!selectedDivisionId) return;
    try {
      const freshMatches = await tournamentApi.getMatches(tournamentId, selectedDivisionId);
      setMatches(freshMatches);
      
      const uniqueRounds: Record<string, { roundNo: number; roundName: string; scheduledStart: string; courtId: number }> = {};
      freshMatches.forEach(m => {
        const key = `${m.RoundNo}-${m.KnockoutRound || `Vòng ${m.RoundNo}`}`;
        if (!uniqueRounds[key]) {
          uniqueRounds[key] = {
            roundNo: m.RoundNo,
            roundName: m.KnockoutRound || `Vòng ${m.RoundNo}`,
            scheduledStart: m.ScheduledStart ? new Date(new Date(m.ScheduledStart).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
            courtId: m.CourtID || 0
          };
        }
      });
      const sorted = Object.values(uniqueRounds).sort((a, b) => a.roundNo - b.roundNo);
      setMilestoneTimes(sorted.map(r => r.scheduledStart));
      setMilestoneCourts(sorted.map(r => r.courtId || 0));
      setShowMilestonesModal(true);
    } catch (err) {
      console.error("Error loading fresh matches for milestones popup", err);
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
      await loadMatches();
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
      await loadMatches();
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
      await loadMatches();
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
      if (selectedRoundFilterForScheduling > 0) {
        payload.roundNo = selectedRoundFilterForScheduling;
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
          <div className={styles.adminBadge}>
            <span style={{ marginRight: "4px" }}>⚙️</span> Bảng điều hành giải đấu
          </div>
          <h2 className={styles.greetTitle}>{tournament.TournamentName}</h2>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 className={styles.panelTitle} style={{ marginBottom: 0 }}>Nội dung thi đấu</h3>
              {!isStaff && (
                <button onClick={() => setDivModalOpen(true)} className={styles.divAddBtn}>
                  <span style={{ fontSize: "14px", fontWeight: "bold" }}>＋</span> Thêm
                </button>
              )}
            </div>

            <div className={styles.divGrid}>
              {divisions.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "12px", textAlign: "center", padding: "20px 0" }}>Chưa có nội dung thi đấu nào.</p>
              ) : (
                divisions.map((div) => (
                  <button
                    key={div.DivisionID}
                    onClick={() => setSelectedDivisionId(div.DivisionID)}
                    className={`${styles.divButton} ${selectedDivisionId === div.DivisionID ? styles.divButtonActive : ""}`}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "8px" }}>
                      <span className={styles.divName}>{div.DivisionName}</span>
                      <span className={`${styles.divBadge} ${styles[`badge_${div.BracketType}`]}`}>
                        {div.BracketType === "SingleElimination" ? "SE" : div.BracketType === "GroupKnockout" ? "Group+KO" : "RR"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                      <span className={styles.divMetaChip}>
                        {div.CompetitionFormat === "MixedDoubles" ? "👥 Đôi Nam Nữ" : ["MenDoubles", "WomenDoubles"].includes(div.CompetitionFormat) ? "👥 Đấu Đôi" : "👤 Đấu Đơn"}
                      </span>
                      {div.MaxTeams && (
                        <span className={styles.divMetaChip}>
                          👥 {div.MaxTeams} Đội
                        </span>
                      )}
                    </div>
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
                <button 
                  onClick={() => setActiveTab("certificates")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: activeTab === "certificates" ? "#2563eb" : "transparent",
                    color: activeTab === "certificates" ? "#ffffff" : "#64748b",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "14px"
                  }}
                >
                  🎓 Chứng nhận & Trao giải
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
                                setGroupCountInput("8");
                                setShowGroupCountModal(true);
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
                  <form onSubmit={handleAllocateCourts} className={styles.stepCard} style={{ gap: "16px" }}>
                    <h4 className={styles.stepTitle}>2. Tự động xếp sân & Khóa lịch đặt</h4>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", flex: 1 }}>
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.formLabel}>ID các sân tổ chức giải</label>
                        <input
                          type="text"
                          required
                          className={styles.formInput}
                          value={courtInput}
                          onChange={(e) => setCourtInput(e.target.value)}
                          placeholder="Ví dụ: 1, 2"
                        />
                      </div>

                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.formLabel}>Vòng đấu áp dụng</label>
                        <select
                          className={styles.formSelect}
                          value={selectedRoundFilterForScheduling}
                          onChange={(e) => setSelectedRoundFilterForScheduling(parseInt(e.target.value, 10))}
                        >
                          <option value={0}>Tất cả các vòng đấu</option>
                          {roundsList.map((r) => (
                            <option key={`${r.roundNo}-${r.roundName}`} value={r.roundNo}>
                              {r.roundName} (Vòng {r.roundNo})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.formLabel}>Thời gian bắt đầu lượt đầu tiên</label>
                        <input
                          type="datetime-local"
                          required
                          className={styles.formInput}
                          value={startTimeInput}
                          min={getNowLocalString()}
                          onChange={(e) => setStartTimeInput(e.target.value)}
                        />
                      </div>
                      
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.formLabel}>Ngày kết thúc giải (Tùy chọn)</label>
                        <input
                          type="date"
                          className={styles.formInput}
                          value={endDateInput}
                          onChange={(e) => setEndDateInput(e.target.value)}
                        />
                      </div>

                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.formLabel}>Thời lượng (phút)</label>
                        <input
                          type="number"
                          required
                          className={styles.formInput}
                          value={durationInput}
                          onChange={(e) => setDurationInput(Number(e.target.value))}
                        />
                      </div>
                      
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.formLabel}>Nghỉ giữa ca (phút)</label>
                        <input
                          type="number"
                          required
                          className={styles.formInput}
                          value={breakInput}
                          onChange={(e) => setBreakInput(Number(e.target.value))}
                        />
                      </div>

                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.formLabel}>Khung giờ HĐ (Bắt đầu)</label>
                        <input
                          type="time"
                          required
                          className={styles.formInput}
                          value={dailyStartHour}
                          onChange={(e) => setDailyStartHour(e.target.value)}
                        />
                      </div>
                      
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
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

                    <div style={{ display: "flex", gap: "10px", marginTop: "auto", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                      <button 
                        type="submit" 
                        disabled={schedulingLoading || selectedDiv?.Status === "Completed" || selectedDiv?.Status === "Cancelled"} 
                        className={styles.btnPrimary} 
                        style={{ flex: 2, padding: "10px 14px", fontSize: "12px" }}
                      >
                        {schedulingLoading ? "Đang xếp..." : "⚡ Xếp sân & Khóa lịch đặt"}
                      </button>
                      {matches.length > 0 && (
                        <button 
                          type="button" 
                          onClick={promptRoundMilestones} 
                          className={styles.btnSecondary} 
                          style={{ flex: 1, padding: "10px 14px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                        >
                          📅 Giờ các vòng
                        </button>
                      )}
                    </div>
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
                  
                  const getTeamPlaceholder = (match: any, slot: "TeamA" | "TeamB", allMatches: any[]) => {
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

                  const renderCardActions = (m: any) => {
                    const hasTeams = m.TeamAID && m.TeamBID;
                    if (!hasTeams) return null;

                    return (
                      <div className={styles.bracketActions}>
                        {m.MatchStatus === "Scheduled" && (
                          <button 
                            type="button" 
                            onClick={() => handleSetMatchReady(m.MatchID)} 
                            className={styles.bracketActionBtn}
                            style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
                          >
                            Sẵn sàng
                          </button>
                        )}
                        {m.MatchStatus === "Ready" && (
                          <>
                            <button 
                              type="button" 
                              onClick={() => handleStartMatch(m.MatchID)} 
                              className={styles.bracketActionBtn}
                              style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }}
                            >
                              Bắt đầu
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleOpenScore(m)} 
                              className={styles.bracketActionBtn}
                              style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}
                            >
                              Nhập điểm
                            </button>
                          </>
                        )}
                        {m.MatchStatus === "InProgress" && (
                          <button 
                            type="button" 
                            onClick={() => handleOpenScore(m)} 
                            className={styles.bracketActionBtn}
                            style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }}
                          >
                            Báo điểm
                          </button>
                        )}
                        {m.MatchStatus === "Completed" && (
                          <button 
                            type="button" 
                            onClick={() => handleOpenScore(m)} 
                            className={styles.bracketActionBtn}
                            style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}
                          >
                            ✏️ Sửa điểm
                          </button>
                        )}
                      </div>
                    );
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

                    let cardClass = styles.bracketMatchCard;
                    const isMatched = (searchTeamQuery.trim() === "" || (teamAName.toLowerCase().includes(searchTeamQuery.toLowerCase()) || teamBName.toLowerCase().includes(searchTeamQuery.toLowerCase()))) &&
                                      (statusFilter === "All" || (statusFilter === "Live" && isLive) || (statusFilter === "Upcoming" && (m.MatchStatus === "Scheduled" || m.MatchStatus === "Ready")) || (statusFilter === "Completed" && isCompleted));

                    if (adminTrackedTeamId) {
                      if (trackedMatchIds.has(m.MatchID)) {
                        cardClass += ` ${styles.highlighted}`;
                      } else {
                        cardClass += ` ${styles.dimmed}`;
                      }
                    } else if (searchTeamQuery || statusFilter !== "All") {
                      if (isMatched) {
                        cardClass += ` ${styles.highlighted}`;
                      } else {
                        cardClass += ` ${styles.dimmed}`;
                      }
                    }

                    let parsedScores: any[] = [];
                    if (m.ScoreJson) {
                      try { parsedScores = JSON.parse(m.ScoreJson); } catch (e) {}
                    }

                    return (
                      <div key={m.MatchID || `mock-${m.RoundNo}-${m.MatchNo}`} id={`match-card-${m.MatchID}`} className={cardClass}>
                        <div className={styles.bracketMatchHeader}>
                          <span className={styles.bracketMatchId}>
                            #{m.MatchID || "TBD"}
                          </span>
                          {renderMatchStatusBadge(isBye ? "Bye" : m.MatchStatus)}
                        </div>

                        <div className={styles.bracketMatchTeams}>
                          <div 
                            className={`${styles.bracketTeamRow} ${isWinnerA ? styles.bracketTeamRowWinner : ""} ${isLoserA ? styles.bracketTeamRowLoser : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (teamAId) setAdminTrackedTeamId(adminTrackedTeamId === teamAId ? null : teamAId);
                            }}
                            style={{ cursor: teamAId ? "pointer" : "default" }}
                          >
                            <span className={`${styles.bracketTeamName} ${isWinnerA ? styles.bracketTeamNameWinner : ""}`} title={teamAName}>
                              🔵 {teamAName} {isWinnerA && "✓"}
                            </span>
                            <span className={styles.bracketTeamScore}>{m.TeamASetWon ?? (isWinnerA ? "W" : (isLoserA ? "L" : "-"))}</span>
                          </div>

                          <div 
                            className={`${styles.bracketTeamRow} ${isWinnerB ? styles.bracketTeamRowWinner : ""} ${isLoserB ? styles.bracketTeamRowLoser : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (teamBId) setAdminTrackedTeamId(adminTrackedTeamId === teamBId ? null : teamBId);
                            }}
                            style={{ cursor: teamBId ? "pointer" : "default" }}
                          >
                            <span className={`${styles.bracketTeamName} ${isWinnerB ? styles.bracketTeamNameWinner : ""}`} title={teamBName}>
                              🔴 {teamBName} {isWinnerB && "✓"}
                            </span>
                            <span className={styles.bracketTeamScore}>{m.TeamBSetWon ?? (isWinnerB ? "W" : (isLoserB ? "L" : "-"))}</span>
                          </div>
                        </div>

                        {/* Set scores line */}
                        {parsedScores.length > 0 && (
                          <div className={styles.bracketSetScores} style={{ color: isLive ? "#ef4444" : "#64748b" }}>
                            {isLive && <span className="live-dot" style={{ display: "inline-block", width: "6px", height: "6px", background: "#ef4444", borderRadius: "50%", marginRight: "4px", animation: "pulseLive 1s infinite" }} />}
                            Set: {parsedScores.map(s => `${s.teamAScore ?? 0}-${s.teamBScore ?? 0}`).join(", ")}
                          </div>
                        )}

                        {!isPlaceholder && (
                          <div className={styles.bracketMatchMeta}>
                            <span className={styles.bracketMetaCourt}>
                              🏟️ {m.CourtName || (["Completed", "InProgress", "Live"].includes(m.MatchStatus) ? "Sân tự do" : "Chờ xếp sân")}
                            </span>
                            <span className={styles.bracketMetaTime}>
                              ⏱️ {m.ScheduledStart ? formatMatchDateTime(m.ScheduledStart) : (["Completed", "InProgress", "Live"].includes(m.MatchStatus) ? "Đã thi đấu" : "Chờ lịch")}
                            </span>
                          </div>
                        )}
                        {isBye && (
                          <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", textAlign: "center", marginTop: "4px" }}>
                            Advanced by BYE
                          </div>
                        )}

                        {!isPlaceholder && renderCardActions(m)}
                      </div>
                    );
                  };

                  const renderKnockoutTree = () => {
                    const knockoutMatches = matches.filter(m => m.GroupName === "Knockout" || m.KnockoutRound);
                    const targetMatches = knockoutMatches.length > 0 ? knockoutMatches : matches;

                    if (targetMatches.length === 0) {
                      const mockRounds: any[] = [];
                      const mockQFMatches = Array.from({ length: 4 }, (_, idx) => ({ MatchID: -(idx + 1), RoundNo: 1, MatchNo: idx + 1, KnockoutRound: "Tứ kết", MatchStatus: "Scheduled", NextMatchID: -(Math.floor(idx / 2) + 5) }));
                      const mockSFMatches = Array.from({ length: 2 }, (_, idx) => ({ MatchID: -(idx + 5), RoundNo: 2, MatchNo: idx + 1, KnockoutRound: "Bán kết", MatchStatus: "Scheduled", NextMatchID: -7 }));
                      const mockFMatches = [{ MatchID: -7, RoundNo: 3, MatchNo: 1, KnockoutRound: "Chung kết", MatchStatus: "Scheduled" }];
                      mockRounds.push({ name: "Tứ kết", matches: mockQFMatches, info: "4 trận" });
                      mockRounds.push({ name: "Bán kết", matches: mockSFMatches, info: "2 trận" });
                      mockRounds.push({ name: "Chung kết", matches: mockFMatches, info: "1 trận" });

                      return (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", color: "#b45309", padding: "12px 16px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", marginBottom: "20px" }}>
                            ⚠️ Vòng bảng chưa kết thúc. Dưới đây là sơ đồ nhánh đấu loại trực tiếp dự kiến.
                          </div>

                          <div style={{ position: "relative" }}>
                            {/* Zoom controls inside toolbar at the top */}
                            <div className={styles.bracketCompactToolbar} style={{ marginBottom: "20px" }}>
                              <div className={styles.zoomGroup} style={{ marginLeft: "auto" }}>
                                <span className={styles.toolbarLabel}>Thu phóng:</span>
                                <div className={styles.toolbarBtnGroup}>
                                  <button type="button" onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))} className={styles.toolbarZoomBtn} title="Phóng to">➕</button>
                                  <button type="button" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className={styles.toolbarZoomBtn} title="Thu nhỏ">➖</button>
                                  <button type="button" onClick={() => setZoom(1.0)} className={styles.toolbarZoomBtn}>Reset</button>
                                </div>
                              </div>
                            </div>

                            <div id="bracket-tree-viewport" style={{ overflowX: "auto", overflowY: "visible", width: "100%", scrollBehavior: "smooth" }}>
                              <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, display: "inline-block", position: "relative" }}>
                                
                                <div className={styles.bracketTreeContainer} style={{ minHeight: "auto", height: `${mockRounds[0].matches.length * 150}px`, position: "relative" }}>
                                  <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
                                    {connections.map(c => (
                                      <path key={c.id} d={c.path} fill="none" stroke={c.isHighlighted ? "#B91C1C" : (c.isWinnerKnown ? "#EF4444" : "#FCA5A5")} strokeWidth={c.isHighlighted ? 3 : 1.5} style={{ transition: "stroke 0.2s, stroke-width 0.2s" }} />
                                    ))}
                                  </svg>

                                  {mockRounds.map((round, rIdx) => (
                                    <div key={rIdx} className={styles.bracketRoundColumn}>
                                      <div className={styles.bracketColumnHeaderContainer}>
                                        <span className={styles.bracketColumnHeaderTitle}>{round.name}</span>
                                        <span className={styles.bracketColumnHeaderInfo}>{round.info}</span>
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
                        {adminTrackedTeamId && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "8px 16px", borderRadius: "10px", marginBottom: "16px", fontSize: "12px", fontWeight: "700", color: "#1d4ed8" }}>
                            <span>🔍 Đang tô sáng lộ trình đi tiếp của đội đã chọn</span>
                            <button 
                              onClick={() => setAdminTrackedTeamId(null)}
                              style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", textDecoration: "underline", fontWeight: "800", padding: 0 }}
                            >
                              Bỏ theo dõi
                            </button>
                          </div>
                        )}

                        {/* Combined Admin Toolbar at the top */}
                        <div className={styles.bracketCompactToolbar} style={{ marginBottom: "20px" }}>
                          <div className={styles.toolbarSection}>
                            <input 
                              type="text" 
                              placeholder="Tìm VĐV..." 
                              value={searchTeamQuery}
                              onChange={(e) => setSearchTeamQuery(e.target.value)}
                              className={styles.toolbarSearchInput}
                              style={{ marginRight: "6px" }}
                            />
                            <select 
                              value={statusFilter} 
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className={styles.toolbarSelect}
                              style={{ marginRight: "12px" }}
                            >
                              <option value="All">Tất cả trận</option>
                              <option value="Live">Đang đấu (Live)</option>
                              <option value="Upcoming">Sắp đấu (Upcoming)</option>
                              <option value="Completed">Đã xong (Completed)</option>
                            </select>
                          </div>

                          {/* Zoom Controls inside Toolbar */}
                          <div className={styles.zoomGroup} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span className={styles.toolbarLabel}>Thu phóng:</span>
                            <div className={styles.toolbarBtnGroup}>
                              <button type="button" onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))} className={styles.toolbarZoomBtn} title="Phóng to">➕</button>
                              <button type="button" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className={styles.toolbarZoomBtn} title="Thu nhỏ">➖</button>
                              <button type="button" onClick={() => setZoom(1.0)} className={styles.toolbarZoomBtn}>Reset</button>
                            </div>
                          </div>
                        </div>

                        {sortedRounds.length > 0 && (
                          <div className={styles.bracketMobileRoundNav}>
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
                              style={{ color: "#10b981", border: "1px solid #10b981", background: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer" }}
                            >
                              ◀ Trước
                            </button>
                            
                            <div className="mobile-round-indicator" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <span className="mobile-round-name" style={{ fontSize: "13px", fontWeight: "800", color: "#073b2b" }}>{sortedRounds[activeMobileRoundIdx]}</span>
                              <span className="mobile-round-progress" style={{ fontSize: "10px", color: "#64748b" }}>Vòng {activeMobileRoundIdx + 1} / {sortedRounds.length}</span>
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
                              style={{ color: "#10b981", border: "1px solid #10b981", background: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer" }}
                            >
                              Sau ▶
                            </button>
                          </div>
                        )}

                        <div style={{ position: "relative" }}>
                          <div id="bracket-tree-viewport" onScroll={handleScroll} style={{ overflowX: "auto", overflowY: "visible", width: "100%", scrollBehavior: "smooth" }}>
                            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, display: "inline-block", position: "relative" }}>
                              
                              <div className={styles.bracketTreeContainer} style={{ minHeight: "auto", height: `${baseHeight}px`, position: "relative" }}>
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
                                    <div key={roundName} id={`round-col-${roundName}`} className={styles.bracketRoundColumn}>
                                      <div className={styles.bracketColumnHeaderContainer}>
                                        <span className={styles.bracketColumnHeaderTitle}>{roundName}</span>
                                        <span className={styles.bracketColumnHeaderInfo}>{done}/{total} Đã xong ({rPct}%)</span>
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
                        {/* If Knockout stage, render the full tree view */}
                        {activeGroup === "Knockout" ? (
                          <div style={{ width: "100%" }}>
                            {renderKnockoutTree()}
                          </div>
                        ) : null}

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
                        {activeGroup !== "Knockout" && (
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
                      )}
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

            {selectedDivisionId && activeTab === "certificates" && (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle} style={{ marginBottom: "10px" }}>🎓 Quản lý Chứng nhận & Giải thưởng</h3>
                <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "20px", lineHeight: "1.5" }}>
                  Gửi chứng nhận điện tử kèm thông tin giải thưởng đến email đăng ký của các vận động viên thuộc đội đã xác nhận tham gia.
                </p>

                {selectedDiv?.Status !== "Completed" && (
                  <div style={{
                    background: "#fffbeb",
                    border: "1px solid #fef3c7",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    color: "#b45309",
                    fontSize: "13px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "20px"
                  }}>
                    <span>⚠️</span>
                    <span>
                      Lưu ý: Nội dung thi đấu này chưa được chuyển sang trạng thái <strong>Đã kết thúc (Completed)</strong>. Thứ hạng tự động có thể chưa chính xác cho tới khi giải đấu hoàn thành.
                    </span>
                  </div>
                )}

                {registrationsLoading ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <p style={{ color: "#64748b" }}>Đang tải danh sách đăng ký...</p>
                  </div>
                ) : registrations.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <p style={{ color: "#64748b" }}>Chưa có đội đấu nào được ghi nhận cho nội dung này.</p>
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Đội & Mã Đội</th>
                          <th>Thành viên & Email</th>
                          <th>Hạng Đạt Được</th>
                          <th>Tệp đính kèm (PDF/Ảnh)</th>
                          <th>Trạng Thái Gửi</th>
                          <th>Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrations.map((reg) => {
                          const currentOverride = certOverrides[reg.registrationId] || "auto";
                          
                          let autoRank: number | null = null;
                          if (selectedDiv?.BracketType === "RoundRobin") {
                            const sorted = [...standings].sort((a,b) => (a.RankNo || 99) - (b.RankNo || 99));
                            const idx = sorted.findIndex(s => s.TeamID === reg.teamId);
                            if (idx >= 0 && idx < 3) autoRank = idx + 1;
                          } else {
                            const finalMatch = matches.find(m => m.KnockoutRound === "Chung kết");
                            const thirdMatch = matches.find(m => m.KnockoutRound === "Tranh hạng 3");
                            if (finalMatch && finalMatch.WinnerTeamID) {
                              if (finalMatch.WinnerTeamID === reg.teamId) autoRank = 1;
                              else if (finalMatch.TeamAID === reg.teamId || finalMatch.TeamBID === reg.teamId) autoRank = 2;
                            }
                            if (thirdMatch && thirdMatch.WinnerTeamID && thirdMatch.WinnerTeamID === reg.teamId) {
                              autoRank = 3;
                            }
                          }

                          let resolvedRank = autoRank;
                          if (currentOverride === "1") resolvedRank = 1;
                          else if (currentOverride === "2") resolvedRank = 2;
                          else if (currentOverride === "3") resolvedRank = 3;
                          else if (currentOverride === "none") resolvedRank = null;

                          let rankText = "Chỉ tham gia 🎁";
                          let rankBg = "#f1f5f9";
                          let rankColor = "#475569";
                          if (resolvedRank === 1) {
                            rankText = "Vô Địch (Hạng 1) 🏆";
                            rankBg = "#fef3c7";
                            rankColor = "#b45309";
                          } else if (resolvedRank === 2) {
                            rankText = "Á Quân (Hạng 2) 🥈";
                            rankBg = "#f3f4f6";
                            rankColor = "#4b5563";
                          } else if (resolvedRank === 3) {
                            rankText = "Hạng Ba (Hạng 3) 🥉";
                            rankBg = "#fdf5e2";
                            rankColor = "#d97706";
                          }

                          const isSending = sendingCertMap[reg.registrationId];

                          return (
                            <tr key={reg.registrationId}>
                              <td style={{ fontWeight: "700", color: "#0f172a" }}>
                                <div>{reg.teamName}</div>
                                <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>{reg.teamCode}</span>
                              </td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  {reg.athletes.map((ath: any) => (
                                    <div key={ath.athleteId} style={{ fontSize: "12px" }}>
                                      <span style={{ fontWeight: "600" }}>{ath.fullName}</span> 
                                      <span style={{ color: "#64748b", marginLeft: "6px" }}>({ath.email || "Chưa có email"})</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  <span style={{
                                    alignSelf: "flex-start",
                                    fontSize: "11px",
                                    fontWeight: "800",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    backgroundColor: rankBg,
                                    color: rankColor
                                  }}>
                                    {rankText}
                                  </span>
                                  <select
                                    value={currentOverride}
                                    onChange={(e) => setCertOverrides(prev => ({ ...prev, [reg.registrationId]: e.target.value }))}
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      border: "1px solid #cbd5e1",
                                      fontSize: "12px",
                                      color: "#1e293b",
                                      cursor: "pointer",
                                      maxWidth: "180px",
                                      outline: "none"
                                    }}
                                  >
                                    <option value="auto">Tự động tính từ kết quả</option>
                                    <option value="1">Giải Vô Địch (Hạng 1)</option>
                                    <option value="2">Giải Á Quân (Hạng 2)</option>
                                    <option value="3">Giải Hạng Ba (Hạng 3)</option>
                                    <option value="none">Chỉ nhận chứng nhận tham gia</option>
                                  </select>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {reg.certificatePdfUrl ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <a
                                        href={reg.certificatePdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontSize: "12px",
                                          color: "#059669",
                                          fontWeight: "bold",
                                          textDecoration: "underline"
                                        }}
                                      >
                                        📎 Xem file
                                      </a>
                                      <button
                                        onClick={() => handleClearPdfUrl(reg.registrationId)}
                                        style={{
                                          border: "none",
                                          background: "transparent",
                                          color: "#ef4444",
                                          fontSize: "11px",
                                          cursor: "pointer",
                                          fontWeight: "bold"
                                        }}
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>Chưa đính kèm</span>
                                  )}
                                  
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <input
                                      type="text"
                                      placeholder="Dán link PDF/ảnh..."
                                      defaultValue={reg.certificatePdfUrl || ""}
                                      onBlur={(e) => handleSavePdfUrlManual(reg.registrationId, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleSavePdfUrlManual(reg.registrationId, e.currentTarget.value);
                                        }
                                      }}
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "11px",
                                        color: "#1e293b",
                                        width: "120px"
                                      }}
                                    />
                                    
                                    <label style={{
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      backgroundColor: "#f1f5f9",
                                      border: "1px solid #cbd5e1",
                                      fontSize: "11px",
                                      color: "#475569",
                                      cursor: "pointer",
                                      fontWeight: "600"
                                    }}>
                                      Tải lên 📤
                                      <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handlePdfUpload(file, reg.registrationId);
                                        }}
                                        style={{ display: "none" }}
                                      />
                                    </label>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {reg.isCertificateSent ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    <span style={{
                                      fontSize: "11px",
                                      fontWeight: "bold",
                                      color: "#16a34a",
                                      backgroundColor: "#f0fdf4",
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      display: "inline-block"
                                    }}>
                                      ✅ Đã gửi email
                                    </span>
                                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                                      {reg.certificateSentAt ? new Date(reg.certificateSentAt).toLocaleDateString("vi-VN") : ""}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{
                                    fontSize: "11px",
                                    fontWeight: "bold",
                                    color: "#64748b",
                                    backgroundColor: "#f1f5f9",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    display: "inline-block"
                                  }}>
                                    Chưa gửi
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    onClick={() => {
                                      setPreviewReg(reg);
                                      setAdminCertRankOverride(currentOverride);
                                      setShowAdminCertModal(true);
                                    }}
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: "12px",
                                      fontWeight: "700",
                                      borderRadius: "8px",
                                      border: "1.5px solid #cbd5e1",
                                      backgroundColor: "#ffffff",
                                      color: "#475569",
                                      cursor: "pointer"
                                    }}
                                  >
                                    Xem thử 👁️
                                  </button>
                                  <button
                                    disabled={isSending}
                                    onClick={() => handleSendCertificate(reg.registrationId, currentOverride)}
                                    style={{
                                      padding: "6px 14px",
                                      fontSize: "12px",
                                      fontWeight: "800",
                                      borderRadius: "8px",
                                      border: "none",
                                      backgroundColor: reg.isCertificateSent ? "#059669" : "#2563eb",
                                      color: "#ffffff",
                                      cursor: isSending ? "not-allowed" : "pointer"
                                    }}
                                  >
                                    {isSending ? "Đang gửi..." : reg.isCertificateSent ? "Gửi lại ✉️" : "Gửi Mail ✉️"}
                                  </button>
                                </div>
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

              {/* Round Milestones Config (Upfront Scheduling) */}
              {divRoundScheduleConfig.length > 0 && (
                <div style={{ marginTop: "20px", borderTop: "1px dashed #cbd5e1", paddingTop: "16px" }}>
                  <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    📅 Thiết lập lịch trình & Sân đấu dự kiến
                  </h4>
                  <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px" }}>
                    Cài đặt ngày giờ và sân đấu dự kiến cho từng vòng đấu để người chơi nắm lịch trình khi đăng ký.
                  </p>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "250px", overflowY: "auto", paddingRight: "4px" }}>
                    {divRoundScheduleConfig.map((r, index) => (
                      <div key={index} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 14px", borderRadius: "10px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                          {r.roundName} (Vòng {r.roundNo})
                        </span>
                        
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                            <span style={{ fontSize: "10px", color: "#94a3b8" }}>Giờ thi đấu</span>
                            <input 
                              type="datetime-local" 
                              className={styles.formInput}
                              style={{ padding: "6px 10px", fontSize: "12px" }}
                              value={r.scheduledStart}
                              onChange={(e) => {
                                const updated = [...divRoundScheduleConfig];
                                updated[index].scheduledStart = e.target.value;
                                setDivRoundScheduleConfig(updated);
                              }}
                            />
                          </div>
                          
                          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                            <span style={{ fontSize: "10px", color: "#94a3b8" }}>Sân thi đấu</span>
                            <select
                              className={styles.formSelect}
                              style={{ padding: "6px 10px", fontSize: "12px" }}
                              value={r.courtId || 0}
                              onChange={(e) => {
                                const updated = [...divRoundScheduleConfig];
                                updated[index].courtId = parseInt(e.target.value, 10);
                                setDivRoundScheduleConfig(updated);
                              }}
                            >
                              <option value={0}>Chờ xếp sân</option>
                              {allCourts.map((c) => (
                                <option key={c.CourtID} value={c.CourtID}>
                                  {c.Name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {/* Round Milestones Modal */}
      {showMilestonesModal && roundsList.length > 0 && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleSaveMilestones} className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Cài đặt Cột mốc thời gian các Vòng</h3>
              <button type="button" className={styles.modalClose} onClick={() => setShowMilestonesModal(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: "12px", color: "#6B7280", margin: "0 0 16px 0" }}>
                Thiết lập thời gian bắt đầu chính thức cho từng vòng đấu của nội dung này. Giờ thi đấu của tất cả các trận trong vòng sẽ tự động cập nhật đồng bộ.
              </p>
              {roundsList.map((r, index) => (
                <div key={index} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "16px", borderRadius: "12px", marginBottom: "16px" }}>
                  <label className={styles.formLabel} style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#1e293b" }}>
                    {r.roundName} (Vòng {r.roundNo})
                  </label>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className={styles.formGroup}>
                      <span className={styles.formLabel} style={{ fontSize: "11px", color: "#64748b" }}>Thời gian bắt đầu</span>
                      <input 
                        type="datetime-local" 
                        required
                        className={styles.formInput}
                        value={milestoneTimes[index] || ""}
                        onChange={(e) => {
                          const updated = [...milestoneTimes];
                          updated[index] = e.target.value;
                          setMilestoneTimes(updated);
                        }}
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <span className={styles.formLabel} style={{ fontSize: "11px", color: "#64748b" }}>Sân thi đấu</span>
                      <select
                        className={styles.formSelect}
                        value={milestoneCourts[index] || 0}
                        onChange={(e) => {
                          const updated = [...milestoneCourts];
                          updated[index] = parseInt(e.target.value, 10);
                          setMilestoneCourts(updated);
                        }}
                      >
                        <option value={0}>Giữ nguyên / Tự động xếp sân</option>
                        {allCourts.map((c) => (
                          <option key={c.CourtID} value={c.CourtID}>
                            {c.Name} (ID: {c.CourtID})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ color: "#ef4444", fontSize: "12.5px", padding: "10px 20px", fontWeight: "bold", background: "#fef2f2", margin: "10px 20px", borderRadius: "8px", border: "1px solid #fca5a5" }}>
                ❌ {error}
              </div>
            )}

            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setShowMilestonesModal(false)} className={styles.btnCancelModal}>
                Hủy
              </button>
              <button type="submit" className={styles.btnSaveModal}>
                Lưu cột mốc
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Group Count Modal */}
      {showGroupCountModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "400px" }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Chia bảng đấu</h3>
              <button 
                type="button" 
                className={styles.modalClose} 
                onClick={() => setShowGroupCountModal(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody} style={{ padding: "20px" }}>
              <div className={styles.formGroup} style={{ marginBottom: "0" }}>
                <label className={styles.formLabel} style={{ fontWeight: "bold", marginBottom: "8px", display: "block" }}>
                  Nhập số lượng bảng đấu (ví dụ: 2, 4, 8...):
                </label>
                <input
                  type="number"
                  min={2}
                  required
                  className={styles.formInput}
                  value={groupCountInput}
                  onChange={(e) => setGroupCountInput(e.target.value)}
                  placeholder="Nhập số bảng..."
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={styles.btnCancelModal} 
                onClick={() => setShowGroupCountModal(false)}
              >
                Hủy
              </button>
              <button 
                type="button" 
                className={styles.btnSaveModal} 
                onClick={() => {
                  const num = parseInt(groupCountInput, 10);
                  if (!isNaN(num) && num >= 2) {
                    setShowGroupCountModal(false);
                    handleGenerateGroups(num);
                  } else {
                    alert("Số lượng bảng đấu không hợp lệ (phải >= 2).");
                  }
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Certificate Preview Modal */}
      {showAdminCertModal && previewReg && (() => {
        let rankValue: number | null = null;
        const currentOverride = adminCertRankOverride;

        let autoRank: number | null = null;
        if (selectedDiv?.BracketType === "RoundRobin") {
          const sorted = [...standings].sort((a,b) => (a.RankNo || 99) - (b.RankNo || 99));
          const idx = sorted.findIndex(s => s.TeamID === previewReg.teamId);
          if (idx >= 0 && idx < 3) autoRank = idx + 1;
        } else {
          const finalMatch = matches.find(m => m.KnockoutRound === "Chung kết");
          const thirdMatch = matches.find(m => m.KnockoutRound === "Tranh hạng 3");
          if (finalMatch && finalMatch.WinnerTeamID) {
            if (finalMatch.WinnerTeamID === previewReg.teamId) autoRank = 1;
            else if (finalMatch.TeamAID === previewReg.teamId || finalMatch.TeamBID === previewReg.teamId) autoRank = 2;
          }
          if (thirdMatch && thirdMatch.WinnerTeamID && thirdMatch.WinnerTeamID === previewReg.teamId) {
            autoRank = 3;
          }
        }

        if (currentOverride === "auto") {
          rankValue = autoRank;
        } else if (currentOverride === "1") {
          rankValue = 1;
        } else if (currentOverride === "2") {
          rankValue = 2;
        } else if (currentOverride === "3") {
          rankValue = 3;
        } else {
          rankValue = null;
        }

        const athleteNames = previewReg.athletes && previewReg.athletes.length > 0
          ? previewReg.athletes.map((a: any) => a.fullName).join(" - ")
          : previewReg.teamName || "Vận động viên";

        const isChampion = rankValue === 1;
        const isRunnerUp = rankValue === 2;
        const isThird = rankValue === 3;
        const isWinner = isChampion || isRunnerUp || isThird;

        let titleColor = "#065f46";
        let certTitle = "CHỨNG NHẬN THAM GIA";
        let certSub = "Đã hoàn thành thi đấu giải";
        let rewardText = "Hộp quà lưu niệm BTC & Huy hiệu lưu niệm";
        let cardBg = "linear-gradient(135deg, #fdfbf7 0%, #f7f3eb 100%)";
        let rankLabel = "Chứng nhận hoàn thành giải đấu";
        let badgeIcon = "🎁";

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

        if (isChampion) {
          titleColor = "#92400e";
          certTitle = "CHỨNG NHẬN VÔ ĐỊCH";
          certSub = "Đạt thành tích xuất sắc HẠNG 1 (VÔ ĐỊCH)";
          rewardText = `CÚP VÔ ĐỊCH, Huy chương Vàng & Tiền thưởng ${getPrizeText(1)}`;
          cardBg = "linear-gradient(135deg, #fdfbf7 0%, #fffbeb 100%)";
          rankLabel = "Giải Vô Địch (Hạng 1)";
          badgeIcon = "🏆";
        } else if (isRunnerUp) {
          titleColor = "#4b5563";
          certTitle = "CHỨNG NHẬN Á QUÂN";
          certSub = "Đạt thành tích xuất sắc HẠNG 2 (Á QUÂN)";
          rewardText = `Huy chương Bạc & Tiền thưởng ${getPrizeText(2)}`;
          cardBg = "linear-gradient(135deg, #fdfbf7 0%, #f3f4f6 100%)";
          rankLabel = "Giải Á Quân (Hạng 2)";
          badgeIcon = "🥈";
        } else if (isThird) {
          titleColor = "#b45309";
          certTitle = "CHỨNG NHẬN HẠNG BA";
          certSub = "Đạt thành tích HẠNG 3 (ĐỒNG GIẢI BA)";
          rewardText = `Huy chương Đồng & Tiền thưởng ${getPrizeText(3)}`;
          cardBg = "linear-gradient(135deg, #fdfbf7 0%, #fdf5e2 100%)";
          rankLabel = "Đồng Giải Ba (Hạng 3)";
          badgeIcon = "🥉";
        }

        return (
          <div style={{
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
            <div style={{
              background: "#ffffff",
              borderRadius: "24px",
              width: "100%",
              maxWidth: "600px",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.3)",
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
                padding: "16px 24px",
                borderBottom: "1px solid #f1f5f9"
              }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
                  👁️ Xem trước chứng nhận sẽ gửi cho {previewReg.teamName}
                </span>
                <button 
                  onClick={() => setShowAdminCertModal(false)}
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
                    cursor: "pointer"
                  }}
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: "24px" }}>
                <div style={{
                  background: cardBg,
                  border: "8px double #d97706",
                  borderRadius: "16px",
                  padding: "32px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center"
                }}>
                  <div style={{
                    position: "absolute",
                    inset: "8px",
                    border: "1px solid #fde68a",
                    pointerEvents: "none",
                    borderRadius: "8px"
                  }} />

                  <div style={{ fontSize: "9px", fontWeight: "800", color: "#b45309", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>
                    Hệ Thống Giải Đấu Pickleball Chuyên Nghiệp • PickleClub
                  </div>

                  <span style={{ fontSize: "28px", marginBottom: "8px" }}>{badgeIcon}</span>

                  <h1 style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: "900", color: titleColor, letterSpacing: "0.5px" }}>
                    {certTitle}
                  </h1>

                  <div style={{ width: "120px", height: "2px", background: isWinner ? "#d97706" : "#059669", margin: "8px 0 16px 0" }} />

                  <p style={{ margin: "0", fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>
                    Ban Tổ Chức Giải Đấu trân trọng trao tặng cho
                  </p>

                  <h2 style={{ margin: "12px 0 6px 0", fontSize: "20px", fontWeight: "850", color: "#0f172a" }}>
                    {athleteNames}
                  </h2>

                  <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#475569", maxWidth: "440px", lineHeight: "1.5" }}>
                    Đã hoàn thành thi đấu xuất sắc nội dung <strong>{previewReg.DivisionName || selectedDiv?.DivisionName}</strong> (Mã đội: {previewReg.teamCode}) tại giải đấu <strong>{tournament?.TournamentName}</strong> tổ chức tại {tournament?.Location || "PickleClub Center"}.
                  </p>

                  <div style={{
                    background: isWinner ? "#fffbeb" : "#f0fdf4",
                    border: isWinner ? "1.5px solid #fef3c7" : "1.5px solid #d1fae5",
                    borderRadius: "14px",
                    padding: "12px 18px",
                    width: "100%",
                    maxWidth: "420px",
                    marginBottom: "20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "800", color: isWinner ? "#b45309" : "#047857" }}>
                      {rankLabel}
                    </span>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b" }}>
                      {rewardText}
                    </div>
                  </div>

                  <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: "12px", borderTop: "1px dashed #e2e8f0" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", fontSize: "10px" }}>
                      <span style={{ color: "#94a3b8", textTransform: "uppercase", fontSize: "8px" }}>Đại Diện BTC</span>
                      <strong style={{ color: "#475569", marginTop: "2px" }}>Lê Thanh Sơn</strong>
                    </div>
                    <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)", border: "2px dashed #ffffff", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: "900", fontSize: "6px" }}>
                      SEAL
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right", fontSize: "10px" }}>
                      <span style={{ color: "#94a3b8", textTransform: "uppercase", fontSize: "8px" }}>Ngày Cấp</span>
                      <strong style={{ color: "#334155" }}>{new Date().toLocaleDateString("vi-VN")}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: "16px 24px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end"
              }}>
                <button
                  onClick={() => setShowAdminCertModal(false)}
                  style={{
                    background: "#ffffff",
                    color: "#475569",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "10px 24px",
                    fontSize: "0.85rem",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  Đóng xem trước
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
