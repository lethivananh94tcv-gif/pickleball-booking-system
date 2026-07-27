"use client";

import React, { useState, useEffect, useRef } from "react";
import * as api from "@/services/matchingApi";
import styles from "./MatchingLayout.module.css";
import GroupMembersModal from "./components/GroupMembersModal";
import { database } from "@/services/firebase";
import { ref, onValue, off } from "firebase/database";

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
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<api.PlayGroup | null>(null);
  const [messages, setMessages] = useState<api.GroupMessage[]>([]);
  const [chatContent, setChatContent] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "leave" | "close";
    groupId: number;
    groupName: string;
    isLeader?: boolean;
    loading?: boolean;
  } | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<number, boolean>>({});
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const chatInputRef = React.useRef<HTMLInputElement>(null);
  const firebaseListenerRef = useRef<{ ref: any; callback: any } | null>(null);

  const toggleGroupOptions = (groupId: number) => {
    setExpandedGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async (groupId: number) => {
    try {
      // 1. Fetch initial messages from local SQL DB
      const data = await api.getGroupMessages(token, groupId);
      setMessages(data || []);

      // 2. Attach Firebase Realtime Database listener for new messages
      const messagesRef = ref(database, `group_messages/${groupId}`);
      
      if (firebaseListenerRef.current) {
        off(firebaseListenerRef.current.ref);
      }

      firebaseListenerRef.current = {
        ref: messagesRef,
        callback: onValue(messagesRef, (snapshot) => {
          const fbData = snapshot.val();
          if (fbData) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.MessageID));
              const newMsgs: api.GroupMessage[] = [];

              Object.keys(fbData).forEach((key) => {
                const item = fbData[key];
                const msgId = item.MessageID || key;
                if (!existingIds.has(msgId)) {
                  newMsgs.push({
                    MessageID: msgId,
                    GroupID: groupId,
                    SenderID: item.SenderID,
                    SenderName: item.SenderName,
                    SenderAvatar: item.SenderAvatar || "",
                    Content: item.Content,
                    CreatedAt: item.CreatedAt,
                    IsMine: item.SenderID === userProfile?.UserID
                  });
                }
              });

              if (newMsgs.length > 0) {
                newMsgs.sort((a, b) => new Date(a.CreatedAt).getTime() - new Date(b.CreatedAt).getTime());
                return [...prev, ...newMsgs];
              }
              return prev;
            });
          }
        })
      };
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

  // Clean up Firebase listener when chat modal is closed or component unmounted
  useEffect(() => {
    return () => {
      if (firebaseListenerRef.current) {
        off(firebaseListenerRef.current.ref);
        firebaseListenerRef.current = null;
      }
    };
  }, [chatGroup]);

  // Mark messages as read on opening chat or receiving new messages
  useEffect(() => {
    if (chatGroup && messages.length > 0) {
      api.markGroupMessagesAsRead(token, chatGroup.GroupID)
        .then(() => {
          setUnreadCounts(prev => ({ ...prev, [chatGroup.GroupID]: 0 }));
          window.dispatchEvent(new Event("invitation-count-change"));
        })
        .catch(() => {});
    }
  }, [chatGroup, messages.length, token]);

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

  const handleLeaveGroup = (groupId: number, isLeader: boolean, groupName?: string) => {
    setConfirmModal({
      isOpen: true,
      type: "leave",
      groupId,
      groupName: groupName || "Nhóm chơi bóng",
      isLeader,
    });
  };

  const handleCloseGroup = (groupId: number, groupName: string) => {
    setConfirmModal({
      isOpen: true,
      type: "close",
      groupId,
      groupName: groupName || "Nhóm chơi bóng",
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmModal) return;
    setConfirmModal((prev) => (prev ? { ...prev, loading: true } : null));
    try {
      if (confirmModal.type === "leave") {
        await api.leaveGroup(token, confirmModal.groupId);
        showToast("Rời nhóm thành công!");
      } else {
        await api.closeGroup(token, confirmModal.groupId);
        showToast("Giải tán nhóm thành công!");
      }
      setConfirmModal(null);
      loadGroups();
    } catch (err: any) {
      showToast(
        err.message ||
          (confirmModal.type === "leave"
            ? "Rời nhóm chơi thất bại"
            : "Giải tán nhóm thất bại"),
        "error"
      );
      setConfirmModal((prev) => (prev ? { ...prev, loading: false } : null));
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
            const isChallengeChat = group.IsChallengeChat === 1 || group.IsChallengeChat === true || group.Description?.includes("Box chat chung") || group.GroupName?.includes("Thách đấu");
            const isLeader = !isChallengeChat && userProfile && group.CreatorID === userProfile.UserID && group.MyRole !== "Member";

            return (
              <div className={styles.card} key={group.GroupID}>
                <div>
                  <div className={styles.cardHeader}>
                    <div>
                      <h4
                        className={styles.cardName}
                        onClick={() => toggleGroupOptions(group.GroupID)}
                        style={{
                          cursor: "pointer",
                          color: expandedGroupIds[group.GroupID] ? "var(--pcs-brand-primary-hover)" : "inherit",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          transition: "color 0.2s ease",
                          userSelect: "none"
                        }}
                        title="Bấm để xem các tùy chọn quản lý nhóm"
                      >
                        {group.GroupName}
                      </h4>
                      <span className={styles.cardTag} style={{ backgroundColor: "var(--pcs-brand-primary-light)", color: "var(--pcs-brand-primary-hover)" }}>
                        {isChallengeChat ? "Trưởng nhóm: Không có (Box chat chung)" : `Trưởng nhóm: ${isLeader ? "Tôi" : (group.CreatorName || "Ẩn danh")}`}
                      </span>
                    </div>
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

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
                  <button
                    onClick={() => handleOpenChat(group)}
                    className={styles.primaryBtn}
                    style={{ width: "100%", position: "relative", padding: "0.6rem 1rem", fontSize: "14px", fontWeight: "600" }}
                  >
                    Chat nhóm
                    {unreadCounts[group.GroupID] > 0 && (
                      <span style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        backgroundColor: "#ef4444",
                        color: "white",
                        fontSize: "11px",
                        fontWeight: "bold",
                        borderRadius: "50%",
                        padding: "2px 6px",
                        minWidth: "20px",
                        textAlign: "center",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                      }}>
                        {unreadCounts[group.GroupID] > 9 ? "9+" : unreadCounts[group.GroupID]}
                      </span>
                    )}
                  </button>

                  {expandedGroupIds[group.GroupID] && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem", animation: "modalFadeIn 0.2s ease" }}>
                      <button
                        onClick={() => setSelectedGroupForMembers(group)}
                        className={styles.secondaryBtn}
                        style={{ width: "100%", backgroundColor: "#ffffff", color: "#334155", borderColor: "#cbd5e1", padding: "0.6rem 1rem", fontSize: "14px", fontWeight: "600" }}
                      >
                        Thành viên ({group.members?.length || group.CurrentPlayers || 0})
                      </button>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {isLeader ? (
                          <>
                            <button
                              onClick={() => handleOpenEdit(group)}
                              className={styles.secondaryBtn}
                              style={{ flex: 1, backgroundColor: "#ffffff", color: "#334155", borderColor: "#cbd5e1", padding: "0.5rem 0.25rem", fontSize: "13px", fontWeight: "600" }}
                            >
                              Chỉnh sửa
                            </button>
                            <button
                              onClick={() => handleLeaveGroup(group.GroupID, true, group.GroupName)}
                              className={styles.secondaryBtn}
                              style={{ flex: 1, backgroundColor: "#ffffff", color: "#334155", borderColor: "#cbd5e1", padding: "0.5rem 0.25rem", fontSize: "13px", fontWeight: "600" }}
                            >
                              Rời nhóm
                            </button>
                            <button
                              onClick={() => handleCloseGroup(group.GroupID, group.GroupName || "")}
                              className={styles.secondaryBtn}
                              style={{ flex: 1, backgroundColor: "#ffffff", color: "#334155", borderColor: "#cbd5e1", padding: "0.5rem 0.25rem", fontSize: "13px", fontWeight: "600" }}
                            >
                              Giải tán
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleLeaveGroup(group.GroupID, false, group.GroupName)}
                            className={styles.secondaryBtn}
                            style={{ flex: 1, backgroundColor: "#ffffff", color: "#334155", borderColor: "#cbd5e1", padding: "0.5rem 1rem", fontSize: "13px", fontWeight: "600" }}
                          >
                            Rời nhóm
                          </button>
                        )}
                      </div>
                    </div>
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

      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmModal && confirmModal.isOpen && (
        <div className={styles.modalOverlay} style={{ zIndex: 1100, display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
          <div
            className={styles.modalContent}
            style={{
              maxWidth: "460px",
              width: "90%",
              padding: "2rem",
              textAlign: "center",
              borderRadius: "20px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: "#ffffff",
              position: "relative",
              overflow: "hidden",
              animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Decorative colored banner / glow */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "6px",
                background:
                  confirmModal.type === "close"
                    ? "linear-gradient(90deg, #ef4444, #f87171, #dc2626)"
                    : "linear-gradient(90deg, #f59e0b, #fbbf24, #d97706)",
              }}
            />

            {/* Icon */}
            <div
              style={{
                width: "68px",
                height: "68px",
                margin: "0.5rem auto 1.25rem",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                background:
                  confirmModal.type === "close"
                    ? "radial-gradient(circle, #fee2e2 0%, #fef2f2 100%)"
                    : "radial-gradient(circle, #fef3c7 0%, #fffbeb 100%)",
                border:
                  confirmModal.type === "close"
                    ? "2px solid #fecaca"
                    : "2px solid #fde68a",
                boxShadow:
                  confirmModal.type === "close"
                    ? "0 10px 15px -3px rgba(239, 68, 68, 0.15)"
                    : "0 10px 15px -3px rgba(245, 158, 11, 0.15)",
              }}
            >
              {confirmModal.type === "close" ? "⚠️" : "🚪"}
            </div>

            {/* Title */}
            <h4
              style={{
                fontSize: "20px",
                fontWeight: "800",
                color: "#1e293b",
                margin: "0 0 0.75rem 0",
                letterSpacing: "-0.025em",
              }}
            >
              {confirmModal.type === "close"
                ? "Xác nhận giải tán nhóm"
                : "Xác nhận rời nhóm"}
            </h4>

            {/* Group Name badge */}
            <div
              style={{
                display: "inline-block",
                padding: "0.35rem 0.85rem",
                borderRadius: "9999px",
                backgroundColor: "#f1f5f9",
                color: "#334155",
                fontSize: "13px",
                fontWeight: "600",
                marginBottom: "1rem",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                border: "1px solid #e2e8f0",
              }}
            >
              🏓 {confirmModal.groupName}
            </div>

            {/* Description message */}
            <p
              style={{
                fontSize: "14.5px",
                color: "#64748b",
                lineHeight: "1.6",
                margin: "0 0 1.75rem 0",
                padding: "0 0.5rem",
              }}
            >
              {confirmModal.type === "close" ? (
                <>
                  Bạn có chắc chắn muốn <strong style={{ color: "#dc2626" }}>giải tán nhóm</strong> này không? Nhóm sẽ bị đóng vĩnh viễn và <strong style={{ color: "#dc2626" }}>toàn bộ thành viên sẽ được rời khỏi nhóm</strong>.
                </>
              ) : confirmModal.isLeader ? (
                <>
                  Bạn đang là <strong style={{ color: "#d97706" }}>Trưởng nhóm</strong>. Khi rời nhóm, <strong style={{ color: "#d97706" }}>quyền trưởng nhóm sẽ được tự động chuyển giao</strong> cho thành viên hoạt động gia nhập sớm nhất kế tiếp.
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn rời khỏi nhóm này không? Bạn sẽ không còn nhận được tin nhắn và thông báo từ nhóm nữa.
                </>
              )}
            </p>

            {/* Buttons */}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                onClick={() => !confirmModal.loading && setConfirmModal(null)}
                disabled={confirmModal.loading}
                className={styles.secondaryBtn}
                style={{
                  flex: 1,
                  padding: "0.75rem 1.25rem",
                  fontSize: "14px",
                  fontWeight: "600",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                  color: "#475569",
                  borderColor: "#cbd5e1",
                  transition: "all 0.15s ease",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeConfirmAction}
                disabled={confirmModal.loading}
                style={{
                  flex: 1,
                  padding: "0.75rem 1.25rem",
                  fontSize: "14px",
                  fontWeight: "700",
                  borderRadius: "12px",
                  border: "none",
                  cursor: confirmModal.loading ? "not-allowed" : "pointer",
                  color: "#ffffff",
                  background:
                    confirmModal.type === "close"
                      ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                      : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  boxShadow:
                    confirmModal.type === "close"
                      ? "0 4px 12px rgba(220, 38, 38, 0.25)"
                      : "0 4px 12px rgba(217, 119, 6, 0.25)",
                  transition: "all 0.15s ease",
                  opacity: confirmModal.loading ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                {confirmModal.loading ? (
                  "Đang xử lý..."
                ) : confirmModal.type === "close" ? (
                  "❌ Giải tán ngay"
                ) : (
                  "🚪 Xác nhận rời"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <GroupMembersModal 
        group={selectedGroupForMembers} 
        onClose={() => setSelectedGroupForMembers(null)} 
      />
    </div>
  );
}
