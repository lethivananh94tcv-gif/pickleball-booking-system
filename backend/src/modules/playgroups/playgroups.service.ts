import * as repo from "./playgroups.repository";
import { findProfileByUserId } from "../player-matching/player-matching.repository";
import * as notificationsService from "../notifications/notifications.service";

export async function createPlayGroup(data: repo.GroupData, creatorId: number) {
  // 1. Verify creator has a profile
  const profile = await findProfileByUserId(creatorId);
  if (!profile) {
    throw new Error("Bạn cần cập nhật Hồ sơ chơi bóng trước khi tạo nhóm.");
  }

  // 2. Enforce max 3 active groups limit
  const activeCount = await repo.countActiveGroupsForCreator(creatorId);
  if (activeCount >= 3) {
    throw new Error("Bạn chỉ được tạo và làm trưởng nhóm tối đa 3 nhóm hoạt động đồng thời.");
  }

  const groupId = await repo.createGroup(data, creatorId);
  return repo.getGroupDetails(groupId);
}

export async function getPlayGroups(filters: { skillLevel?: string; keyword?: string }) {
  const groups = await repo.listGroups(filters);
  return Promise.all(
    (groups || []).map(async (g: any) => {
      const details = await repo.getGroupDetails(g.GroupID);
      return {
        ...g,
        members: details?.members || []
      };
    })
  );
}

export async function getPlayGroupDetails(groupId: number) {
  const group = await repo.getGroupDetails(groupId);
  if (!group) {
    throw new Error("Không tìm thấy nhóm chơi.");
  }
  return group;
}

export async function joinPlayGroup(groupId: number, userId: number) {
  // 1. Verify user has a profile
  const profile = await findProfileByUserId(userId);
  if (!profile) {
    throw new Error("Bạn cần cập nhật Hồ sơ chơi bóng trước khi tham gia nhóm.");
  }

  // 2. Verify group status
  const group = await repo.getGroupDetails(groupId);
  if (!group) {
    throw new Error("Không tìm thấy nhóm chơi.");
  }

  if (group.Status === 'Closed') {
    throw new Error("Nhóm này đã đóng.");
  }

  if (group.Status === 'Full' || group.CurrentPlayers >= group.MaxPlayers) {
    throw new Error("Nhóm đã đầy thành viên.");
  }

  // 3. Verify duplicate join
  const isMember = await repo.checkUserInGroup(groupId, userId);
  if (isMember) {
    throw new Error("Bạn đã tham gia nhóm này rồi.");
  }

  await repo.addGroupMember(groupId, userId);
  return repo.getGroupDetails(groupId);
}

export async function leavePlayGroup(groupId: number, userId: number) {
  const group = await repo.getGroupDetails(groupId);
  if (!group) {
    throw new Error("Không tìm thấy nhóm chơi.");
  }

  const isMember = await repo.checkUserInGroup(groupId, userId);
  if (!isMember) {
    throw new Error("Bạn không phải thành viên của nhóm này.");
  }

  // Handle Leader leaving rules (Skip for challenge chat box or members without Leader role)
  const isChallengeChat = group.Description?.includes("Box chat chung") || group.GroupName?.includes("Thách đấu");
  const memberRecord = group.members.find((m: any) => m.UserID === userId);
  
  if (!isChallengeChat && (group.CreatorID === userId || memberRecord?.RoleInGroup === 'Leader')) {
    const otherActiveMembers = group.members.filter((m: any) => m.UserID !== userId && m.MemberStatus === 'Active');
    if (otherActiveMembers.length > 0) {
      // Transfer leadership to the oldest remaining active member
      const newLeader = otherActiveMembers.sort((a: any, b: any) => new Date(a.JoinedAt || 0).getTime() - new Date(b.JoinedAt || 0).getTime())[0];
      await repo.transferLeadership(groupId, userId, newLeader.UserID);
    } else {
      // Creator is the only one in the group: close the group
      await repo.updateGroupStatus(groupId, 'Closed');
    }
  }

  await repo.removeGroupMember(groupId, userId);
  return repo.getGroupDetails(groupId);
}

export async function closePlayGroup(groupId: number, userId: number) {
  const group = await repo.getGroupDetails(groupId);
  if (!group) {
    throw new Error("Không tìm thấy nhóm chơi.");
  }

  if (group.CreatorID !== userId) {
    throw new Error("Chỉ trưởng nhóm mới có quyền giải tán nhóm.");
  }

  await repo.updateGroupStatus(groupId, 'Closed');
  await repo.removeAllGroupMembers(groupId);
  return { status: "Closed", message: "Nhóm đã được giải tán thành công." };
}

