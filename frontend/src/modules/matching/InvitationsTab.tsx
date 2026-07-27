"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/services/matchingApi";
import styles from "./MatchingLayout.module.css";

interface InvitationsTabProps {
  token: string;
  onActionSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function InvitationsTab({ token, onActionSuccess, showToast }: InvitationsTabProps) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<"received" | "sent">("received");
  const [received, setReceived] = useState<api.PlayInvitation[]>([]);
  const [sent, setSent] = useState<api.PlayInvitation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      if (subTab === "received") {
        const data = await api.getReceivedInvitations(token);
        setReceived(data || []);
      } else {
        const data = await api.getSentInvitations(token);
        setSent(data || []);
      }
    } catch (err: any) {
      showToast(err.message || "Không thể tải danh sách lời mời", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, [token, subTab]);

  const handleAccept = async (invitationId: number) => {
    try {
      await api.acceptInvitation(token, invitationId);
      showToast("Chấp nhận lời mời thành công!");
      window.dispatchEvent(new Event("invitation-count-change"));
      onActionSuccess();
      loadInvitations();
    } catch (err: any) {
      showToast(err.message || "Chấp nhận lời mời thất bại", "error");
    }
  };

  const handleReject = async (invitationId: number) => {
    try {
      await api.rejectInvitation(token, invitationId);
      showToast("Đã từ chối lời mời.");
      window.dispatchEvent(new Event("invitation-count-change"));
      onActionSuccess();
      loadInvitations();
    } catch (err: any) {
      showToast(err.message || "Từ chối lời mời thất bại", "error");
    }
  };

  function getStatusLabel(status: string) {
    switch (status) {
      case "Pending":
        return <span style={{ color: "var(--pcs-status-warning)", fontWeight: "600" }}>Chờ xử lý</span>;
      case "Accepted":
        return <span style={{ color: "var(--pcs-brand-primary-hover)", fontWeight: "600" }}>Đã đồng ý</span>;
      case "Rejected":
        return <span style={{ color: "var(--pcs-status-error)", fontWeight: "600" }}>Đã từ chối</span>;
      case "Cancelled":
        return <span style={{ color: "var(--pcs-neutral-400)", fontWeight: "600" }}>Đã hủy</span>;
      case "Expired":
        return <span style={{ color: "var(--pcs-neutral-400)", fontWeight: "600" }}>Hết hạn</span>;
      default:
        return <span>{status}</span>;
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", borderBottom: "2px solid var(--pcs-neutral-100)", marginBottom: "1.5rem" }}>
        <button
          onClick={() => setSubTab("received")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: subTab === "received" ? "2px solid var(--pcs-brand-primary)" : "none",
            color: subTab === "received" ? "var(--pcs-brand-primary-hover)" : "var(--pcs-neutral-600)",
            fontWeight: subTab === "received" ? "600" : "500",
            cursor: "pointer",
            fontSize: "15px",
          }}
        >
          Lời mời đã nhận
        </button>
        <button
          onClick={() => setSubTab("sent")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: subTab === "sent" ? "2px solid var(--pcs-brand-primary)" : "none",
            color: subTab === "sent" ? "var(--pcs-brand-primary-hover)" : "var(--pcs-neutral-600)",
            fontWeight: subTab === "sent" ? "600" : "500",
            cursor: "pointer",
            fontSize: "15px",
          }}
        >
          Lời mời đã gửi
        </button>
      </div>

      {loading ? (
        <div className={styles.loadingInner}>Đang tải danh sách lời mời...</div>
      ) : subTab === "received" ? (
        received.length === 0 ? (
          <div className={styles.emptyState}>Hộp thư của bạn trống. Không có lời mời nhận được nào.</div>
        ) : (
          <div className={styles.gridList}>
            {received.map((inv) => (
              <div className={styles.card} key={inv.InvitationID}>
                <div>
                  {inv.InvitationType === "InviteOpponent" && inv.Status === "Accepted" && (
                    <div style={{
                      backgroundColor: "var(--pcs-brand-primary-light)",
                      color: "var(--pcs-brand-primary-hover)",
                      padding: "0.5rem",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      marginBottom: "0.75rem",
                      textAlign: "center"
                    }}>
                      Lịch thách đấu đã chấp nhận
                    </div>
                  )}
                  <div className={styles.cardHeader}>
                    <div className={styles.avatarWrap}>
                      {inv.SenderAvatar ? (
                        <img src={inv.SenderAvatar} alt={inv.SenderName} className={styles.avatar} />
                      ) : (
                        <div className={styles.avatarPlaceholder}>
                          {inv.SenderName ? inv.SenderName.charAt(0).toUpperCase() : "S"}
                        </div>
                      )}
                      <div>
                        <h4 className={styles.cardName}>{inv.SenderName || inv.SenderEmail}</h4>
                        <span className={styles.cardTag}>
                          {inv.InvitationType === "InviteToPlay" ? "Ghép đôi đồng đội" : inv.InvitationType === "RequestJoinGroup" ? "Xin gia nhập nhóm" : inv.InvitationType === "InviteToGroup" ? "Mời vào nhóm" : "Thách đấu nhóm"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardBody} style={{ backgroundColor: "var(--pcs-neutral-50)", padding: "0.75rem", borderRadius: "8px", marginBottom: "0.5rem" }}>
                    <p style={{ margin: 0, fontSize: "13px", fontStyle: "italic", color: "var(--pcs-neutral-600)" }}>
                      "{inv.Message || "Không có lời nhắn."}"
                    </p>
                  </div>
                  
                  {inv.InvitationType !== "InviteOpponent" && (() => {
                    const skill = inv.SenderSkillLevel;
                    const exp = inv.SenderExperienceYears;
                    const start = inv.SenderStartTime;
                    const end = inv.SenderEndTime;

                    if (!skill && !(start && end)) return null;

                    return (
                      <div style={{ fontSize: "13px", color: "var(--pcs-neutral-700)", display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.6rem", backgroundColor: "var(--pcs-neutral-100)", borderRadius: "6px", marginBottom: "0.5rem" }}>
                        {skill && (
                          <div>Trình độ: <strong style={{ color: "var(--pcs-neutral-900)" }}>{skill}</strong>{exp !== undefined && exp !== null ? ` (${exp} năm KN)` : ""}</div>
                        )}
                        {start && end && (
                          <div>Khung giờ rảnh: <strong style={{ color: "var(--pcs-brand-primary-hover)" }}>{start} - {end}</strong></div>
                        )}
                      </div>
                    );
                  })()}

                  {inv.InvitationType === "InviteOpponent" && (
                    <div style={{ fontSize: "13px", color: "var(--pcs-neutral-600)", display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.5rem", backgroundColor: "var(--pcs-neutral-100)", borderRadius: "6px", marginBottom: "0.5rem" }}>
                      {inv.GroupName && (
                        <div>Nhóm gửi thách đấu: <strong style={{ color: "var(--pcs-neutral-900)" }}>{inv.GroupName}</strong></div>
                      )}
                      <div>Nhóm nhận thách đấu: <strong style={{ color: "var(--pcs-neutral-900)" }}>{inv.ReceiverGroupName || inv.ReceiverName || "Nhóm đối thủ"}</strong></div>
                      {inv.ChallengeDate && (
                        <div>Ngày thi đấu đề xuất: <strong style={{ color: "var(--pcs-neutral-900)" }}>{inv.ChallengeDate}</strong></div>
                      )}
                      {inv.ChallengeStartTime && inv.ChallengeEndTime && (
                        <div>Giờ thi đấu: <strong style={{ color: "var(--pcs-neutral-900)" }}>{inv.ChallengeStartTime} - {inv.ChallengeEndTime}</strong></div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {inv.Status === "Pending" ? (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleAccept(inv.InvitationID)}
                        className={styles.primaryBtn}
                        style={{ flex: 1 }}
                      >
                        Đồng ý
                      </button>
                      <button
                        onClick={() => handleReject(inv.InvitationID)}
                        className={styles.secondaryBtn}
                        style={{ flex: 1, color: "var(--pcs-status-error)", borderColor: "var(--pcs-status-error-border, #fecaca)" }}
                      >
                        Từ chối
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ textAlign: "center", width: "100%", padding: "0.5rem 0", fontSize: "14px" }}>
                        Trạng thái: {getStatusLabel(inv.Status)}
                      </div>
                      {inv.InvitationType === "InviteOpponent" && inv.Status === "Accepted" && (
                        <div style={{
                          width: "100%",
                          fontSize: "13px",
                          color: "var(--pcs-brand-primary-hover, #047857)",
                          backgroundColor: "var(--pcs-brand-primary-light, #ecfdf5)",
                          padding: "0.625rem 0.75rem",
                          borderRadius: "8px",
                          textAlign: "center",
                          border: "1px solid var(--pcs-brand-primary-border, #a7f3d0)",
                          lineHeight: "1.4"
                        }}>
                          <strong>Đã chấp nhận thách đấu!</strong><br />
                          <span style={{ fontSize: "12px", color: "var(--pcs-neutral-600)" }}>
                            Box chat thách đấu đã được tạo bên tab <strong>Box chat</strong>. Hai bên có thể liên lạc, trao đổi qua box chat để thống nhất đặt sân!
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        sent.length === 0 ? (
          <div className={styles.emptyState}>Bạn chưa gửi bất kỳ lời mời ghép cặp nào.</div>
        ) : (
          <div className={styles.gridList}>
            {sent.map((inv) => (
              <div className={styles.card} key={inv.InvitationID}>
                <div>
                  {inv.InvitationType === "InviteOpponent" && inv.Status === "Accepted" && (
                    <div style={{
                      backgroundColor: "var(--pcs-brand-primary-light)",
                      color: "var(--pcs-brand-primary-hover)",
                      padding: "0.5rem",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      marginBottom: "0.75rem",
                      textAlign: "center"
                    }}>
                      Lịch thách đấu đã chấp nhận
                    </div>
                  )}
                  <div className={styles.cardHeader}>
                    <div className={styles.avatarWrap}>
                      {inv.ReceiverAvatar ? (
                        <img src={inv.ReceiverAvatar} alt={inv.ReceiverName} className={styles.avatar} />
                      ) : (
                        <div className={styles.avatarPlaceholder}>
                          {inv.ReceiverName ? inv.ReceiverName.charAt(0).toUpperCase() : "R"}
                        </div>
                      )}
                      <div>
                        <h4 className={styles.cardName}>{inv.ReceiverName || inv.ReceiverEmail}</h4>
                        <span className={styles.cardTag}>
                          {inv.InvitationType === "InviteToPlay" ? "Ghép đôi đồng đội" : inv.InvitationType === "RequestJoinGroup" ? "Xin gia nhập nhóm" : inv.InvitationType === "InviteToGroup" ? "Mời vào nhóm" : "Thách đấu nhóm"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardBody} style={{ backgroundColor: "var(--pcs-neutral-50)", padding: "0.75rem", borderRadius: "8px", marginBottom: "0.5rem" }}>
                    <p style={{ margin: 0, fontSize: "13px", fontStyle: "italic", color: "var(--pcs-neutral-600)" }}>
                      "{inv.Message || "Không có lời nhắn."}"
                    </p>
                  </div>

                  {inv.InvitationType !== "InviteOpponent" && (() => {
                    const skill = inv.ReceiverSkillLevel;
                    const exp = inv.ReceiverExperienceYears;
                    const start = inv.ReceiverStartTime;
                    const end = inv.ReceiverEndTime;

                    if (!skill && !(start && end)) return null;

                    return (
                      <div style={{ fontSize: "13px", color: "var(--pcs-neutral-700)", display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.6rem", backgroundColor: "var(--pcs-neutral-100)", borderRadius: "6px", marginBottom: "0.5rem" }}>
                        {skill && (
                          <div>Trình độ: <strong style={{ color: "var(--pcs-neutral-900)" }}>{skill}</strong>{exp !== undefined && exp !== null ? ` (${exp} năm KN)` : ""}</div>
                        )}
                        {start && end && (
                          <div>Khung giờ rảnh: <strong style={{ color: "var(--pcs-brand-primary-hover)" }}>{start} - {end}</strong></div>
                        )}
                      </div>
                    );
                  })()}

                  {inv.InvitationType === "InviteOpponent" && (
                    <div style={{ fontSize: "13px", color: "var(--pcs-neutral-600)", display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.5rem", backgroundColor: "var(--pcs-neutral-100)", borderRadius: "6px", marginBottom: "0.5rem" }}>
                      {inv.GroupName && (
                        <div>Nhóm gửi thách đấu: <strong style={{ color: "var(--pcs-neutral-900)" }}>{inv.GroupName}</strong></div>
                      )}
                      <div>Nhóm nhận thách đấu: <strong style={{ color: "var(--pcs-neutral-900)" }}>{inv.ReceiverGroupName || inv.ReceiverName || "Nhóm đối thủ"}</strong></div>
                      {inv.ChallengeDate && (
                        <div>Ngày thi đấu đề xuất: <strong style={{ color: "var(--pcs-neutral-900)" }}>{inv.ChallengeDate}</strong></div>
                      )}
                      {inv.ChallengeStartTime && inv.ChallengeEndTime && (
                        <div>Giờ thi đấu: <strong style={{ color: "var(--pcs-neutral-900)" }}>{inv.ChallengeStartTime} - {inv.ChallengeEndTime}</strong></div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem", borderTop: "1px dashed var(--pcs-neutral-200)", paddingTop: "0.75rem" }}>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: "13px", color: "var(--pcs-neutral-600)" }}>
                      Trạng thái: {getStatusLabel(inv.Status)}
                    </span>
                  </div>
                  {inv.InvitationType === "InviteOpponent" && inv.Status === "Accepted" && (
                    <div style={{
                      width: "100%",
                      fontSize: "13px",
                      color: "var(--pcs-brand-primary-hover, #047857)",
                      backgroundColor: "var(--pcs-brand-primary-light, #ecfdf5)",
                      padding: "0.625rem 0.75rem",
                      borderRadius: "8px",
                      textAlign: "center",
                      border: "1px solid var(--pcs-brand-primary-border, #a7f3d0)",
                      lineHeight: "1.4"
                    }}>
                      <strong>Đã chấp nhận thách đấu!</strong><br />
                      <span style={{ fontSize: "12px", color: "var(--pcs-neutral-600)" }}>
                        Box chat thách đấu đã được tạo bên tab <strong>Box chat</strong>. Hai bên có thể liên lạc, trao đổi qua box chat để thống nhất đặt sân!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
