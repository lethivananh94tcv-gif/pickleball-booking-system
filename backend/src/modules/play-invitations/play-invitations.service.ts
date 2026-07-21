import * as repo from "./play-invitations.repository";
import * as groupRepo from "../playgroups/playgroups.repository";
import * as matchingRepo from "../player-matching/player-matching.repository";
import * as notificationsService from "../notifications/notifications.service";
import { getPool, sql } from "@/database/connection";

export async function createPlayInvitation(
  senderId: number,
  receiverId: number | null,
  groupId: number | null,
  targetGroupId: number | null,
  invitationType: string,
  message: string,
  challengeDate?: string,
  challengeStartTime?: string,
  challengeEndTime?: string
) {
  // 1. Verify sender has profile
  const senderProfile = await matchingRepo.findProfileByUserId(senderId);
  if (!senderProfile) {
    throw new Error("Bạn cần cập nhật Hồ sơ chơi bóng trước khi gửi lời mời.");
  }

  if (receiverId !== null && senderId === receiverId) {
    throw new Error("Bạn không thể gửi lời mời cho chính mình.");
  }

  // 2. Validate based on invitation type
  if (invitationType === 'InviteToPlay') {
    if (!receiverId) {
      throw new Error("Vui lòng chọn người chơi muốn ghép cặp (receiverId).");
    }
    const pendingInvite = await repo.findPendingInvitationBetweenUsers(senderId, receiverId, 'InviteToPlay');
    if (pendingInvite) {
      throw new Error("Hai người đã có lời mời ghép cặp đang chờ xử lý.");
    }
    
    // Check existing active/open playing group between them
    const existingGroupId = await groupRepo.findActiveGroupBetweenPlayers(senderId, receiverId);
    if (existingGroupId) {
      throw new Error("Hai người đã ghép cặp hoặc đã ở trong cùng một nhóm.");
    }
  } else {
    const isPending = await repo.checkPendingInvitation(senderId, receiverId, groupId, invitationType);
    if (isPending) {
      throw new Error("Bạn đã gửi lời mời cho người chơi này rồi.");
    }
  }

  // 3. Validate based on invitation type details
  if (invitationType === 'InviteToGroup') {
    if (!groupId) {
      throw new Error("Vui lòng cung cấp mã nhóm (groupId).");
    }
    if (!receiverId) {
      throw new Error("Vui lòng chọn người chơi muốn mời (receiverId).");
    }

    const group = await groupRepo.getGroupDetails(groupId);
    if (!group) {
      throw new Error("Không tìm thấy nhóm chơi.");
    }

    if (group.CreatorID !== senderId) {
      throw new Error("Chỉ trưởng nhóm mới có quyền mời thành viên mới.");
    }

    if (group.CurrentPlayers >= group.MaxPlayers) {
      throw new Error("Nhóm chơi đã đầy thành viên.");
    }

    const isMember = await groupRepo.checkUserInGroup(groupId, receiverId);
    if (isMember) {
      throw new Error("Người này đã là thành viên của nhóm.");
    }
  } else if (invitationType === 'InviteOpponent') {
    if (!groupId) {
      throw new Error("Vui lòng cung cấp mã nhóm của bạn (groupId).");
    }
    // receiverId is the leader of the opponent group
    if (!receiverId) {
      throw new Error("Vui lòng chọn trưởng nhóm đối thủ (receiverId).");
    }
    
    if (!challengeDate) {
      throw new Error("Vui lòng chọn ngày thi đấu.");
    }
    if (!challengeStartTime) {
      throw new Error("Vui lòng chọn giờ bắt đầu.");
    }
    if (!challengeEndTime) {
      throw new Error("Vui lòng chọn giờ kết thúc.");
    }

    const [startH, startM] = challengeStartTime.split(":").map(Number);
    const [endH, endM] = challengeEndTime.split(":").map(Number);
    const startVal = startH * 60 + startM;
    const endVal = endH * 60 + endM;

    if (endVal <= startVal) {
      throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu.");
    }

    if (startH < 5 || (endH > 23 || (endH === 23 && endM > 0))) {
      throw new Error("Khung giờ thi đấu phải nằm trong khoảng từ 05:00 đến 23:00.");
    }

    const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const todayStr = `${nowVN.getFullYear()}-${String(nowVN.getMonth() + 1).padStart(2, "0")}-${String(nowVN.getDate()).padStart(2, "0")}`;
    if (challengeDate < todayStr) {
      throw new Error("Ngày thi đấu không được ở quá khứ.");
    }
    if (challengeDate === todayStr) {
      const currentHour = nowVN.getHours();
      const currentMin = nowVN.getMinutes();
      const currentVal = currentHour * 60 + currentMin;
      if (startVal <= currentVal) {
        throw new Error("Giờ bắt đầu phải ở tương lai đối với hôm nay.");
      }
    }

    const senderGroup = await groupRepo.getGroupDetails(groupId);
    if (!senderGroup) {
      throw new Error("Không tìm thấy nhóm chơi của bạn.");
    }

    if (senderGroup.CreatorID !== senderId) {
      throw new Error("Chỉ trưởng nhóm mới được gửi lời mời thách đấu.");
    }

    const senderActiveCount = await groupRepo.countActiveGroupMembers(groupId);
    if (senderActiveCount < 2) {
      throw new Error("Nhóm của bạn phải có ít nhất 2 thành viên đang hoạt động để gửi lời thách đấu.");
    }

    if (!targetGroupId) {
      throw new Error("Thiếu targetGroupId của nhóm đối thủ.");
    }

    // Get exact target group and verify ownership
    const pool = await getPool();
    const req = pool.request();

    req.input("TargetGroupID", sql.Int, targetGroupId);
    req.input("ReceiverID", sql.Int, receiverId);

    const targetGroupQuery = `
      SELECT GroupID, GroupName, Status, CreatedBy
      FROM PlayingGroups
      WHERE GroupID = @TargetGroupID
        AND CreatedBy = @ReceiverID
        AND Status IN ('Open', 'Active', 'Full')
    `;

    const targetGroupRes = await req.query(targetGroupQuery);
    
    if (targetGroupRes.recordset.length === 0) {
      throw new Error("Nhóm đối thủ không hợp lệ hoặc không thuộc người nhận.");
    }
    const targetGroup = targetGroupRes.recordset[0];
    const targetActiveCount = await groupRepo.countActiveGroupMembers(targetGroup.GroupID);
    if (targetActiveCount < 2) {
      throw new Error("Nhóm đối thủ không đủ điều kiện (cần ít nhất 2 thành viên) để nhận lời thách đấu.");
    }

    if (groupId === targetGroup.GroupID) {
      throw new Error("Không thể thách đấu nhóm của chính bạn.");
    }

    const hasOverlap = await groupRepo.checkGroupOverlap(groupId, targetGroup.GroupID);
    if (hasOverlap) {
      throw new Error("Không thể thách đấu do hai nhóm có thành viên bị trùng lặp.");
    }

    const pendingOpponentInvite = await repo.findPendingInvitationBetweenUsers(senderId, receiverId, 'InviteOpponent');
    if (pendingOpponentInvite) {
      throw new Error("Hai nhóm đã có lời mời thách đấu đang chờ xử lý.");
    }
  } else if (invitationType === 'InviteToPlay') {
    // Already validated above
  } else {
    throw new Error("Loại lời mời không hợp lệ.");
  }

  const invitationId = await repo.createInvitation(
    senderId,
    receiverId,
    groupId,
    invitationType,
    message,
    challengeDate,
    challengeStartTime,
    challengeEndTime
  );

  const createdInv = await repo.getInvitationById(invitationId);

  // Gửi email notification
  notificationsService.notifyPlayInvitationCreated(createdInv).catch(err => console.error("notifyPlayInvitationCreated error:", err));

  return createdInv;
}

