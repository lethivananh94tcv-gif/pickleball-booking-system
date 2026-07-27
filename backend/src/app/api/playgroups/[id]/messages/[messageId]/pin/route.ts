import { NextRequest } from "next/server";
import { pinGroupMessageController } from "@/modules/playgroups/playgroups.controller";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const resolvedParams = await params;
  const groupId = parseInt(resolvedParams.id, 10);
  const messageId = parseInt(resolvedParams.messageId, 10);
  return pinGroupMessageController(req, groupId, messageId);
}
