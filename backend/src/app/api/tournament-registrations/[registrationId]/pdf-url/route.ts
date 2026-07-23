import { NextRequest } from "next/server";
import { requireAuth } from "@/middlewares/auth.middleware";
import { requireRoles } from "@/middlewares/role.middleware";
import { errorResponse, successResponse } from "@/utils/response";
import { handleError } from "@/middlewares/error";
import * as tournamentService from "@/modules/tournaments/tournaments.service";

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ registrationId: string }> }
) {
  try {
    const params = await props.params;
    const registrationId = parseInt(params.registrationId, 10);
    if (isNaN(registrationId)) {
      return errorResponse("ID đăng ký không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const pdfUrl = rawBody.pdfUrl || null;

    await tournamentService.updateCertificatePdfUrl(registrationId, pdfUrl, auth.userId);
    return successResponse(null, "Cập nhật đường dẫn file PDF chứng chỉ thành công");
  } catch (error) {
    return handleError(error);
  }
}
