import { NextRequest } from "next/server";
import * as favService from "./favorites.service";
import { successResponse, errorResponse } from "@/utils/response";
import { handleError } from "@/middlewares/error";
import { requireAuth } from "@/middlewares/auth.middleware";

export async function getUserFavoritesController(req: NextRequest) {
  try {
    const user = requireAuth(req);
    if (user instanceof Response) return user;

    const favorites = await favService.getFavorites(user.UserID);
    return successResponse(favorites, "Lấy danh sách yêu thích thành công");
  } catch (error) {
    return handleError(error);
  }
}

export async function toggleFavoriteController(req: NextRequest) {
  try {
    const user = requireAuth(req);
    if (user instanceof Response) return user;

    const body = await req.json();
    const { targetType, targetId } = body;

    if (!targetType || !targetId) {
      return errorResponse("Thiếu thông tin targetType hoặc targetId", 400);
    }

    if (targetType !== "Court" && targetType !== "Coach") {
      return errorResponse("targetType phải là Court hoặc Coach", 400);
    }

    const isFavorite = await favService.toggleFavorite(
      user.UserID,
      targetType,
      Number(targetId)
    );

    return successResponse(
      { isFavorite },
      isFavorite ? "Đã thêm vào danh sách yêu thích" : "Đã xóa khỏi danh sách yêu thích"
    );
  } catch (error) {
    return handleError(error);
  }
}
