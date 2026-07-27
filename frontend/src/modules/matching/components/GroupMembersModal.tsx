"use client";

import React from "react";
import styles from "../MatchingLayout.module.css";

interface GroupMembersModalProps {
  group: any | null;
  onClose: () => void;
}

export default function GroupMembersModal({ group, onClose }: GroupMembersModalProps) {
  if (!group) return null;

  const members = group.members || [];
  const isChallengeChat = group.IsChallengeChat || (group.GroupName && String(group.GroupName).includes("⚔️ Thách đấu"));

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modalContent} 
        style={{ maxWidth: "650px", width: "95%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h4 className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              👥 Danh sách thành viên
            </h4>
            <p style={{ fontSize: "13px", color: "var(--pcs-neutral-600)", margin: "4px 0 0 0", fontWeight: "normal" }}>
              {group.GroupName} ({members.length} người)
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {isChallengeChat && (
          <div style={{
            margin: "0 1.5rem 1rem 1.5rem",
            padding: "0.75rem 1rem",
            backgroundColor: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "10px",
            color: "#92400e",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{ fontSize: "18px" }}>⚔️</span>
            <span>
              <strong>Box Chat Chung Thách Đấu:</strong> Không gian bình đẳng không có trưởng nhóm. Toàn bộ thành viên hai bên tự do giao lưu và lên lịch thi đấu!
            </span>
          </div>
        )}

        <div style={{ padding: "0 1.5rem 1.5rem 1.5rem", overflowY: "auto", flex: 1 }}>
          {members.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: "2rem 1rem" }}>
              Chưa có thông tin chi tiết danh sách thành viên cho nhóm này.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {members.map((m: any, idx: number) => {
                const isLeader = !isChallengeChat && m.RoleInGroup === "Leader";
                const name = m.FullName || m.Email || "Tay vợt ẩn danh";
                const initial = name.charAt(0).toUpperCase();

                return (
                  <div 
                    key={m.GroupMemberID || m.UserID || idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.85rem 1rem",
                      backgroundColor: isLeader ? "#fffbeb" : "#f8fafc",
                      border: isLeader ? "1px solid #fde68a" : "1px solid var(--pcs-neutral-200)",
                      borderRadius: "12px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      flexWrap: "wrap",
                      gap: "10px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 200px" }}>
                      {m.AvatarURL ? (
                        <img 
                          src={m.AvatarURL} 
                          alt={name} 
                          style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover", border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }} 
                        />
                      ) : (
                        <div style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          backgroundColor: isLeader ? "#f59e0b" : "var(--pcs-brand-primary-light)",
                          color: isLeader ? "white" : "var(--pcs-brand-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "700",
                          fontSize: "18px"
                        }}>
                          {initial}
                        </div>
                      )}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: "700", fontSize: "15px", color: "var(--pcs-neutral-900)" }}>
                            {name}
                          </span>
                          {isLeader ? (
                            <span style={{
                              fontSize: "11px",
                              backgroundColor: "#fef3c7",
                              color: "#d97706",
                              border: "1px solid #fde68a",
                              padding: "2px 6px",
                              borderRadius: "6px",
                              fontWeight: "700"
                            }}>
                              👑 Trưởng nhóm
                            </span>
                          ) : (
                            <span style={{
                              fontSize: "11px",
                              backgroundColor: "#e0f2fe",
                              color: "#0369a1",
                              border: "1px solid #bae6fd",
                              padding: "2px 6px",
                              borderRadius: "6px",
                              fontWeight: "600"
                            }}>
                              👤 Thành viên
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--pcs-neutral-500)", marginTop: "2px" }}>
                          {m.PlayingRole || "Pickleball Player"} {m.JoinedAt ? `• Tham gia: ${new Date(m.JoinedAt).toLocaleDateString("vi-VN")}` : ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "13px" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "var(--pcs-neutral-500)", fontSize: "11px" }}>Trình độ</div>
                        <div style={{ fontWeight: "600", color: "var(--pcs-brand-primary-hover)" }}>
                          {m.SkillLevel ? `⚡ ${m.SkillLevel}` : "Chưa có"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", borderLeft: "1px solid var(--pcs-neutral-200)", paddingLeft: "16px" }}>
                        <div style={{ color: "var(--pcs-neutral-500)", fontSize: "11px" }}>Kinh nghiệm</div>
                        <div style={{ fontWeight: "600", color: "var(--pcs-neutral-800)" }}>
                          {m.ExperienceYears !== undefined && m.ExperienceYears !== null ? `${m.ExperienceYears} năm` : "--"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.modalFooter} style={{ borderTop: "1px solid var(--pcs-neutral-200)", padding: "1rem 1.5rem" }}>
          <button
            type="button"
            onClick={onClose}
            className={styles.primaryBtn}
            style={{ width: "100%" }}
          >
            Đóng danh sách
          </button>
        </div>
      </div>
    </div>
  );
}
