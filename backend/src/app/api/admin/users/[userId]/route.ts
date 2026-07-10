import type { NextRequest } from "next/server";
import {
  getUserByIdController,
  updateUserByIdController,
} from "@/modules/users/users.controller";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

async function parseUserId(context: RouteContext) {
  const params = await context.params;
  const userId = Number(params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return userId;
}

function invalidUserIdResponse() {
  return Response.json(
    {
      success: false,
      message: "Mã người dùng không hợp lệ",
    },
    {
      status: 400,
    }
  );
}

export async function GET(req: NextRequest, context: RouteContext) {
  const userId = await parseUserId(context);
  if (!userId) return invalidUserIdResponse();

  return getUserByIdController(req, userId);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const userId = await parseUserId(context);
  if (!userId) return invalidUserIdResponse();

  return updateUserByIdController(req, userId);
}
