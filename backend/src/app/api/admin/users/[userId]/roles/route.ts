import type {
  NextRequest,
} from "next/server";

import {
  assignRolesController,
} from "@/modules/roles/roles.controller";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function PUT(
  req: NextRequest,
  context: RouteContext
) {
  const params =
    await context.params;

  const userId =
    Number(params.userId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Mã người dùng không hợp lệ",
      },
      {
        status: 400,
      }
    );
  }

  return assignRolesController(
    req,
    userId
  );
}