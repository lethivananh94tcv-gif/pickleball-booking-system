import type { NextRequest } from "next/server";
import { unlockUserController } from "@/modules/roles/roles.controller";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }>;}
) {
  const params = await context.params;
  const userId = Number(params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json(
      { success: false, message: "Mã người dùng không hợp lệ" },
      { status: 400 }
    );
  }

  return unlockUserController(req, userId);
}
