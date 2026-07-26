import { NextRequest } from "next/server";
import { errorResponse } from "@/utils/response";
import { verifyAccessToken } from "@/utils/jwt";
import type { JwtPayload } from "@/modules/auth/auth.type";

export type AuthRequest = NextRequest & {
  user?: JwtPayload;
};

export function getTokenFromRequest(req: NextRequest) {
  // 1. Check HttpOnly cookie first
  const cookieToken = req.cookies.get("token")?.value;
  if (cookieToken) {
    return cookieToken;
  }

  // 2. Fallback to Authorization header
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "");
}

export function requireAuth(req: NextRequest): JwtPayload | Response {
  const token = getTokenFromRequest(req);

  if (!token) {
    return errorResponse("Bạn chưa đăng nhập", 401);
  }

  try {
    return verifyAccessToken(token);
  } catch {
    return errorResponse("Token không hợp lệ hoặc đã hết hạn", 401);
  }
}