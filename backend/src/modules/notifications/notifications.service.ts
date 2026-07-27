import * as notifRepo from "./notifications.repository";
import type { CreateNotificationInput } from "./notifications.type";

/**
 * Tao thong bao trong he thong (insert vao bang Notifications).
 * Duoc goi boi cac module khac (bookings, refunds...).
 * Khong throw error de khong anh huong den business logic chinh.
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    await notifRepo.insertNotification(input);
  } catch (error) {
    // Log loi nhung khong re-throw, tranh lam hong business flow chinh
    console.error("[Notification] Failed to create notification:", error);
  }
}

export async function getMyNotifications(userId: number, limit: number = 50) {
  return notifRepo.getMyNotifications(userId, limit);
}

export async function countUnreadNotifications(userId: number) {
  return notifRepo.countUnreadNotifications(userId);
}

export async function markNotificationAsRead(notificationId: number, userId: number) {
  await notifRepo.markNotificationAsRead(notificationId, userId);
}

export async function markAllNotificationsAsRead(userId: number) {
  await notifRepo.markAllNotificationsAsRead(userId);
}

// ── Email Notification Service ────────────────────────
import { sendNotificationEmail } from "../../utils/mail";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * Gửi email thông báo tin nhắn mới trong nhóm
 */
export async function notifyGroupChatMessage(senderId: number, groupId: number, content: string) {
  try {
    const groupInfo = await notifRepo.getGroupInfoForEmail(groupId);
    if (!groupInfo) return;

    const members = await notifRepo.getActiveGroupMembersForEmail(groupId);
    const sender = members.find(m => m.UserID === senderId);
    const senderName = sender ? sender.FullName : "Một thành viên";

    for (const member of members) {
      if (member.UserID === senderId) continue; // Không gửi cho người gửi

      let emailLogId: number | null = null;
      try {
        emailLogId = await notifRepo.createEmailLog({
          userId: member.UserID,
          email: member.Email,
          notificationType: "GROUP_CHAT_MESSAGE",
          groupId: groupId,
          status: "Reserved",
          cooldownMinutes: 5
        });

        // Nếu null tức là đã bị chặn bởi Atomic check cooldown trong DB
        if (!emailLogId) continue;

        // Tạo chuông thông báo trong hệ thống
        await createNotification({
          userId: member.UserID,
          title: "Tin nhắn mới",
          message: `Bạn có tin nhắn mới trong nhóm ${groupInfo.GroupName}`,
          notificationType: "Matching"
        });

        await sendNotificationEmail({
          to: member.Email,
          fullName: member.FullName,
          type: "GROUP_CHAT_MESSAGE",
          subject: `Tin nhắn mới từ nhóm ${groupInfo.GroupName}`,
          title: "Tin nhắn mới",
          message: `Bạn có tin nhắn mới trong nhóm ${groupInfo.GroupName}.\n\nNgười gửi: ${senderName}\n\nVui lòng đăng nhập PickleClub để xem và trả lời tin nhắn.`,
          actionUrl: `${FRONTEND_URL}/matching`,
          actionText: "Xem tin nhắn",
        });

        // Cập nhật log thành công
        if (emailLogId) {
          await notifRepo.updateEmailLogStatus(emailLogId, "Sent");
        }
      } catch (err: any) {
        // Cập nhật log lỗi
        if (emailLogId) {
          await notifRepo.updateEmailLogStatus(emailLogId, "Failed", err.message || "Unknown error");
        }
      }
    }
  } catch (error) {
    console.error("[Notification] notifyGroupChatMessage error:", error);
  }
}

/**
 * Gửi email khi có lời mời (Team, Group, Challenge)
 */
