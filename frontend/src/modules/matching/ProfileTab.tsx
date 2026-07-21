"use client";

import React, { useState, useEffect } from "react";
import * as api from "@/services/matchingApi";
import styles from "./MatchingLayout.module.css";
import CustomTimePicker from "./components/CustomTimePicker";

interface ProfileTabProps {
  token: string;
  onProfileUpdated: (profile: api.PlayerProfile) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const timeOptions = Array.from({ length: (23 - 5) * 4 + 1 }, (_, i) => {
  const totalMinutes = 5 * 60 + i * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

export default function ProfileTab({ token, onProfileUpdated, showToast }: ProfileTabProps) {
  const [loading, setLoading] = useState(false);
  const [profileForm, setProfileForm] = useState<api.PlayerProfile>({
    PlayingRole: "All-rounder",
    ExperienceYears: 1,
    SkillLevel: "Intermediate",
    PlayStyle: "",
    Goal: "",
    MatchingStatus: "Available",
    AvailableStartTime: "08:00",
    AvailableEndTime: "10:00",
  });

  const [errors, setErrors] = useState<{ playStyle?: boolean; goal?: boolean }>({});

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await api.getPlayerProfile(token);
        if (data) {
          setProfileForm({
            PlayingRole: data.PlayingRole || "All-rounder",
            ExperienceYears: data.ExperienceYears || 0,
            SkillLevel: data.SkillLevel || "Intermediate",
            PlayStyle: data.PlayStyle || "",
            Goal: data.Goal || "",
            MatchingStatus: data.MatchingStatus || "Available",
            AvailableStartTime: formatTimeForInput(data.AvailableStartTime, "08:00"),
            AvailableEndTime: formatTimeForInput(data.AvailableEndTime, "10:00"),
          });
          onProfileUpdated(data);
        }
      } catch (err: any) {
        showToast(err.message || "Không thể tải hồ sơ chơi bóng", "error");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token]);

  function formatTimeForInput(timeVal: any, defaultVal = ""): string {
    if (!timeVal) return defaultVal;
    const valStr = String(timeVal);
    if (valStr.includes("T")) {
      const parts = valStr.split("T")[1];
      return parts ? parts.substring(0, 5) : valStr.substring(0, 5);
    }
    return valStr.substring(0, 5);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset previous errors
    const newErrors: { playStyle?: boolean; goal?: boolean } = {};
    if (!profileForm.PlayStyle || !profileForm.PlayStyle.trim()) {
      newErrors.playStyle = true;
    }
    if (!profileForm.Goal || !profileForm.Goal.trim()) {
      newErrors.goal = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast("Vui lòng nhập phong cách chơi và mục tiêu tập luyện để tìm được người chơi tối ưu nhất cho bạn!", "error");
      return;
    }
    setErrors({});

    if (!profileForm.AvailableStartTime || !profileForm.AvailableStartTime.trim()) {
      showToast("Vui lòng nhập giờ bắt đầu rảnh.", "error");
      return;
    }
    if (!profileForm.AvailableEndTime || !profileForm.AvailableEndTime.trim()) {
      showToast("Vui lòng nhập giờ kết thúc rảnh.", "error");
      return;
    }

    const start = profileForm.AvailableStartTime.trim().substring(0, 5);
    const end = profileForm.AvailableEndTime.trim().substring(0, 5);

    if (start >= end) {
      showToast("Giờ kết thúc phải lớn hơn giờ bắt đầu.", "error");
      return;
    }

    try {
      setLoading(true);
      const payload: api.PlayerProfile = {
        ...profileForm,
        PlayingRole: profileForm.PlayingRole,
        ExperienceYears: Number(profileForm.ExperienceYears),
        SkillLevel: profileForm.SkillLevel,
        PlayStyle: profileForm.PlayStyle || "",
        Goal: profileForm.Goal || "",
        MatchingStatus: profileForm.MatchingStatus,
        AvailableStartTime: start,
        AvailableEndTime: end,
      };

      const saved = await api.savePlayerProfile(token, payload);
      setProfileForm({
        ...saved,
        AvailableStartTime: formatTimeForInput(saved.AvailableStartTime, "08:00"),
        AvailableEndTime: formatTimeForInput(saved.AvailableEndTime, "10:00"),
      });
      onProfileUpdated(saved);
      showToast("Cập nhật hồ sơ chơi bóng thành công!");
    } catch (err: any) {
      showToast(err.message || "Cập nhật hồ sơ thất bại", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "1.5rem" }}>Hồ sơ chơi bóng của tôi</h3>
      {loading && <div className={styles.loadingInner}>Đang tải dữ liệu hồ sơ...</div>}
      
      <form onSubmit={handleSave} style={{ display: loading ? "none" : "block" }}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Vai trò thi đấu (Playing Role)</label>
            <select
              value={profileForm.PlayingRole}
              onChange={(e) => setProfileForm({ ...profileForm, PlayingRole: e.target.value })}
              className={styles.select}
            >
              <option value="All-rounder">Toàn diện (All-rounder)</option>
              <option value="Attacker">Tấn công (Attacker)</option>
              <option value="Defender">Phòng thủ (Defender)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Trình độ (Skill Level)</label>
            <select
              value={profileForm.SkillLevel}
              onChange={(e) => setProfileForm({ ...profileForm, SkillLevel: e.target.value })}
              className={styles.select}
            >
              <option value="Beginner">🟢 Mới bắt đầu — Beginner (2.0 - 2.5)</option>
              <option value="Novice">🔵 Sơ cấp — Novice (2.5 - 3.0)</option>
              <option value="Intermediate">🟡 Trung bình — Intermediate (3.0 - 3.5)</option>
              <option value="Advanced Intermediate">🟠 Khá — Advanced Intermediate (3.5 - 4.0)</option>
              <option value="Advanced">🔴 Giỏi — Advanced (4.0 - 4.5)</option>
              <option value="Expert">🟣 Cao thủ — Expert (4.5 - 5.0)</option>
              <option value="Professional">⭐ Chuyên nghiệp — Professional (5.0+)</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Số năm kinh nghiệm</label>
            <input
              type="number"
              min="0"
              value={profileForm.ExperienceYears}
              onChange={(e) => setProfileForm({ ...profileForm, ExperienceYears: Number(e.target.value) })}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Trạng thái Matching</label>
            <select
              value={profileForm.MatchingStatus}
              onChange={(e) => setProfileForm({ ...profileForm, MatchingStatus: e.target.value })}
              className={styles.select}
            >
              <option value="Available">Sẵn sàng ghép cặp (Available)</option>
              <option value="Busy">Bận (Busy)</option>
              <option value="Unavailable">Không hoạt động (Unavailable)</option>
              <option value="Hidden">Ẩn hồ sơ (Hidden)</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Thời gian rảnh bắt đầu <span style={{ color: "var(--pcs-status-error)" }}>*</span></label>
            <CustomTimePicker
              value={profileForm.AvailableStartTime || ""}
              onChange={(val) => setProfileForm({ ...profileForm, AvailableStartTime: val })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Thời gian rảnh kết thúc <span style={{ color: "var(--pcs-status-error)" }}>*</span></label>
            <CustomTimePicker
              value={profileForm.AvailableEndTime || ""}
              onChange={(val) => setProfileForm({ ...profileForm, AvailableEndTime: val })}
              required
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Phong cách chơi (Play Style) <span style={{ color: "var(--pcs-status-error)" }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Ví dụ: Thích ép trái bóng, tấn công nhanh, bám lưới..."
            value={profileForm.PlayStyle || ""}
            onChange={(e) => {
              setProfileForm({ ...profileForm, PlayStyle: e.target.value });
              if (e.target.value.trim()) {
                setErrors((prev) => ({ ...prev, playStyle: false }));
              }
            }}
            className={styles.input}
            style={errors.playStyle ? { borderColor: "var(--pcs-status-error)", boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.15)" } : undefined}
          />
          {errors.playStyle && (
            <span style={{ color: "var(--pcs-status-error)", fontSize: "12px", fontWeight: "500", marginTop: "2px" }}>
              Vui lòng nhập phong cách chơi để tìm đồng đội phù hợp nhất
            </span>
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Mục tiêu tập luyện/thi đấu (Goal) <span style={{ color: "var(--pcs-status-error)" }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Ví dụ: Tìm đối tác lên trình nhanh, giao lưu vui vẻ..."
            value={profileForm.Goal || ""}
            onChange={(e) => {
              setProfileForm({ ...profileForm, Goal: e.target.value });
              if (e.target.value.trim()) {
                setErrors((prev) => ({ ...prev, goal: false }));
              }
            }}
            className={styles.input}
            style={errors.goal ? { borderColor: "var(--pcs-status-error)", boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.15)" } : undefined}
          />
          {errors.goal && (
            <span style={{ color: "var(--pcs-status-error)", fontSize: "12px", fontWeight: "500", marginTop: "2px" }}>
              Vui lòng nhập mục tiêu tập luyện/thi đấu để AI đề xuất chính xác
            </span>
          )}
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <button type="submit" className={styles.primaryBtn} disabled={loading}>
            {loading ? "Đang lưu..." : "Cập nhật hồ sơ"}
          </button>
        </div>
      </form>
    </div>
  );
}
