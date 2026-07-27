import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/utils/response";
import { handleError } from "@/middlewares/error";
import { requireAuth } from "@/middlewares/auth.middleware";
import * as service from "./playgroups.service";

export async function listPlayGroupsController(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const skillLevel = searchParams.get("skillLevel") || undefined;
    const keyword = searchParams.get("keyword") || undefined;

    const groups = await service.getPlayGroups({ skillLevel, keyword });
    return successResponse(groups, "Lấy danh sách nhóm chơi thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function createPlayGroupController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const body = await req.json();
    if (!body.groupName || !body.skillLevel) {
      return errorResponse("Vui lòng nhập tên nhóm và cấp độ kỹ năng", 400);
    }

    const group = await service.createPlayGroup(
      {
        groupName: body.groupName,
        maxPlayers: 4, // Max size constraint from requirements
        skillLevel: body.skillLevel,
        description: body.description || "",
      },
      auth.userId
    );

    return successResponse(group, "Tạo nhóm chơi thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function getPlayGroupDetailsController(req: NextRequest, groupId: number) {
  try {
    const group = await service.getPlayGroupDetails(groupId);
    return successResponse(group, "Lấy chi tiết nhóm chơi thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function joinPlayGroupController(req: NextRequest, groupId: number) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const group = await service.joinPlayGroup(groupId, auth.userId);
    return successResponse(group, "Tham gia nhóm chơi thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function leavePlayGroupController(req: NextRequest, groupId: number) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const result = await service.leavePlayGroup(groupId, auth.userId);
    return successResponse(result, "Rời nhóm chơi thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function closePlayGroupController(req: NextRequest, groupId: number) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const group = await service.closePlayGroup(groupId, auth.userId);
    return successResponse(group, "Đóng nhóm chơi thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function updatePlayGroupController(req: NextRequest, groupId: number) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const body = await req.json();
    const group = await service.updatePlayGroup(
      groupId,
      auth.userId,
      {
        groupName: body.groupName,
        skillLevel: body.skillLevel,
        averageExperience: body.averageExperience,
        description: body.description,
        status: body.status,
      }
    );

    return successResponse(group, "Cập nhật nhóm chơi thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function getGroupMessagesController(req: NextRequest, groupId: number) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const messages = await service.getGroupMessages(groupId, auth.userId);
    return successResponse(messages, "Lấy danh sách tin nhắn thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function sendGroupMessageController(req: NextRequest, groupId: number) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const body = await req.json();
    const message = await service.sendGroupMessage(groupId, auth.userId, body.content);
    return successResponse(message, "Gửi tin nhắn thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function getUnreadCountsController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const counts = await service.getUnreadCounts(auth.userId);
    return successResponse(counts, "Lấy số lượng tin nhắn chưa đọc thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function markMessagesAsReadController(req: NextRequest, groupId: number) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    await service.markMessagesAsRead(auth.userId, groupId);
    return successResponse(null, "Đánh dấu đã đọc thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function pinGroupMessageController(req: NextRequest, groupId: number, messageId: number) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    await service.pinGroupMessage(groupId, messageId, auth.userId);
    return successResponse(null, "Ghim tin nhắn thành công");
  } catch (error) {
    return handleError(error);
  }
}