export async function notifyPlayInvitationCreated(invitation: any) {
  try {
    let toUserId: number | null = null;
    let type = "";
    let subject = "";
    let title = "";
    let message = "";

    const senderInfo = await notifRepo.getUserEmailInfo(invitation.SenderID);
    const senderName = senderInfo ? senderInfo.FullName : "Một người chơi";

    if (invitation.InvitationType === "InviteOpponent") {
      const type = "CHALLENGE_INVITATION";
      const subject = `Nhóm của ${senderName} đã gửi lời thách đấu`;
      const title = "Lời mời thách đấu";
      const message = `Nhóm của ${senderName} vừa gửi lời thách đấu cho nhóm của bạn.${invitation.Message ? `\n\nLời nhắn: "${invitation.Message}"` : ""}`;
      
      const targetMembers = await notifRepo.getTargetGroupMemberEmails(invitation.ReceiverID);
      for (const member of targetMembers) {
        if (member.UserID === invitation.SenderID) continue;

        await createNotification({
          userId: member.UserID,
          title: title,
          message: `Nhóm của ${senderName} vừa gửi lời thách đấu cho nhóm của bạn!`,
          notificationType: "Matching"
        });

        try {
          await sendNotificationEmail({
            to: member.Email,
            fullName: member.FullName,
            type: type,
            subject: subject,
            title: title,
            message: message,
            actionUrl: `${FRONTEND_URL}/matching`,
            actionText: "Xem lời mời",
          });

          await notifRepo.createEmailLog({
            userId: member.UserID,
            email: member.Email,
            notificationType: type,
            refType: "PlayInvitation",
            refId: invitation.InvitationID,
            status: "Sent"
          });
        } catch (err: any) {
          await notifRepo.createEmailLog({
            userId: member.UserID,
            email: member.Email,
            notificationType: type,
            refType: "PlayInvitation",
            refId: invitation.InvitationID,
            status: "Failed",
            errorMessage: err.message || "Unknown error"
          });
        }
      }
      return;
    } else if (invitation.InvitationType === "InviteToPlay" || invitation.InvitationType === "InviteToGroup" || invitation.InvitationType === "RequestJoinGroup" || (invitation.Message && (invitation.Message.includes('"Type":"InviteToPlay"') || invitation.Message.includes('"Type":"InviteToGroup"') || invitation.Message.includes('"Type":"RequestJoinGroup"')))) {
      toUserId = invitation.ReceiverID;
      const msgStr = invitation.Message || "";
      const isRequestJoin = invitation.InvitationType === "RequestJoinGroup" || msgStr.includes('"Type":"RequestJoinGroup"');
      const isInviteTeam = invitation.InvitationType === "InviteToPlay" || msgStr.includes('"Type":"InviteToPlay"');

      type = isInviteTeam ? "TEAM_INVITATION" : (isRequestJoin ? "JOIN_GROUP_REQUEST" : "GROUP_INVITATION");
      subject = isInviteTeam ? "Bạn có lời mời ghép đội mới" : (isRequestJoin ? "Bạn có yêu cầu xin gia nhập nhóm" : `Bạn được mời tham gia nhóm`);
      title = isInviteTeam ? "Lời mời ghép đội" : (isRequestJoin ? "Yêu cầu gia nhập nhóm" : "Lời mời tham gia nhóm");
      message = isRequestJoin ? `${senderName} muốn xin gia nhập vào nhóm của bạn.${invitation.Message ? `\n\nLời nhắn: "${invitation.Message}"` : ""}` : `${senderName} vừa gửi cho bạn một ${title.toLowerCase()}.${invitation.Message ? `\n\nLời nhắn: "${invitation.Message}"` : ""}`;

      if (toUserId) {
        await createNotification({
          userId: toUserId,
          title: title,
          message: isRequestJoin ? `${senderName} muốn xin gia nhập vào nhóm của bạn.` : `${senderName} vừa gửi cho bạn một ${title.toLowerCase()}.`,
          notificationType: "Matching"
        });
      }
    }

    if (!toUserId) return;

    const receiverInfo = await notifRepo.getUserEmailInfo(toUserId);
    if (!receiverInfo || receiverInfo.UserID === invitation.SenderID) return;

    try {
      await sendNotificationEmail({
        to: receiverInfo.Email,
        fullName: receiverInfo.FullName,
        type: type,
        subject: subject,
        title: title,
        message: message,
        actionUrl: `${FRONTEND_URL}/matching`,
        actionText: "Xem lời mời",
      });

      await notifRepo.createEmailLog({
        userId: receiverInfo.UserID,
        email: receiverInfo.Email,
        notificationType: type,
        refType: "PlayInvitation",
        refId: invitation.InvitationID,
        status: "Sent"
      });
    } catch (err: any) {
      await notifRepo.createEmailLog({
        userId: receiverInfo.UserID,
        email: receiverInfo.Email,
        notificationType: type,
        refType: "PlayInvitation",
        refId: invitation.InvitationID,
        status: "Failed",
        errorMessage: err.message || "Unknown error"
      });
    }
  } catch (error) {
    console.error("[Notification] notifyPlayInvitationCreated error:", error);
  }
}

/**
 * Gửi email khi lời mời được chấp nhận/từ chối
 */
export async function notifyInvitationStatusChanged(invitation: any, status: 'Accepted' | 'Rejected') {
  try {
    // Gửi cho người tạo lời mời (SenderID)
    const receiverInfo = await notifRepo.getUserEmailInfo(invitation.SenderID);
    if (!receiverInfo) return;

    const responderInfo = await notifRepo.getUserEmailInfo(invitation.ReceiverID);
    const responderName = responderInfo ? responderInfo.FullName : "Người nhận";

    const type = status === 'Accepted' ? "INVITATION_ACCEPTED" : "INVITATION_REJECTED";
    const subject = status === 'Accepted' ? "Lời mời của bạn đã được chấp nhận" : "Lời mời của bạn đã bị từ chối";
    const title = status === 'Accepted' ? "Chấp nhận lời mời" : "Từ chối lời mời";
    const message = `${responderName} đã ${status === 'Accepted' ? 'chấp nhận' : 'từ chối'} lời mời của bạn.`;

    await createNotification({
      userId: invitation.SenderID,
      title: title,
      message: `${responderName} đã ${status === 'Accepted' ? 'chấp nhận' : 'từ chối'} lời mời của bạn.`,
      notificationType: "Matching"
    });

    try {
      await sendNotificationEmail({
        to: receiverInfo.Email,
        fullName: receiverInfo.FullName,
        type: type,
        subject: subject,
        title: title,
        message: message,
        actionUrl: `${FRONTEND_URL}/matching`,
        actionText: "Xem thông tin",
      });

      await notifRepo.createEmailLog({
        userId: receiverInfo.UserID,
        email: receiverInfo.Email,
        notificationType: type,
        refType: "PlayInvitation",
        refId: invitation.InvitationID,
        status: "Sent"
      });
    } catch (err: any) {
      await notifRepo.createEmailLog({
        userId: receiverInfo.UserID,
        email: receiverInfo.Email,
        notificationType: type,
        refType: "PlayInvitation",
        refId: invitation.InvitationID,
        status: "Failed",
        errorMessage: err.message || "Unknown error"
      });
    }
  } catch (error) {
    console.error("[Notification] notifyInvitationStatusChanged error:", error);
  }
}

