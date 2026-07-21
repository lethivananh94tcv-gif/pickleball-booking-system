"use client";

import React, { useState, useEffect } from "react";
import * as api from "@/services/matchingApi";
import styles from "./MatchingLayout.module.css";

interface GroupsTabProps {
  token: string;
  userProfile: api.PlayerProfile | null;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function GroupsTab({ token, userProfile, showToast }: GroupsTabProps) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<api.PlayGroup[]>([]);
  const [editingGroup, setEditingGroup] = useState<api.PlayGroup | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [chatGroup, setChatGroup] = useState<api.PlayGroup | null>(null);
  const [messages, setMessages] = useState<api.GroupMessage[]>([]);
  const [chatContent, setChatContent] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const chatInputRef = React.useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async (groupId: number) => {
    try {
      const data = await api.getGroupMessages(token, groupId);
      setMessages(data || []);
    } catch (err: any) {
      showToast(err.message || "Không thể tải tin nhắn", "error");
    }
  };

  const handleOpenChat = async (group: api.PlayGroup) => {
    setChatGroup(group);
    setMessages([]);
    loadMessages(group.GroupID);
    try {
      await api.markGroupMessagesAsRead(token, group.GroupID);
      setUnreadCounts(prev => ({ ...prev, [group.GroupID]: 0 }));
      window.dispatchEvent(new Event("invitation-count-change"));
    } catch (err) {}
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (chatGroup) {
      interval = setInterval(async () => {
        try {
          const data = await api.getGroupMessages(token, chatGroup.GroupID);
          setMessages(data || []);
          await api.markGroupMessagesAsRead(token, chatGroup.GroupID);
          window.dispatchEvent(new Event("invitation-count-change"));
        } catch (error) {
          // Silent fail on polling errors to avoid UI toast spam
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [chatGroup, token]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatGroup || !chatContent.trim() || sendingMessage) return;

    try {
      setSendingMessage(true);
      const newMsg = await api.sendGroupMessage(token, chatGroup.GroupID, chatContent);
      setMessages((prev) => [...prev, newMsg]);
      setChatContent("");
      requestAnimationFrame(() => {
        chatInputRef.current?.focus();
      });
    } catch (err: any) {
      showToast(err.message || "Gửi tin nhắn thất bại", "error");
    } finally {
      setSendingMessage(false);
    }
  };

  // Form states for Edit Group
  const [editForm, setEditForm] = useState({
    groupName: "",
    skillLevel: "Intermediate",
    averageExperience: 1,
    description: "",
    status: "Open",
  });

  // Form states for Create Group
  const [createForm, setCreateForm] = useState({
    groupName: "",
    skillLevel: "Intermediate",
    description: "",
  });

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await api.getUserGroups(token);
      setGroups(data || []);
    } catch (err: any) {
      showToast(err.message || "Không thể tải danh sách nhóm chơi", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCounts = async () => {
    try {
      const counts = await api.getUnreadGroupChatCounts(token);
      const countsMap: Record<number, number> = {};
      counts.groups.forEach(g => {
        countsMap[g.groupId] = g.unreadCount;
      });
      setUnreadCounts(countsMap);
    } catch (err) {}
  };

  useEffect(() => {
    loadGroups();
    loadUnreadCounts();

    const interval = setInterval(() => {
      loadUnreadCounts();
    }, 15000);

    return () => clearInterval(interval);
  }, [token]);

  const handleOpenEdit = (group: api.PlayGroup) => {
    setEditingGroup(group);
    setEditForm({
      groupName: group.GroupName || "",
      skillLevel: group.SkillLevel || "Intermediate",
      averageExperience: group.AverageExperience || 1,
      description: group.Description || "",
      status: group.Status || "Open",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    try {
      await api.updateGroup(token, editingGroup.GroupID, {
        groupName: editForm.groupName,
        skillLevel: editForm.skillLevel,
        averageExperience: Number(editForm.averageExperience),
        description: editForm.description,
        status: editForm.status,
      });

      // Update state locally for instant UI update
      setGroups((prevGroups) =>
        prevGroups.map((g) =>
          g.GroupID === editingGroup.GroupID
            ? {
                ...g,
                Status: editForm.status,
                GroupName: editForm.groupName,
                SkillLevel: editForm.skillLevel,
                AverageExperience: Number(editForm.averageExperience),
                Description: editForm.description,
              }
            : g
        )
      );

      showToast("Cập nhật thông tin nhóm thành công!");
      setEditingGroup(null);
      loadGroups();
    } catch (err: any) {
      showToast(err.message || "Cập nhật nhóm thất bại", "error");
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createGroup(token, {
        groupName: createForm.groupName,
        skillLevel: createForm.skillLevel,
        description: createForm.description,
      });
      showToast("Tạo nhóm chơi bóng thành công!");
      setShowCreateModal(false);
      setCreateForm({ groupName: "", skillLevel: "Intermediate", description: "" });
      loadGroups();
    } catch (err: any) {
      showToast(err.message || "Tạo nhóm thất bại", "error");
    }
  };

  const handleLeaveGroup = async (groupId: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm này không?")) return;
    try {
      await api.leaveGroup(token, groupId);
      showToast("Rời nhóm thành công!");
      loadGroups();
    } catch (err: any) {
      showToast(err.message || "Rời nhóm chơi thất bại", "error");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h3 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Nhóm chơi bóng</h3>
          <p style={{ fontSize: "14px", color: "var(--pcs-neutral-600)", marginTop: "0.25rem" }}>Quản lý hoặc tham gia các nhóm chơi bóng để cùng luyện tập và thi đấu.</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setShowCreateModal(true)}>
          + Tạo nhóm mới
        </button>
      </div>

      {loading ? (
        <div className={styles.loadingInner}>Đang tải danh sách nhóm chơi...</div>
      ) : groups.length === 0 ? (
        <div className={styles.emptyState}>Bạn chưa tham gia nhóm chơi bóng nào. Hãy tạo nhóm hoặc tham gia lời mời ghép cặp!</div>
      ) : (
        <div className={styles.gridList}>
          {groups.map((group) => {
            const isLeader = userProfile && group.CreatorID === userProfile.UserID;

            return (
              <div className={styles.card} key={group.GroupID}>
                <div>
                  <div className={styles.cardHeader}>
                    <div>
                      <h4 className={styles.cardName}>{group.GroupName}</h4>
                      <span className={styles.cardTag} style={{ backgroundColor: "var(--pcs-brand-primary-light)", color: "var(--pcs-brand-primary-hover)" }}>
                        Trưởng nhóm: {isLeader ? "Tôi" : (group.CreatorName || "Ẩn danh")}
                      </span>
                    </div>
                    <span
                      className={styles.cardTag}
                      style={{
                        backgroundColor: group.Status === "Open" ? "var(--pcs-brand-primary-light)" : "var(--pcs-status-error-bg)",
                        color: group.Status === "Open" ? "var(--pcs-status-success)" : "var(--pcs-status-error)",
                        fontWeight: "600",
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {group.Status === "Open" ? "Hoạt động" : "Đã đóng"}
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardMetaItem}>
                      <strong>Yêu cầu trình độ:</strong>
                      <span>{group.SkillLevel}</span>
                    </div>
                    <div className={styles.cardMetaItem}>
                      <strong>Kinh nghiệm trung bình:</strong>
                      <span>{group.AverageExperience || 0} năm</span>
                    </div>
                    <div className={styles.cardMetaItem}>
                      <strong>Số thành viên:</strong>
                      <span>{group.CurrentPlayers} / {group.MaxPlayers || 4}</span>
                    </div>
                    {group.Description && (
                      <div className={styles.cardMetaItem} style={{ flexDirection: "column", gap: "0.125rem", marginTop: "0.5rem" }}>
                        <strong>Mô tả nhóm:</strong>
                        <span style={{ color: "var(--pcs-neutral-600)", fontSize: "13px" }}>{group.Description}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <button
                    onClick={() => handleOpenChat(group)}
                    className={styles.secondaryBtn}
                    style={{ flex: 1, backgroundColor: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd", position: "relative" }}
                  >
                    💬 Chat nhóm
                    {unreadCounts[group.GroupID] > 0 && (
                      <span style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        backgroundColor: "var(--pcs-status-error)",
                        color: "white",
                        fontSize: "11px",
                        fontWeight: "bold",
                        borderRadius: "50%",
                        padding: "2px 6px",
                        minWidth: "20px",
                        textAlign: "center"
                      }}>
                        {unreadCounts[group.GroupID] > 9 ? "9+" : unreadCounts[group.GroupID]}
                      </span>
                    )}
                  </button>
                  {isLeader ? (
                    <button
                      onClick={() => handleOpenEdit(group)}
                      className={styles.secondaryBtn}
                      style={{ flex: 1 }}
                    >
                      ⚙️ Chỉnh sửa nhóm
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLeaveGroup(group.GroupID)}
                      className={styles.secondaryBtn}
                      style={{ flex: 1, color: "var(--pcs-status-error)", borderColor: "var(--pcs-status-error-border, #fecaca)" }}
                    >
                      Rời nhóm
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>Tạo nhóm chơi mới</h4>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Tên nhóm:</label>
                <input
                  type="text"
                  value={createForm.groupName}
                  onChange={(e) => setCreateForm({ ...createForm, groupName: e.target.value })}
                  placeholder="Ví dụ: Team phong trào Hải Châu..."
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Trình độ nhóm:</label>
                <select
                  value={createForm.skillLevel}
                  onChange={(e) => setCreateForm({ ...createForm, skillLevel: e.target.value })}
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

              <div className={styles.formGroup}>
                <label className={styles.label}>Mô tả nhóm:</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Mô tả phong cách chơi, địa điểm hay sinh hoạt của nhóm..."
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={styles.secondaryBtn}
                >
                  Hủy
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  Tạo nhóm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT GROUP MODAL */}
      {editingGroup && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>Chỉnh sửa thông tin nhóm</h4>
              <button className={styles.closeBtn} onClick={() => setEditingGroup(null)}>×</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Tên nhóm:</label>
                <input
                  type="text"
                  value={editForm.groupName}
                  onChange={(e) => setEditForm({ ...editForm, groupName: e.target.value })}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Trình độ:</label>
                <select
                  value={editForm.skillLevel}
                  onChange={(e) => setEditForm({ ...editForm, skillLevel: e.target.value })}
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

              <div className={styles.formGroup}>
                <label className={styles.label}>Kinh nghiệm trung bình (năm):</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.averageExperience}
                  onChange={(e) => setEditForm({ ...editForm, averageExperience: Number(e.target.value) })}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Trạng thái hoạt động:</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className={styles.select}
                >
                  <option value="Open">Hoạt động (Open)</option>
                  <option value="Closed">Đã đóng (Closed)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Mô tả nhóm:</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className={styles.secondaryBtn}
                >
                  Hủy
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHAT MODAL */}
      {chatGroup && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ display: "flex", flexDirection: "column", height: "600px", maxHeight: "90vh" }}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>💬 Chat: {chatGroup.GroupName}</h4>
              <button className={styles.closeBtn} onClick={() => setChatGroup(null)}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "1rem", backgroundColor: "var(--pcs-neutral-50)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--pcs-neutral-600)", marginTop: "2rem" }}>
                  Chưa có tin nhắn nào. Hãy gửi lời chào đến mọi người!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.IsMine;
                  return (
                    <div key={msg.MessageID} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
                      {!isMine && <span style={{ fontSize: "12px", color: "var(--pcs-neutral-600)", marginBottom: "0.25rem", marginLeft: "0.25rem" }}>{msg.SenderName}</span>}
                      <div style={{
                        maxWidth: "75%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "12px",
                        backgroundColor: isMine ? "#3b82f6" : "#ffffff",
                        color: isMine ? "#ffffff" : "var(--pcs-neutral-900)",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        border: isMine ? "none" : "1px solid var(--pcs-neutral-200)",
                        wordBreak: "break-word"
                      }}>
                        {msg.Content}
                      </div>
                      <span style={{ fontSize: "10px", color: "var(--pcs-neutral-400)", marginTop: "0.25rem" }}>
                        {new Date(msg.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: "1rem", borderTop: "1px solid var(--pcs-neutral-200)", backgroundColor: "#ffffff" }}>
              <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatContent}
                  onChange={(e) => setChatContent(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  className={styles.input}
                  style={{ flex: 1, marginBottom: 0 }}
                  maxLength={1000}
                />
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={sendingMessage || !chatContent.trim()}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {sendingMessage ? "..." : "Gửi"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
