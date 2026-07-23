"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { tournamentApi, Tournament, TournamentDivision } from "@/services/tournamentApi";
import { getMyProfile } from "@/services/profileApi";
import { getPlayerProfile, getSuitableTeammates, sendInvitation } from "@/services/matchingApi";
import { LuTrophy, LuClock, LuUser, LuCalendar, LuPhone, LuUsers, LuFileText, LuMapPin, LuBuilding, LuWallet, LuShieldCheck, LuHandshake, LuGift, LuFlame, LuSparkles } from "react-icons/lu";
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

function ConfirmedRegistrationBanner({ reg }: { reg: any }) {
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
      
      <div style={{ display: "flex", gap: "12px", borderTop: "1px solid #a7f3d0", paddingTop: "20px", flexWrap: "wrap" }}>
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
          <p style={{ margin: 0 }}>{content}</p>
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
    if (!registerModalOpen) return;
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
  }, [registerModalOpen]);

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

        {activeTab === "bracket" && (
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

            {matches.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", border: "1px solid var(--tm-border)", borderRadius: "16px", background: "#fff" }}>
                <p className="text-slate-400">Sơ đồ nhánh đấu và lịch thi đấu chưa được ban tổ chức tạo.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {matches.map((m) => (
                  <div key={m.MatchID} className="tm-match-card">
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                      <div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                          <span className="tm-badge tm-badge-draft" style={{ borderRadius: "4px" }}>
                            Vòng {m.RoundNo} - Trận {m.MatchNo}
                          </span>
                          {m.GroupName && (
                            <span style={{ fontSize: "0.65rem", color: "var(--tm-accent)", fontWeight: "bold", textTransform: "uppercase" }}>{m.GroupName}</span>
                          )}
                          <span className={`tm-badge ${m.MatchStatus === "Completed" ? "tm-badge-published" : "tm-badge-closed"}`}>
                            {m.MatchStatus}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.875rem", display: "flex", flexDirection: "column", gap: "4px", minWidth: "220px" }}>
                          <p style={{ fontWeight: m.WinnerTeamID === m.TeamAID ? "bold" : "normal", color: m.WinnerTeamID === m.TeamAID ? "var(--tm-primary)" : "inherit" }}>
                            🔵 {m.TeamAName || "Đợi đối thủ..."}
                          </p>
                          <p style={{ fontWeight: m.WinnerTeamID === m.TeamBID ? "bold" : "normal", color: m.WinnerTeamID === m.TeamBID ? "var(--tm-primary)" : "inherit" }}>
                            🔴 {m.TeamBName || "Đợi đối thủ..."}
                          </p>
                        </div>
                      </div>

                      <div style={{ textAlign: "right", fontSize: "0.75rem", borderLeft: "1px solid var(--tm-border)", paddingLeft: "16px" }}>
                        {m.CourtName && <p style={{ fontWeight: "700" }}>🏟️ {m.CourtName}</p>}
                        {m.ScheduledStart && (
                          <p style={{ color: "var(--tm-muted)", marginTop: "2px" }}>
                            ⏱️ {new Date(m.ScheduledStart).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                          </p>
                        )}
                        {m.ScoreText && (
                          <p style={{ color: "var(--tm-primary)", fontWeight: "bold", marginTop: "6px", background: "rgba(34,197,94,0.1)", padding: "4px 8px", borderRadius: "4px" }}>
                            🏆 Tỉ số: {m.ScoreText}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

            {standings.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", border: "1px solid var(--tm-border)", borderRadius: "16px", background: "#fff" }}>
                <p className="text-slate-400">Bảng xếp hạng rỗng hoặc nội dung này không áp dụng thể thức đấu vòng tròn.</p>
              </div>
            ) : (() => {
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
                                  <td style={{ fontWeight: "700" }}>{st.TeamName}</td>
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
                          <td style={{ fontWeight: "700" }}>{st.TeamName}</td>
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
                          onClick={() => setRegisterModalOpen(false)} 
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
    </div>
  );
}
