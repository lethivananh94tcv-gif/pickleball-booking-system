import { NextRequest, NextResponse } from "next/server";
import { processChatbotMessage } from "@/modules/ai/ai.controller";
import { verifyAccessToken } from "@/utils/jwt";
import { getTokenFromRequest } from "@/middlewares/auth.middleware";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    let userId: number | undefined = undefined;
    let userRoles: string[] = [];

    const token = getTokenFromRequest(req);
    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        userId = decoded.userId;
        userRoles = decoded.roles || [];
      } catch (jwtError) {
        console.warn("Invalid JWT in chatbot route:", jwtError);
      }
    }

    const result = await processChatbotMessage(body, userId, userRoles);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
