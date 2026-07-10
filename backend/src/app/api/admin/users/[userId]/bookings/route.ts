import { NextRequest } from "next/server";
import { requireAuth } from "@/middlewares/auth.middleware";
import { requireRoles } from "@/middlewares/role.middleware";
import { handleError } from "@/middlewares/error";
import { successResponse } from "@/utils/response";
import { findBookingsByUserId } from "@/modules/bookings/bookings.repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRoles(auth, ["Admin", "Manager", "Staff"]);
    if (roleCheck) return roleCheck;

    const userId = Number(params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return Response.json(
        { success: false, message: "userId không hợp lệ" },
        { status: 400 }
      );
    }

    const bookings = await findBookingsByUserId(userId);
    return successResponse(bookings, "Lấy lịch sử booking thành công");
  } catch (error) {
    return handleError(error);
  }
}
