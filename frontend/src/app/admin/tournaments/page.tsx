"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tournamentApi, Tournament } from "@/services/tournamentApi";
import { FiSearch, FiPlus, FiCalendar, FiArchive, FiList, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { FaTrophy } from "react-icons/fa";
import { getUser } from "@/utils/authStorage";
import styles from "./AdminTournamentsPage.module.css";

function todayVN() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const [archiveSubTab, setArchiveSubTab] = useState<"all" | "completed" | "cancelled">("all");

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest && target.closest(`.${styles.dropdownContainer}`)) {
        return;
      }
      setActiveDropdownId(null);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    const user = getUser();
    const role = String(user?.RoleName || user?.role || user?.roles?.[0] || "").toLowerCase();
    if (role.includes("staff")) {
      setIsStaff(true);
    }
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    tournamentName: "",
    description: "",
    startDate: "",
    endDate: "",
    registrationStart: "",
    registrationEnd: "",
    location: "",
    organizerName: "",
    rules: "",
    prizeInfo: "",
    imageURL: "",
  });

  const loadData = () => {
    setLoading(true);
    tournamentApi
      .getTournaments()
      .then((data) => setTournaments(data))
      .catch((err) => {
        console.error(err);
        setError("Không thể tải danh sách giải đấu.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setError("");
    setSuccess("");
    setFormData({
      tournamentName: "",
      description: "",
      startDate: "",
      endDate: "",
      registrationStart: "",
      registrationEnd: "",
      location: "",
      organizerName: "",
      rules: "",
      prizeInfo: "",
      imageURL: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (t: Tournament) => {
    setEditingId(t.TournamentID);
    setError("");
    setSuccess("");
    setFormData({
      tournamentName: t.TournamentName,
      description: t.Description || "",
      startDate: t.StartDate ? t.StartDate.slice(0, 10) : "",
      endDate: t.EndDate ? t.EndDate.slice(0, 10) : "",
      registrationStart: t.RegistrationStart ? t.RegistrationStart.slice(0, 10) : "",
      registrationEnd: t.RegistrationEnd ? t.RegistrationEnd.slice(0, 10) : "",
      location: t.Location || "",
      organizerName: t.OrganizerName || "",
      rules: t.Rules || "",
      prizeInfo: t.PrizeInfo || "",
      imageURL: t.ImageURL || "",
    });
    setModalOpen(true);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${baseUrl}/api/tournaments/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload thất bại");

      setFormData(prev => ({ ...prev, imageURL: data.data.url }));
    } catch (err: any) {
      alert("Lỗi tải ảnh lên: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      if (!formData.registrationStart || !formData.registrationEnd || !formData.startDate || !formData.endDate) {
        throw new Error("Vui lòng điền đầy đủ thông tin thời gian đăng ký và thời gian giải đấu.");
      }

      const regStart = new Date(formData.registrationStart).getTime();
      const regEnd = new Date(formData.registrationEnd).getTime();
      const tourStart = new Date(formData.startDate).getTime();
      const tourEnd = new Date(formData.endDate).getTime();

      if (regStart >= regEnd) {
        throw new Error("Ngày bắt đầu đăng ký phải trước ngày kết thúc đăng ký.");
      }
      if (regEnd > tourStart) {
        throw new Error("Ngày kết thúc đăng ký phải trước hoặc bằng ngày bắt đầu giải đấu.");
      }
      if (tourStart >= tourEnd) {
        throw new Error("Ngày bắt đầu giải đấu phải trước ngày kết thúc giải đấu.");
      }

      const apiPayload = {
        tournamentCode: editingId ? undefined : `TOURN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tournamentName: formData.tournamentName,
        description: formData.description,
        location: formData.location,
        organizerName: formData.organizerName,
        rules: formData.rules,
        prizeInfo: formData.prizeInfo,
        imageURL: formData.imageURL || null,
        registrationStart: formData.registrationStart ? new Date(formData.registrationStart).toISOString() : undefined,
        registrationEnd: formData.registrationEnd ? new Date(formData.registrationEnd).toISOString() : undefined,
        tournamentStart: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        tournamentEnd: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      };

      if (editingId) {
        await tournamentApi.updateTournament(editingId, apiPayload);
        setSuccess("Cập nhật thông tin giải đấu thành công!");
      } else {
        await tournamentApi.createTournament(apiPayload);
        setSuccess("Tạo mới giải đấu nháp thành công!");
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "Lưu thất bại.");
    }
  };

  const handlePublish = async (id: number) => {
    setError("");
    setSuccess("");
    try {
      await tournamentApi.publishTournament(id);
      setSuccess("Công bố giải đấu thành công! Đã mở cổng đăng ký công khai.");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClose = async (id: number) => {
    setError("");
    setSuccess("");
    try {
      await tournamentApi.closeRegistration(id);
      setSuccess("Đã đóng cổng đăng ký thành công.");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn hủy bỏ giải đấu này? Thao tác này không thể hoàn tác.")) return;
    setError("");
    setSuccess("");
    try {
      await tournamentApi.cancelTournament(id);
      setSuccess("Đã hủy bỏ giải đấu thành công.");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa hoàn toàn giải đấu nháp này? Thao tác này không thể khôi phục.")) return;
    setError("");
    setSuccess("");
    try {
      await tournamentApi.deleteTournament(id);
      setSuccess("Đã xóa giải đấu thành công.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Không thể xóa giải đấu.");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Filter list based on search bar with safety check
  const searchedTournaments = tournaments.filter(t => 
    (t.TournamentName || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.OrganizerName || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.Location || "").toLowerCase().includes(search.toLowerCase())
  );

  // Filter list by Active vs Archived tabs
  const filteredTournaments = searchedTournaments.filter(t => {
    const isActiveStatus = ["Draft", "Open", "RegistrationClosed", "Scheduled", "Ongoing"].includes(t.Status);
    if (activeTab === "active") {
      return isActiveStatus;
    } else {
      // Archived tab
      if (isActiveStatus) return false;
      if (archiveSubTab === "completed") {
        return t.Status === "Completed";
      } else if (archiveSubTab === "cancelled") {
        return t.Status === "Cancelled";
      }
      return true; // "all"
    }
  });

  return (
    <div className={styles.wrapper}>
      {/* Top Header Bar matching other Admin Modules */}
      <header className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumbs}>
            <span>Quản trị</span>
            <span className={styles.chevron}>&gt;</span>
            <span className={styles.currentCrumb}>Quản lý Giải đấu</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={styles.contentArea}>
        
        {/* Premium Sports Dashboard Hero Section */}
        <div className={styles.heroSection}>
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <div className={styles.heroBadge}>
                <FaTrophy className={styles.heroBadgeIcon} />
                <span>Pickleball Tournament Dashboard</span>
              </div>
              <h1 className={styles.heroTitle}>Hệ thống Quản lý Giải đấu</h1>
              <p className={styles.heroDesc}>
                Khởi tạo giải đấu, xếp lịch đấu tự động, theo dõi tiến trình thi đấu và cập nhật kết quả trực tuyến.
              </p>
            </div>
            
            <div className={styles.heroActions}>
              <div className={styles.heroSearchWrap}>
                <FiSearch className={styles.heroSearchIcon} />
                <input
                  type="text"
                  placeholder="Tìm tên giải, địa điểm..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={styles.heroSearchInput}
                />
              </div>
              {!isStaff && (
                <button onClick={handleOpenCreate} className={styles.btnCreateHero}>
                  <FiPlus /> Tạo giải đấu nháp
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: "rgba(37, 99, 235, 0.1)", color: "#2563eb" }}>
              <FiCalendar size={20} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Tổng giải đấu</span>
              <span className={styles.statValue}>{tournaments.length}</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: "rgba(22, 163, 74, 0.1)", color: "#16a34a" }}>
              <FaTrophy size={20} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Đang diễn ra</span>
              <span className={styles.statValue}>
                {tournaments.filter(t => t.Status === "Ongoing").length}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" }}>
              <FiList size={20} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Đội tham gia</span>
              <span className={styles.statValue}>
                {tournaments.reduce((acc, t) => acc + (t.Status === "Draft" ? 0 : t.Status === "Open" ? 8 : 16), 0)}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: "rgba(234, 88, 12, 0.1)", color: "#ea580c" }}>
              <FiArchive size={20} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Trận đấu</span>
              <span className={styles.statValue}>
                {tournaments.reduce((acc, t) => acc + (t.Status === "Draft" ? 0 : t.Status === "Ongoing" ? 28 : t.Status === "Completed" ? 31 : 12), 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Custom Tabs for Active vs Archived Tournaments */}
        <div className={styles.tabsContainer}>
          <button 
            type="button"
            className={`${styles.tabButton} ${activeTab === "active" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("active")}
          >
            <FiCalendar /> Giải đấu hiện tại
          </button>
          <button 
            type="button"
            className={`${styles.tabButton} ${activeTab === "archive" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("archive")}
          >
            <FiArchive /> Lưu trữ / Lịch sử
          </button>
        </div>

        {/* Custom Sub-tabs if inside Archive/History tab */}
        {activeTab === "archive" && (
          <div className={styles.subTabsContainer}>
            <button
              type="button"
              className={`${styles.subTabButton} ${archiveSubTab === "all" ? styles.subTabActiveAll : ""}`}
              onClick={() => setArchiveSubTab("all")}
            >
              <FiList /> Tất cả lịch sử
            </button>
            <button
              type="button"
              className={`${styles.subTabButton} ${archiveSubTab === "completed" ? styles.subTabActiveCompleted : ""}`}
              onClick={() => setArchiveSubTab("completed")}
            >
              <FiCheckCircle /> Đã hoàn thành
            </button>
            <button
              type="button"
              className={`${styles.subTabButton} ${archiveSubTab === "cancelled" ? styles.subTabActiveCancelled : ""}`}
              onClick={() => setArchiveSubTab("cancelled")}
            >
              <FiXCircle /> Đã hủy
            </button>
          </div>
        )}

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

        {loading ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400 text-sm">Đang tải danh sách giải đấu quản trị...</p>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center", border: "1px solid #e2e8f0", borderRadius: "16px", background: "#ffffff" }}>
            <p className="text-slate-400 text-sm">Không tìm thấy giải đấu nào.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên giải đấu</th>
                  <th>Ban tổ chức</th>
                  <th>Địa điểm</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "center" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredTournaments.map((t) => (
                  <tr key={t.TournamentID}>
                    <td style={{ color: "#94a3b8", fontWeight: "600" }}>#{t.TournamentID}</td>
                    <td style={{ fontWeight: "bold", color: "#0f172a" }}>{t.TournamentName}</td>
                    <td>{t.OrganizerName}</td>
                    <td>{t.Location}</td>
                    <td>
                      {formatDate(t.StartDate)} - {formatDate(t.EndDate)}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${
                        t.Status === "Draft"
                          ? styles.badgeDraft
                          : t.Status === "Open"
                          ? styles.badgePublished
                          : t.Status === "RegistrationClosed"
                          ? styles.badgeClosed
                          : t.Status === "Scheduled"
                          ? styles.badgeScheduled
                          : t.Status === "Ongoing"
                          ? styles.badgeOngoing
                          : t.Status === "Completed"
                          ? styles.badgeCompleted
                          : t.Status === "Cancelled"
                          ? styles.badgeCancelled
                          : styles.badgeDraft
                      }`}>
                        {t.Status === "Draft"
                          ? "Nháp"
                          : t.Status === "Open"
                          ? "Mở đăng ký"
                          : t.Status === "RegistrationClosed"
                          ? "Đóng đăng ký"
                          : t.Status === "Scheduled"
                          ? "Đã xếp lịch"
                          : t.Status === "Ongoing"
                          ? "Đang diễn ra"
                          : t.Status === "Completed"
                          ? "Đã hoàn thành"
                          : t.Status === "Cancelled"
                          ? "Đã hủy"
                          : t.Status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionBtns}>
                        <Link href={`/admin/tournaments/${t.TournamentID}/manage`} className={styles.btnManage}>
                          ⚙️ Điều hành
                        </Link>
                        {!isStaff && (
                          <>
                            <button onClick={() => handleOpenEdit(t)} className={styles.btnEdit}>
                              Sửa
                            </button>
                            {(t.Status === "Draft" || t.Status === "Open" || (t.Status !== "Cancelled" && t.Status !== "Completed")) && (
                              <div className={styles.dropdownContainer}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownId(activeDropdownId === t.TournamentID ? null : t.TournamentID);
                                  }}
                                  className={styles.btnMore}
                                >
                                  •••
                                </button>
                                {activeDropdownId === t.TournamentID && (
                                  <div className={styles.dropdownMenu}>
                                    {t.Status === "Draft" && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handlePublish(t.TournamentID)}
                                          className={`${styles.dropdownItem} ${styles.dropdownItemSuccess}`}
                                        >
                                          🚀 Công bố
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDelete(t.TournamentID)}
                                          className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                                        >
                                          🗑️ Xóa nháp
                                        </button>
                                      </>
                                    )}
                                    {t.Status === "Open" && (
                                      <button
                                        type="button"
                                        onClick={() => handleClose(t.TournamentID)}
                                        className={styles.dropdownItem}
                                      >
                                        🔒 Đóng ĐK
                                      </button>
                                    )}
                                    {t.Status !== "Cancelled" && t.Status !== "Completed" && (
                                      <button
                                        type="button"
                                        onClick={() => handleCancel(t.TournamentID)}
                                        className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                                      >
                                        🚫 Hủy giải
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleSave} className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingId ? "Cập nhật thông tin giải đấu" : "Tạo giải đấu nháp mới"}
              </h3>
              <button type="button" className={styles.modalClose} onClick={() => setModalOpen(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              {error && (
                <div style={{ color: "#ef4444", background: "#fef2f2", border: "1px solid #fee2e2", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px", fontWeight: "600", textAlign: "center" }}>
                  ⚠️ {error}
                </div>
              )}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tên giải đấu</label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  value={formData.tournamentName}
                  onChange={(e) => setFormData({ ...formData, tournamentName: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Ảnh banner giải đấu</label>
                {formData.imageURL ? (
                  <div className={styles.bannerPreviewContainer}>
                    <img src={formData.imageURL} alt="Banner Preview" className={styles.bannerPreview} />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, imageURL: "" }))}
                      className={styles.btnRemoveBanner}
                    >
                      Gỡ ảnh banner
                    </button>
                  </div>
                ) : (
                  <div className={styles.uploadBox}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      id="banner-upload"
                      className={styles.uploadInput}
                      disabled={uploading}
                    />
                    <label htmlFor="banner-upload" className={styles.uploadLabel}>
                      {uploading ? (
                        <span>⏳ Đang tải ảnh lên...</span>
                      ) : (
                        <span>📸 Chọn ảnh làm banner (JPG, PNG, WEBP tối đa 5MB)</span>
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Mô tả ngắn</label>
                <textarea
                  className={styles.formTextarea}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Ngày bắt đầu</label>
                  <input
                    type="date"
                    required
                    className={styles.formInput}
                    min={formData.registrationEnd || todayVN()}
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Ngày kết thúc</label>
                  <input
                    type="date"
                    required
                    className={styles.formInput}
                    min={formData.startDate || todayVN()}
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Bắt đầu mở đăng ký</label>
                  <input
                    type="date"
                    required
                    className={styles.formInput}
                    min={todayVN()}
                    value={formData.registrationStart}
                    onChange={(e) => setFormData({ ...formData, registrationStart: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Hạn đóng đăng ký</label>
                  <input
                    type="date"
                    required
                    className={styles.formInput}
                    min={formData.registrationStart || todayVN()}
                    value={formData.registrationEnd}
                    onChange={(e) => setFormData({ ...formData, registrationEnd: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Địa điểm tổ chức</label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Ban tổ chức</label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  value={formData.organizerName}
                  onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Cơ cấu giải thưởng</label>
                <textarea
                  rows={3}
                  className={styles.formTextarea}
                  placeholder="Nhập thông tin giải thưởng, hiện vật, tiền thưởng..."
                  value={formData.prizeInfo}
                  onChange={(e) => setFormData({ ...formData, prizeInfo: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Quy chế / Quy định giải</label>
                <textarea
                  rows={4}
                  className={styles.formTextarea}
                  placeholder="Nhập điều lệ thi đấu, quy định check-in, trang phục..."
                  value={formData.rules}
                  onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setModalOpen(false)} className={styles.btnCancelModal}>
                Hủy
              </button>
              <button type="submit" className={styles.btnSaveModal}>
                Lưu giải đấu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