/**
 * Gửi email khi đặt sân nhóm (thách đấu) thành công cho 2 đội trưởng (đội đặt sân & đội đối thủ)
 */
export async function notifyTeamBookingCreatedEmail(params: {
  creatorUserId: number;
  opponentLeaderIds: number[];
  bookingCode: string;
  courtName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
}) {
  try {
    const creatorInfo = await notifRepo.getUserEmailInfo(params.creatorUserId);
    const creatorName = creatorInfo ? creatorInfo.FullName : "Đội đối thủ";

    // 1. Gửi email cho đội trưởng đặt sân
    if (creatorInfo) {
      try {
        await sendNotificationEmail({
          to: creatorInfo.Email,
          fullName: creatorInfo.FullName,
          type: "TEAM_BOOKING_CREATED",
          subject: `[PickleClub] Chốt sân trận giao hữu thành công - ${params.bookingCode}`,
          title: "Chốt Sân Trận Giao Hữu",
          message: `Bạn đã đặt sân thành công cho trận đấu giao hữu với đội đối thủ.\n\nThông tin chi tiết:\n• Mã đặt sân: #${params.bookingCode}\n• Sân bóng: ${params.courtName}\n• Ngày thi đấu: ${params.bookingDate}\n• Khung giờ: ${params.startTime} - ${params.endTime}\n\nHãy thông báo với đồng đội chuẩn bị và có mặt đúng giờ nhé!`,
          actionUrl: `${FRONTEND_URL}/matching`,
          actionText: "Xem trận đấu",
        });

        await notifRepo.createEmailLog({
          userId: creatorInfo.UserID,
          email: creatorInfo.Email,
          notificationType: "TEAM_BOOKING_CREATED",
          refType: "TeamBooking",
          status: "Sent"
        });
      } catch (err: any) {
        await notifRepo.createEmailLog({
          userId: creatorInfo.UserID,
          email: creatorInfo.Email,
          notificationType: "TEAM_BOOKING_CREATED",
          refType: "TeamBooking",
          status: "Failed",
          errorMessage: err.message || "Unknown error"
        });
      }
    }

    // 2. Gửi email cho (các) đội trưởng đối thủ
    for (const oppId of params.opponentLeaderIds) {
      const oppInfo = await notifRepo.getUserEmailInfo(oppId);
      if (!oppInfo) continue;

      try {
        await sendNotificationEmail({
          to: oppInfo.Email,
          fullName: oppInfo.FullName,
          type: "TEAM_BOOKING_OPPONENT_CREATED",
          subject: `[PickleClub] Đối thủ đã chốt sân trận giao hữu - ${params.bookingCode}`,
          title: "Đối Thủ Đã Chốt Sân",
          message: `Đội của ${creatorName} đã đặt sân thành công cho trận giao hữu thách đấu với đội của bạn.\n\nThông tin chi tiết:\n• Mã đặt sân: #${params.bookingCode}\n• Sân bóng: ${params.courtName}\n• Ngày thi đấu: ${params.bookingDate}\n• Khung giờ: ${params.startTime} - ${params.endTime}\n\nHãy thông báo với đồng đội chuẩn bị và có mặt tại sân đúng giờ nhé!`,
          actionUrl: `${FRONTEND_URL}/matching`,
          actionText: "Xem chi tiết",
        });

        await notifRepo.createEmailLog({
          userId: oppInfo.UserID,
          email: oppInfo.Email,
          notificationType: "TEAM_BOOKING_OPPONENT_CREATED",
          refType: "TeamBooking",
          status: "Sent"
        });
      } catch (err: any) {
        await notifRepo.createEmailLog({
          userId: oppInfo.UserID,
          email: oppInfo.Email,
          notificationType: "TEAM_BOOKING_OPPONENT_CREATED",
          refType: "TeamBooking",
          status: "Failed",
          errorMessage: err.message || "Unknown error"
        });
      }
    }
  } catch (error) {
    console.error("[Notification] notifyTeamBookingCreatedEmail error:", error);
  }
}