export async function updatePlayGroup(
  groupId: number,
  userId: number,
  data: {
    groupName: string;
    skillLevel: string;
    averageExperience: number;
    description: string;
    status: string;
  }
) {
  const group = await repo.getGroupDetails(groupId);
  if (!group) {
    throw new Error("Nhóm chơi không tồn tại.");
  }

  if (group.CreatorID !== userId) {
    throw new Error("Bạn không có quyền chỉnh sửa nhóm này.");
  }

  if (!data.groupName || !data.groupName.trim()) {
    throw new Error("Tên nhóm không được để trống.");
  }

  const validSkillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];
  if (!validSkillLevels.includes(data.skillLevel)) {
    throw new Error("Trình độ nhóm không hợp lệ.");
  }

  if (data.averageExperience === undefined || data.averageExperience === null || isNaN(Number(data.averageExperience)) || Number(data.averageExperience) < 0) {
    throw new Error("Kinh nghiệm trung bình phải lớn hơn hoặc bằng 0.");
  }

  const validStatuses = ['Open', 'Active', 'Full', 'Closed'];
  if (data.status && !validStatuses.includes(data.status)) {
    throw new Error("Trạng thái nhóm không hợp lệ.");
  }

  await repo.updateGroup(groupId, {
    groupName: data.groupName.trim(),
    skillLevel: data.skillLevel,
    averageExperience: Number(data.averageExperience),
    description: data.description || "",
    status: data.status || "Open",
  });

  return repo.getGroupDetails(groupId);
}

export async function getGroupMessages(groupId: number, userId: number) {
  const isMember = await repo.checkUserInGroup(groupId, userId);
  if (!isMember) {
    throw new Error("Bạn không có quyền xem tin nhắn của nhóm này.");
  }

  const messages = await repo.getGroupMessages(groupId, 50);

  // Attach IsMine flag and adjust UTC timestamp (DB stores local Vietnam time via GETDATE(), but mssql driver treats it as UTC)
  return messages.map((m: any) => {
    let createdAt = m.CreatedAt;
    if (createdAt) {
      const realUtcTime = new Date(createdAt).getTime() - 7 * 60 * 60 * 1000;
      createdAt = new Date(realUtcTime).toISOString();
    }
    return {
      ...m,
      CreatedAt: createdAt,
      IsMine: m.SenderID === userId
    };
  });
}

export async function sendGroupMessage(groupId: number, userId: number, content: string) {
  const isMember = await repo.checkUserInGroup(groupId, userId);
  if (!isMember) {
    throw new Error("Bạn không có quyền gửi tin nhắn vào nhóm này.");
  }

  const trimmedContent = content ? content.trim() : "";
  if (!trimmedContent) {
    throw new Error("Nội dung tin nhắn không được rỗng.");
  }

  if (trimmedContent.length > 1000) {
    throw new Error("Nội dung tin nhắn không được vượt quá 1000 ký tự.");
  }

  const newMessage = await repo.createGroupMessage(groupId, userId, trimmedContent);

  let createdAt = newMessage?.CreatedAt;
  if (createdAt) {
    const realUtcTime = new Date(createdAt).getTime() - 7 * 60 * 60 * 1000;
    createdAt = new Date(realUtcTime).toISOString();
  }

  // Gửi email notification (bất đồng bộ, không dùng await/throw lỗi luồng chính)
  notificationsService.notifyGroupChatMessage(userId, groupId, trimmedContent).catch(err => console.error("notifyGroupChatMessage error:", err));

  // Return with basic info, the client can refetch if needed
  return {
    ...newMessage,
    CreatedAt: createdAt || newMessage?.CreatedAt,
    IsMine: true
  };
}

export async function getUnreadCounts(userId: number) {
  return repo.getUnreadCounts(userId);
}

export async function markMessagesAsRead(userId: number, groupId: number) {
  const isMember = await repo.checkUserInGroup(groupId, userId);
  if (!isMember) {
    throw new Error("Bạn không có quyền mark read cho nhóm này.");
  }
  return repo.markMessagesAsRead(userId, groupId);
}

export async function pinGroupMessage(groupId: number, messageId: number, userId: number) {
  const isMember = await repo.checkUserInGroup(groupId, userId);
  if (!isMember) {
    throw new Error("Bạn không có quyền ghim tin nhắn trong nhóm này.");
  }
  return repo.pinGroupMessage(groupId, messageId);
}

export async function unpinGroupMessage(groupId: number, messageId: number, userId: number) {
  const isMember = await repo.checkUserInGroup(groupId, userId);
  if (!isMember) {
    throw new Error("Bạn không có quyền bỏ ghim tin nhắn trong nhóm này.");
  }
  return repo.unpinGroupMessage(groupId, messageId);
}
