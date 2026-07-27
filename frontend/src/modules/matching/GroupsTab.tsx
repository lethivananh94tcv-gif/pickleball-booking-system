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
  const [showChatOptionsModal, setShowChatOptionsModal] = useState(false);
  const [renamingGroupModal, setRenamingGroupModal] = useState<{ groupId: number; groupName: string } | null>(null);
  const [newGroupNameInput, setNewGroupNameInput] = useState("");
  const [renamingLoading, setRenamingLoading] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const chatInputRef = React.useRef<HTMLInputElement>(null);
  const firebaseListenerRef = useRef<{ ref: any; callback: any } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    messageId: number;
    groupId: number;
  } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handlePinMessage = async () => {
    if (!contextMenu) return;
    try {
      await api.pinGroupMessage(token, contextMenu.groupId, contextMenu.messageId);
      loadMessages(contextMenu.groupId);
      showToast("Đã ghim tin nhắn!", "success");
    } catch (err: any) {
      showToast(err.message || "Không thể ghim tin nhắn", "error");
    }
    setContextMenu(null);
  };

  const handleUnpinMessage = async () => {
    if (!contextMenu) return;
    try {
      await api.unpinGroupMessage(token, contextMenu.groupId, contextMenu.messageId);
      loadMessages(contextMenu.groupId);
      showToast("Đã bỏ ghim tin nhắn!", "success");
    } catch (err: any) {
      showToast(err.message || "Không thể bỏ ghim tin nhắn", "error");
    }
    setContextMenu(null);
  };


  const toggleGroupOptions = (groupId: number) => {
    setExpandedGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
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
              const existingIds = new Set(prev.map((m) => String(m.MessageID)));
              const newMsgs: api.GroupMessage[] = [];

              Object.keys(fbData).forEach((key) => {
                const item = fbData[key];
                const msgId = item.MessageID || key;
                if (!existingIds.has(String(msgId))) {
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
    if (chatGroup?.GroupID === group.GroupID) return;
    setChatGroup(group);
    setMessages([]);
    try {
      await api.markGroupMessagesAsRead(token, group.GroupID);
      setUnreadCounts(prev => ({ ...prev, [group.GroupID]: 0 }));
      window.dispatchEvent(new Event("invitation-count-change"));
    } catch (err) {}
  };

  // Clean up Firebase listener and load messages whenever chatGroup changes
  useEffect(() => {
    if (chatGroup) {
      loadMessages(chatGroup.GroupID);
    }
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
      setMessages((prev) => {
        if (prev.some((m) => String(m.MessageID) === String(newMsg.MessageID))) {
          return prev;
        }
        return [...prev, newMsg];
      });
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

  const handleRenameGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingGroupModal || !newGroupNameInput.trim() || renamingLoading) return;
    setRenamingLoading(true);
    try {
      await api.updateGroup(token, renamingGroupModal.groupId, {
        groupName: newGroupNameInput.trim(),
        skillLevel: chatGroup?.SkillLevel || "Intermediate",
        averageExperience: chatGroup?.AverageExperience || 1,
        description: chatGroup?.Description || "",
        status: chatGroup?.Status || "Open",
      });
      showToast("Đổi tên nhóm thành công!");
      if (chatGroup && chatGroup.GroupID === renamingGroupModal.groupId) {
        setChatGroup(prev => prev ? { ...prev, GroupName: newGroupNameInput.trim() } : null);
      }
      setGroups(prev => prev.map(g => g.GroupID === renamingGroupModal.groupId ? { ...g, GroupName: newGroupNameInput.trim() } : g));
      setRenamingGroupModal(null);
    } catch (err: any) {
      showToast(err.message || "Đổi tên nhóm thất bại", "error");
    } finally {
      setRenamingLoading(false);
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
    <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column", paddingBottom: "1rem" }}>
      {false && (
        <>
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
                        {isChallengeChat ? "Trưởng nhóm: Đại diện 2 đội" : `Trưởng nhóm: ${isLeader ? "Tôi" : (group.CreatorName || "Ẩn danh")}`}
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
      </>
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

      {/* SPLIT PANE CHAT VIEW (INLINE) */}
      {true && (
        <div style={{ flex: 1, display: "flex", flexDirection: "row", maxWidth: "880px", width: "100%", margin: "0 auto", minWidth: 0, height: "100%", backgroundColor: "#ffffff", padding: 0, overflow: "hidden", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            
            {/* LEFT SIDEBAR: LIST OF GROUPS */}
            <div style={{ width: "280px", backgroundColor: "#f0fdf4", borderRight: "1px solid #dcfce7", display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #dcfce7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "18px", color: "#166534", fontWeight: "700" }}>Tin nhắn</h4>
                <button onClick={() => setShowCreateModal(true)} style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: "28px", padding: 0, lineHeight: 1 }} title="Tạo nhóm mới">+</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {groups.map(g => {
                  const isSelected = chatGroup?.GroupID === g.GroupID;
                  return (
                    <div 
                      key={g.GroupID}
                      onClick={() => handleOpenChat(g)}
                      style={{ 
                        padding: "0.875rem 1rem", 
                        borderRadius: "14px", 
                        cursor: "pointer",
                        background: isSelected 
                          ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" 
                          : "rgba(255, 255, 255, 0.65)",
                        border: isSelected 
                          ? "1px solid #047857" 
                          : "1px solid rgba(16, 185, 129, 0.15)",
                        boxShadow: isSelected 
                          ? "0 6px 16px rgba(16, 185, 129, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.3)" 
                          : "0 1px 3px rgba(0, 0, 0, 0.03)",
                        transform: isSelected ? "translateY(-1px)" : "translateY(0)",
                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                      }}
                      onMouseOver={(e) => { 
                        if (!isSelected) {
                          e.currentTarget.style.background = "#ffffff";
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.12)";
                          e.currentTarget.style.borderColor = "#86efac";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }
                      }}
                      onMouseOut={(e) => { 
                        if (!isSelected) {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.65)";
                          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.03)";
                          e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.15)";
                          e.currentTarget.style.transform = "translateY(0)";
                        }
                      }}
                    >
                      <div style={{ 
                        fontWeight: "700", 
                        fontSize: "14.5px", 
                        color: isSelected ? "#ffffff" : "#15803d", 
                        marginBottom: "4px", 
                        whiteSpace: "nowrap", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis",
                        textShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.15)" : "none"
                      }}>
                        {g.GroupName}
                      </div>
                      <div style={{ 
                        fontSize: "12px", 
                        color: isSelected ? "#d1fae5" : "#16a34a", 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "6px",
                        fontWeight: isSelected ? "600" : "500"
                      }}>
                        <span style={{ 
                          display: "inline-block", 
                          width: "8px", 
                          height: "8px", 
                          borderRadius: "50%", 
                          backgroundColor: isSelected ? "#fef08a" : "#22c55e",
                          boxShadow: isSelected ? "0 0 6px #fef08a" : "none"
                        }}></span>
                        {g.CurrentPlayers} / {g.MaxPlayers} thành viên
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT SIDE: MAIN CHAT AREA */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", backgroundColor: "#ffffff", position: "relative", overflow: "hidden" }}>
              {!chatGroup ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexDirection: "column", gap: "1rem", backgroundColor: "#f8fafc" }}>
                  <span style={{ fontSize: "64px" }}>💬</span>
                  <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748b" }}>Chọn một nhóm bên trái để bắt đầu trò chuyện</p>
                </div>
              ) : (
                <>
              <div className={styles.modalHeader} style={{ padding: "1.25rem 1.5rem", margin: 0, borderBottom: "1px solid #f1f5f9", backgroundColor: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minWidth: 0, width: "100%", boxSizing: "border-box" }}>
                <div 
                  onClick={() => setShowChatOptionsModal(true)}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "8px", 
                    cursor: "pointer", 
                    minWidth: 0, 
                    flex: 1,
                    padding: "4px 8px",
                    margin: "-4px -8px",
                    borderRadius: "8px",
                    transition: "background 0.2s ease"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  title="Nhấn để xem tùy chọn nhóm"
                >
                  <h4 className={styles.modalTitle} style={{ color: "#0f172a", margin: 0, fontSize: "16px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chatGroup.GroupName}</h4>
                  <span style={{ fontSize: "12px", color: "#64748b", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "50%", background: "#f8fafc", border: "1px solid #e2e8f0" }}>▼</span>
                </div>
                <button className={styles.closeBtn} style={{ color: "#64748b", fontSize: "24px", flexShrink: 0 }} onClick={() => setChatGroup(null)}>×</button>
              </div>

              {(chatGroup.IsChallengeChat === 1 || chatGroup.IsChallengeChat === true || chatGroup.Description?.includes("Box chat chung") || chatGroup.GroupName?.includes("Thách đấu")) && 
               !messages.some(m => m.Content && m.Content.includes("THÔNG BÁO ĐẶT SÂN THÀNH CÔNG")) && (
                <div style={{
                  backgroundColor: "#fef3c7",
                  borderBottom: "1px solid #fde68a",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "24px" }}>🏟️</span>
                    <div>
                      <div style={{ fontWeight: "700", color: "#d97706", fontSize: "14.5px" }}>Gợi ý: Đặt sân cho trận đấu</div>
                      <div style={{ color: "#b45309", fontSize: "12.5px", marginTop: "2px" }}>Các bạn đã chốt được lịch giao lưu? Đặt sân ngay nhé!</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => window.open(`/bookings/team?groupId=${chatGroup.GroupID}`, "_blank")}
                    style={{
                      backgroundColor: "#d97706",
                      color: "white",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 4px rgba(217, 119, 6, 0.2)",
                      transition: "all 0.2s"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = "#b45309";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "#d97706";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    Đặt sân ngay
                  </button>
                </div>
              )}

              {(() => {
                const pinnedMessage = messages.find((m: any) => m.IsPinned);
                if (!pinnedMessage) return null;
                return (
                  <div 
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      backdropFilter: "blur(4px)",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      zIndex: 10,
                      minWidth: 0,
                      width: "100%",
                      boxSizing: "border-box"
                    }}
                    onClick={() => {
                      const el = document.getElementById(`msg-${pinnedMessage.MessageID}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    <span style={{ fontSize: "16px", flexShrink: 0 }}>📌</span>
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>Tin nhắn đã ghim</div>
                      <div style={{ fontSize: "13px", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                        {pinnedMessage.Content?.replace(/\n/g, ' ')}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div ref={messagesContainerRef} style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden", padding: "1.5rem", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "3rem" }}>
                    Chưa có tin nhắn nào. Hãy bắt đầu trò chuyện!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.IsMine;
                    return (
                      <div 
                        key={msg.MessageID} 
                        id={`msg-${msg.MessageID}`}
                        style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", position: "relative", maxWidth: "100%", minWidth: 0 }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            messageId: msg.MessageID,
                            groupId: chatGroup.GroupID
                          });
                        }}
                      >
                        {!isMine && <span style={{ fontSize: "12px", color: "#64748b", marginBottom: "0.25rem", marginLeft: "0.25rem" }}>{msg.SenderName}</span>}
                        {msg.IsPinned && (
                          <div style={{
                            fontSize: "11px",
                            color: "#dc2626",
                            fontWeight: "bold",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            marginLeft: isMine ? "0" : "4px",
                            marginRight: isMine ? "4px" : "0"
                          }}>
                            📌 Đã ghim
                          </div>
                        )}
                        <div style={{
                          maxWidth: "65%",
                          minWidth: 0,
                          padding: "0.625rem 1rem",
                          borderRadius: "16px",
                          borderBottomRightRadius: isMine ? "4px" : "16px",
                          borderBottomLeftRadius: !isMine ? "4px" : "16px",
                          backgroundColor: isMine ? "#22c55e" : "#f1f5f9",
                          color: isMine ? "#ffffff" : "#0f172a",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          whiteSpace: "pre-wrap",
                          fontSize: "14.5px"
                        }}>
                          {msg.Content}
                        </div>
                        <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                          {new Date(msg.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {contextMenu && contextMenu.visible && (
                <div 
                  style={{
                    position: "fixed",
                    top: contextMenu.y,
                    left: contextMenu.x,
                    backgroundColor: "white",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                    borderRadius: "10px",
                    padding: "6px 0",
                    zIndex: 9999,
                    minWidth: "160px",
                    border: "1px solid #e2e8f0"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const isPinned = messages.find((m: any) => m.MessageID === contextMenu.messageId)?.IsPinned;
                    return (
                      <button 
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          backgroundColor: "transparent",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          color: "#0f172a"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        onClick={isPinned ? handleUnpinMessage : handlePinMessage}
                      >
                        {isPinned ? "📌 Hủy ghim" : "📌 Ghim tin nhắn"}
                      </button>
                    );
                  })()}
                </div>
              )}

              <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", backgroundColor: "#ffffff", boxSizing: "border-box", width: "100%" }}>
                <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "12px", alignItems: "center", width: "100%", boxSizing: "border-box" }}>
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatContent}
                    onChange={(e) => setChatContent(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    className={styles.input}
                    style={{ 
                      flex: 1, 
                      marginBottom: 0, 
                      borderRadius: "99px", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0",
                      padding: "10px 16px",
                      fontSize: "14px",
                      outline: "none"
                    }}
                    maxLength={1000}
                  />
                  <button
                    type="submit"
                    className={styles.primaryBtn}
                    disabled={sendingMessage || !chatContent.trim()}
                    style={{ 
                      whiteSpace: "nowrap", 
                      backgroundColor: "#22c55e", 
                      color: "white", 
                      borderRadius: "99px",
                      padding: "10px 24px",
                      fontSize: "14px",
                      fontWeight: "600",
                      border: "none"
                    }}
                  >
                    {sendingMessage ? "..." : "Gửi"}
                  </button>
                </form>
              </div>
              </>
              )}
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

      {/* CHAT OPTIONS MODAL */}
      {showChatOptionsModal && chatGroup && (() => {
        const isChallengeChat = chatGroup.IsChallengeChat === 1 || chatGroup.IsChallengeChat === true || chatGroup.Description?.includes("Box chat chung") || chatGroup.GroupName?.includes("Thách đấu");
        const isLeader = !isChallengeChat && userProfile && chatGroup.CreatorID === userProfile.UserID && chatGroup.MyRole !== "Member";
        return (
          <div className={styles.modalOverlay} style={{ zIndex: 1000 }} onClick={() => setShowChatOptionsModal(false)}>
            <div className={styles.modalCard} style={{ backgroundColor: "#ffffff", maxWidth: "440px", width: "100%", padding: "1.75rem", borderRadius: "20px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
                    Tùy chọn nhóm chat
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                    {chatGroup.GroupName}
                  </p>
                </div>
                <button className={styles.closeBtn} onClick={() => setShowChatOptionsModal(false)} style={{ fontSize: "24px", color: "#94a3b8", cursor: "pointer", background: "none", border: "none" }}>×</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Option 1: Rename group (For both members and leader) */}
                <button
                  onClick={() => {
                    setShowChatOptionsModal(false);
                    setRenamingGroupModal({ groupId: chatGroup.GroupID, groupName: chatGroup.GroupName || "" });
                    setNewGroupNameInput(chatGroup.GroupName || "");
                  }}
                  className={styles.secondaryBtn}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "12px 16px", borderRadius: "12px", backgroundColor: "#f8fafc", borderColor: "#e2e8f0", color: "#1e293b", fontSize: "14.5px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                >
                  Đổi tên nhóm chat
                </button>

                {/* Option 2: View members (For both members and leader) */}
                <button
                  onClick={() => {
                    setShowChatOptionsModal(false);
                    setSelectedGroupForMembers(chatGroup);
                  }}
                  className={styles.secondaryBtn}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "12px 16px", borderRadius: "12px", backgroundColor: "#f8fafc", borderColor: "#e2e8f0", color: "#1e293b", fontSize: "14.5px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                >
                  Xem thành viên ({chatGroup.CurrentPlayers || 0})
                </button>

                {/* Option 3: Edit Group Settings (Leader ONLY) */}
                {isLeader && (
                  <button
                    onClick={() => {
                      setShowChatOptionsModal(false);
                      handleOpenEdit(chatGroup);
                    }}
                    className={styles.secondaryBtn}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "12px 16px", borderRadius: "12px", backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", color: "#15803d", fontSize: "14.5px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#dcfce7"; e.currentTarget.style.borderColor = "#86efac"; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#f0fdf4"; e.currentTarget.style.borderColor = "#bbf7d0"; }}
                  >
                    Chỉnh sửa thông tin nhóm
                  </button>
                )}

                {/* Option 4: Leave group (For both members and leader) */}
                <button
                  onClick={() => {
                    setShowChatOptionsModal(false);
                    handleLeaveGroup(chatGroup.GroupID, isLeader || false, chatGroup.GroupName);
                  }}
                  className={styles.secondaryBtn}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "12px 16px", borderRadius: "12px", backgroundColor: "#fff7ed", borderColor: "#fed7aa", color: "#c2410c", fontSize: "14.5px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#ffedd5"; e.currentTarget.style.borderColor = "#fb923c"; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#fff7ed"; e.currentTarget.style.borderColor = "#fed7aa"; }}
                >
                  Rời khỏi nhóm
                </button>

                {/* Option 5: Disband group (Leader ONLY) */}
                {isLeader && (
                  <button
                    onClick={() => {
                      setShowChatOptionsModal(false);
                      handleCloseGroup(chatGroup.GroupID, chatGroup.GroupName || "");
                    }}
                    className={styles.secondaryBtn}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "12px 16px", borderRadius: "12px", backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#dc2626", fontSize: "14.5px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#fee2e2"; e.currentTarget.style.borderColor = "#f87171"; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; }}
                  >
                    Giải tán nhóm
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* RENAME GROUP MODAL */}
      {renamingGroupModal && (
        <div className={styles.modalOverlay} style={{ zIndex: 1001 }} onClick={() => !renamingLoading && setRenamingGroupModal(null)}>
          <div className={styles.modalCard} style={{ backgroundColor: "#ffffff", maxWidth: "400px", width: "100%", padding: "1.75rem", borderRadius: "20px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>Đổi tên nhóm chat</h3>
              <button className={styles.closeBtn} onClick={() => !renamingLoading && setRenamingGroupModal(null)} disabled={renamingLoading}>×</button>
            </div>
            <form onSubmit={handleRenameGroup}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "8px" }}>Tên nhóm mới:</label>
                <input
                  type="text"
                  value={newGroupNameInput}
                  onChange={(e) => setNewGroupNameInput(e.target.value)}
                  placeholder="Nhập tên nhóm..."
                  className={styles.input}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                  required
                  disabled={renamingLoading}
                />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setRenamingGroupModal(null)} className={styles.secondaryBtn} disabled={renamingLoading} style={{ padding: "10px 18px", borderRadius: "10px" }}>Hủy</button>
                <button type="submit" className={styles.primaryBtn} disabled={renamingLoading || !newGroupNameInput.trim()} style={{ padding: "10px 20px", borderRadius: "10px", backgroundColor: "#22c55e", color: "white", border: "none", fontWeight: "600" }}>{renamingLoading ? "Đang lưu..." : "Lưu tên mới"}</button>
              </div>
            </form>
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
