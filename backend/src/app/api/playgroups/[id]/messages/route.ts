import { NextRequest } from "next/server";
import { errorResponse } from "@/utils/response";
import { getGroupMessagesController, sendGroupMessageController } from "@/modules/playgroups/playgroups.controller";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const groupId = parseInt(resolvedParams.id, 10);
  if (isNaN(groupId)) {
    return errorResponse("ID nhóm chơi không hợp lệ", 400);
  }
  return getGroupMessagesController(req, groupId);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const groupId = parseInt(resolvedParams.id, 10);
  if (isNaN(groupId)) {
    return errorResponse("ID nhóm chơi không hợp lệ", 400);
  }
  return sendGroupMessageController(req, groupId);
}