export async function getReceived(userId: number) {
  return repo.getReceivedInvitations(userId);
}

export async function getSent(userId: number) {
  return repo.getSentInvitations(userId);
}

export async function acceptInvitation(invitationId: number, userId: number) {
  const invite = await repo.getInvitationById(invitationId);
  if (!invite) {
    throw new Error("Không tìm thấy lời mời.");
  }

  if (invite.Status !== 'Pending') {
    throw new Error("Lời mời này đã được xử lý trước đó.");
  }

  if (invite.ReceiverID !== userId) {
    throw new Error("Bạn không phải người nhận lời mời này.");
  }

  // Handle logic based on invitation type
  if (invite.InvitationType === 'InviteToGroup') {
    const groupId = invite.GroupID;
    if (!groupId) throw new Error("Mã nhóm không hợp lệ.");

    const group = await groupRepo.getGroupDetails(groupId);
    if (!group) throw new Error("Không tìm thấy nhóm chơi.");

    if (group.CurrentPlayers >= group.MaxPlayers) {
      await repo.updateInvitationStatus(invitationId, 'Expired');
      throw new Error("Nhóm chơi đã đầy thành viên. Lời mời đã bị hủy.");
    }

    const isMember = await groupRepo.checkUserInGroup(groupId, userId);
    if (isMember) {
      await repo.updateInvitationStatus(invitationId, 'Accepted');
      return { message: "Bạn đã ở trong nhóm này rồi." };
    }

    // Join the group
    await groupRepo.addGroupMember(groupId, userId);
    await repo.updateInvitationStatus(invitationId, 'Accepted');
  } else if (invite.InvitationType === 'InviteToPlay') {
    // 1. Check if an active group with exactly these two players already exists
    const existingGroupId = await groupRepo.findActiveGroupBetweenPlayers(invite.SenderID, userId);
    let groupId = existingGroupId;
    let groupDataToCreate = null;

    if (!existingGroupId) {
      // 2. Fetch sender and receiver profiles to compute average experience and skill level
      const senderProfile = await matchingRepo.findProfileByUserId(invite.SenderID);
      const receiverProfile = await matchingRepo.findProfileByUserId(userId);

      // Compute average experience
      let totalExp = 0;
      let count = 0;
      if (senderProfile) {
        totalExp += senderProfile.ExperienceYears || 0;
        count++;
      }
      if (receiverProfile) {
        totalExp += receiverProfile.ExperienceYears || 0;
        count++;
      }
      const avgExp = count > 0 ? (totalExp / count) : 0;

      // Group name: Team {SenderName} & {ReceiverName}
      const senderName = senderProfile?.FullName || `User #${invite.SenderID}`;
      const receiverName = receiverProfile?.FullName || `User #${userId}`;
      const groupName = `Team ${senderName} & ${receiverName}`;

      // Skill level of group: use sender's skill level, or receiver's, or default "Intermediate"
      const skillLevel = senderProfile?.SkillLevel || receiverProfile?.SkillLevel || "Intermediate";

      groupDataToCreate = {
        groupName,
        skillLevel,
        description: "Nhóm được tạo tự động sau khi ghép cặp thành công.",
        averageExperience: avgExp,
      };
    }

    // Perform transaction update
    const txGroupId = await repo.acceptTeammateInvitationTx(
      invitationId,
      invite.SenderID,
      userId,
      groupDataToCreate,
      'Teammate'
    );

    if (txGroupId) {
      groupId = txGroupId;
    }

    // Also update PlayerMatches table so teammate matching algorithms can locate this pair
    await matchingRepo.upsertPlayerMatch(invite.SenderID, userId, 100.00, 'Teammate', 'Accepted');
  } else if (invite.InvitationType === 'InviteOpponent') {
    if (!invite.GroupID) throw new Error("Lời mời thách đấu không hợp lệ (thiếu GroupID).");

    const senderActiveCount = await groupRepo.countActiveGroupMembers(invite.GroupID);

    // Get target group owned by the receiver
    const pool = await getPool();
    const targetGroupRes = await pool.request()
      .input("ReceiverID", sql.Int, userId)
      .query(`
        SELECT TOP 1 GroupID
        FROM PlayingGroups
        WHERE CreatedBy = @ReceiverID AND Status IN ('Open', 'Active', 'Full')
        ORDER BY GroupID DESC
      `);

    const targetGroup = targetGroupRes.recordset[0];
    if (!targetGroup) {
      throw new Error("Không tìm thấy nhóm đối thủ hoặc nhóm đối thủ đã bị đóng.");
    }

    const receiverActiveCount = await groupRepo.countActiveGroupMembers(targetGroup.GroupID);

    if (senderActiveCount < 2 || receiverActiveCount < 2) {
      throw new Error("Không thể chấp nhận lời thách đấu do một trong hai nhóm không đủ thành viên hoạt động (cần ít nhất 2 thành viên).");
    }

    const hasOverlap = await groupRepo.checkGroupOverlap(invite.GroupID, targetGroup.GroupID);
    if (hasOverlap) {
      throw new Error("Không thể chấp nhận lời thách đấu do hai nhóm có thành viên bị trùng lặp.");
    }

    // Upsert opponent match record with 'Accepted' status
    await matchingRepo.upsertPlayerMatch(invite.SenderID, userId, 100.00, 'Opponent', 'Accepted');
    await repo.updateInvitationStatus(invitationId, 'Accepted');
  }

  const updatedInvitation = await repo.getInvitationById(invitationId);
  let associatedGroupId = invite.GroupID;
  if (invite.InvitationType === 'InviteToPlay') {
    associatedGroupId = await groupRepo.findActiveGroupBetweenPlayers(invite.SenderID, userId);
  }

  // Gửi email notification
  notificationsService.notifyInvitationStatusChanged(updatedInvitation, 'Accepted').catch(err => console.error("notifyInvitationStatusChanged error:", err));

  return {
    ...updatedInvitation,
    groupId: associatedGroupId,
  };
}

export async function rejectInvitation(invitationId: number, userId: number) {
  const invite = await repo.getInvitationById(invitationId);
  if (!invite) {
    throw new Error("Không tìm thấy lời mời.");
  }

  if (invite.Status !== 'Pending') {
    throw new Error("Lời mời này đã được xử lý trước đó.");
  }

  if (invite.ReceiverID !== userId) {
    throw new Error("Bạn không phải người nhận lời mời này.");
  }

  await repo.updateInvitationStatus(invitationId, 'Rejected');

  const rejectedInv = await repo.getInvitationById(invitationId);
  // Gửi email notification
  notificationsService.notifyInvitationStatusChanged(rejectedInv, 'Rejected').catch(err => console.error("notifyInvitationStatusChanged error:", err));

  return rejectedInv;
}

export async function getPendingCount(userId: number) {
  return repo.getPendingInvitationsCount(userId);
}
