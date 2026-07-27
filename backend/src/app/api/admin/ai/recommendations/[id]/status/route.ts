import { NextRequest } from "next/server";
import { applySecurity } from "@/modules/ai/ai-security.middleware";
import { updateRecommendation } from "@/modules/ai/ai-analytics.controller";
import { successResponse } from "@/utils/response";
import { handleError } from "@/middlewares/error";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = applySecurity(req, ["Admin", "Manager"]);
    if (auth instanceof Response) return auth;

    const params = await context.params;
    const recommendationId = Number(params.id);

    const body = await req.json();
    const { status, customDiscount, customMarketingMessage } = body;

    const result = await updateRecommendation(
      recommendationId,
      status,
      auth.userId,
      customDiscount !== undefined && customDiscount !== null ? Number(customDiscount) : undefined,
      customMarketingMessage
    );
    return successResponse(result, "Cập nhật trạng thái đề xuất thành công");
  } catch (error) {
    return handleError(error);
  }
}
