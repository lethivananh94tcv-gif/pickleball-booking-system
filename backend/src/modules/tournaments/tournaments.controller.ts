// ============================================================
// tournaments.controller.ts
// HTTP handlers for the Tournament module
// ============================================================

import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/utils/response";
import { handleError } from "@/middlewares/error";
import { requireAuth } from "@/middlewares/auth.middleware";
import { requireRoles } from "@/middlewares/role.middleware";
import { 
  createTournamentSchema, 
  updateTournamentSchema, 
  createDivisionSchema, 
  updateDivisionSchema,
  registerSinglesSchema,
  registerDoublesSchema,
  respondInvitationSchema,
  createTournamentPaymentSchema,
  generateScheduleSchema,
  reportMatchScoreSchema,
  updateRoundMilestonesSchema
} from "./tournaments.validation";
import * as tournamentService from "./tournaments.service";

/**
 * GET /api/tournaments
 */
export async function getTournamentsController(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const keyword = searchParams.get("keyword") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const list = await tournamentService.getAllTournaments({ status, keyword, startDate, endDate });
    return successResponse(list, "Lấy danh sách giải đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/tournaments/:id
 */
export async function getTournamentByIdController(req: NextRequest, params: { id: string }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return errorResponse("ID giải đấu không hợp lệ", 400);
    }

    const tournament = await tournamentService.getTournamentById(id);
    return successResponse(tournament, "Lấy thông tin giải đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments
 */
export async function createTournamentController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = createTournamentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    const tournament = await tournamentService.createTournament(parseResult.data, auth.userId);
    return successResponse(tournament, "Tạo giải đấu mới thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/tournaments/:id
 */
export async function updateTournamentController(req: NextRequest, params: { id: string }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return errorResponse("ID giải đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = updateTournamentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    const tournament = await tournamentService.updateTournament(id, parseResult.data, auth.userId);
    return successResponse(tournament, "Cập nhật giải đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/publish
 */
export async function publishTournamentController(req: NextRequest, params: { id: string }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return errorResponse("ID giải đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const result = await tournamentService.publishTournament(id, auth.userId);
    return successResponse(result, "Công bố giải đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/close-registration
 */
export async function closeRegistrationController(req: NextRequest, params: { id: string }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return errorResponse("ID giải đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const result = await tournamentService.closeRegistration(id, auth.userId);
    return successResponse(result, "Đóng đăng ký giải đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/cancel
 */
export async function cancelTournamentController(req: NextRequest, params: { id: string }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return errorResponse("ID giải đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const result = await tournamentService.cancelTournament(id, auth.userId);
    return successResponse(result, "Hủy giải đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/tournaments/:id
 */
export async function deleteTournamentController(req: NextRequest, params: { id: string }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return errorResponse("ID giải đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const result = await tournamentService.deleteTournament(id, auth.userId);
    return successResponse(result, "Xóa giải đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/tournaments/:id/divisions
 */
export async function getDivisionsController(req: NextRequest, params: { id: string }) {
  try {
    const tournamentId = parseInt(params.id, 10);
    if (isNaN(tournamentId)) {
      return errorResponse("ID giải đấu không hợp lệ", 400);
    }

    const list = await tournamentService.getDivisionsByTournamentId(tournamentId);
    return successResponse(list, "Lấy danh sách nội dung thi đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/divisions
 */
export async function createDivisionController(req: NextRequest, params: { id: string }) {
  try {
    const tournamentId = parseInt(params.id, 10);
    if (isNaN(tournamentId)) {
      return errorResponse("ID giải đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = createDivisionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    const division = await tournamentService.createDivision(tournamentId, parseResult.data, auth.userId);
    return successResponse(division, "Tạo nội dung thi đấu thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/tournaments/:id/divisions/:divisionId
 */
export async function getDivisionByIdController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(divisionId)) {
      return errorResponse("ID nội dung thi đấu không hợp lệ", 400);
    }

    const division = await tournamentService.getDivisionById(divisionId);
    return successResponse(division, "Lấy thông tin nội dung thi đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/tournaments/:id/divisions/:divisionId
 */
export async function updateDivisionController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(divisionId)) {
      return errorResponse("ID nội dung thi đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = updateDivisionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    const division = await tournamentService.updateDivision(divisionId, parseResult.data, auth.userId);
    return successResponse(division, "Cập nhật nội dung thi đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/divisions/:divisionId/register-singles
 */
export async function registerSinglesController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const tournamentId = parseInt(params.id, 10);
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(tournamentId) || isNaN(divisionId)) {
      return errorResponse("Tham số ID giải hoặc nội dung không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    // BR-T03: Player must be logged in. Roles allowed: Player. (Admin/Staff can also test/access if needed, but let's restrict to Player as requested: Player only)
    const roleError = requireRoles(auth, ["Player"]);
    if (roleError) return roleError;

    // Empty body check just to satisfy validation schema pattern
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = registerSinglesSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    const registration = await tournamentService.registerSingles(tournamentId, divisionId, auth.userId, parseResult.data);
    return successResponse(registration, "Đăng ký thi đấu đơn thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/divisions/:divisionId/register-doubles
 */
export async function registerDoublesController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const tournamentId = parseInt(params.id, 10);
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(tournamentId) || isNaN(divisionId)) {
      return errorResponse("Tham số ID giải hoặc nội dung không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Player"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = registerDoublesSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    const result = await tournamentService.registerDoubles(tournamentId, divisionId, auth.userId, parseResult.data);
    return successResponse(result, "Xử lý đăng ký ghép đôi thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournament-team-invitations/:invitationId/respond
 */
export async function respondInvitationController(
  req: NextRequest,
  params: { invitationId: string }
) {
  try {
    const invitationId = parseInt(params.invitationId, 10);
    if (isNaN(invitationId)) {
      return errorResponse("ID lời mời không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Player"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = respondInvitationSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    const result = await tournamentService.respondInvitation(invitationId, auth.userId, parseResult.data.action);
    return successResponse(result, "Phản hồi lời mời thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/tournaments/:id/divisions/:divisionId/suggested-partners
 */
export async function getSuggestedPartnersController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(divisionId)) {
      return errorResponse("ID nội dung thi đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Player"]);
    if (roleError) return roleError;

    const list = await tournamentService.findSuggestedPartners(divisionId, auth.userId);
    return successResponse(list, "Lấy danh sách gợi ý đồng đội thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournament-payments/create
 */
export async function createTournamentPaymentController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Player"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = createTournamentPaymentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    const result = await tournamentService.createTournamentPayment(
      parseResult.data.registrationId,
      parseResult.data.paymentMethod,
      auth.userId
    );
    return successResponse(result, "Tạo thông tin thanh toán lệ phí thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournament-payments/webhook
 */
export async function tournamentPaymentWebhookController(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const { paymentId, transactionCode, gatewayResponse, success } = rawBody;

    if (!paymentId || !transactionCode) {
      return errorResponse("Thiếu thông tin giao dịch bắt buộc", 400);
    }

    const result = await tournamentService.handleTournamentPaymentWebhook({
      paymentId: parseInt(paymentId, 10),
      transactionCode,
      gatewayResponse: gatewayResponse || "",
      success: !!success,
    });

    return successResponse(result, "Xử lý webhook thanh toán thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/divisions/:divisionId/generate-bracket
 */
export async function generateBracketController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const tournamentId = parseInt(params.id, 10);
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(tournamentId) || isNaN(divisionId)) {
      return errorResponse("Tham số ID giải hoặc nội dung không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const randomize = !!rawBody.randomize;

    const matches = await tournamentService.generateBracket(tournamentId, divisionId, auth.userId, randomize);
    return successResponse(matches, "Khởi tạo nhánh đấu loại trực tiếp thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/divisions/:divisionId/generate-schedule
 */
export async function generateScheduleController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const tournamentId = parseInt(params.id, 10);
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(tournamentId) || isNaN(divisionId)) {
      return errorResponse("Tham số ID giải hoặc nội dung không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const randomize = !!rawBody.randomize;

    const matches = await tournamentService.generateRoundRobinMatches(tournamentId, divisionId, auth.userId, randomize);
    return successResponse(matches, "Khởi tạo lịch đấu vòng tròn thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/tournaments/:id/divisions/:divisionId/matches
 */
export async function getDivisionMatchesController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(divisionId)) {
      return errorResponse("ID nội dung thi đấu không hợp lệ", 400);
    }

    const list = await tournamentService.getDivisionMatches(divisionId);
    return successResponse(list, "Lấy danh sách trận đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/tournaments/:id/divisions/:divisionId/standings
 */
export async function getDivisionStandingsController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(divisionId)) {
      return errorResponse("ID nội dung thi đấu không hợp lệ", 400);
    }

    const list = await tournamentService.getDivisionStandings(divisionId);
    return successResponse(list, "Lấy bảng xếp hạng thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/divisions/:divisionId/allocate-schedule
 */
export async function allocateDivisionScheduleController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const tournamentId = parseInt(params.id, 10);
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(tournamentId) || isNaN(divisionId)) {
      return errorResponse("Tham số ID giải hoặc nội dung không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = generateScheduleSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    const matches = await tournamentService.allocateDivisionSchedule(
      tournamentId,
      divisionId,
      parseResult.data,
      auth.userId
    );
    return successResponse(matches, "Phân bổ lịch thi đấu và sân thi đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/matches/:matchId/score
 */
export async function reportMatchScoreController(
  req: NextRequest,
  params: { id: string; matchId: string }
) {
  try {
    const matchId = parseInt(params.matchId, 10);
    if (isNaN(matchId)) {
      return errorResponse("ID trận đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    // Check role is Admin, Staff, or Player
    const roleError = requireRoles(auth, ["Admin", "Staff", "Player"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = reportMatchScoreSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu tỷ số không hợp lệ", 400, parseResult.error.flatten());
    }

    const userRole = auth.roles.includes("Admin")
      ? "Admin"
      : auth.roles.includes("Staff")
      ? "Staff"
      : "Player";

    const updated = await tournamentService.reportMatchScore(
      matchId,
      parseResult.data,
      { userId: auth.userId, role: userRole }
    );
    return successResponse(updated, "Báo cáo tỷ số trận đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/matches/:matchId/ready
 */
export async function setMatchReadyController(
  req: NextRequest,
  params: { id: string; matchId: string }
) {
  try {
    const matchId = parseInt(params.matchId, 10);
    if (isNaN(matchId)) return errorResponse("ID trận đấu không hợp lệ", 400);

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin", "Staff"]);
    if (roleError) return roleError;

    const updated = await tournamentService.setMatchReady(matchId, auth.userId);
    return successResponse(updated, "Trận đấu sẵn sàng thi đấu (Ready)");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/matches/:matchId/start
 */
export async function startMatchController(
  req: NextRequest,
  params: { id: string; matchId: string }
) {
  try {
    const matchId = parseInt(params.matchId, 10);
    if (isNaN(matchId)) return errorResponse("ID trận đấu không hợp lệ", 400);

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin", "Staff"]);
    if (roleError) return roleError;

    const userRole = Array.isArray(auth.roles) && auth.roles.length > 0 ? auth.roles[0] : (auth.role || "Player");

    let adminOverride = false;
    let reason = "";
    try {
      const body = await req.json();
      adminOverride = !!body.adminOverride;
      reason = body.reason || body.actionReason || "";
    } catch (e) {
      const { searchParams } = new URL(req.url);
      adminOverride = searchParams.get("adminOverride") === "true";
      reason = searchParams.get("reason") || "";
    }

    const updated = await tournamentService.startMatch(matchId, auth.userId, userRole, adminOverride, reason);
    return successResponse(updated, "Trận đấu bắt đầu (InProgress)");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/tournaments/:id/divisions/:divisionId/registrations
 */
export async function getDivisionRegistrationsController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(divisionId)) {
      return errorResponse("ID nội dung thi đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin", "Staff"]);
    if (auth instanceof Response) return auth;

    const data = await tournamentService.getDivisionRegistrations(divisionId);
    return successResponse(data);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/tournaments/:id/divisions/:divisionId/matches
 */
export async function deleteDivisionMatchesController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(divisionId)) {
      return errorResponse("ID nội dung thi đấu không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin", "Staff"]);
    if (roleError) return roleError;

    await tournamentService.resetDivisionMatches(divisionId);
    return successResponse(null, "Đã xóa toàn bộ lịch thi đấu của nội dung này");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournament-registrations/:registrationId/action
 */
export async function updateRegistrationActionController(
  req: NextRequest,
  params: { registrationId: string }
) {
  try {
    const registrationId = parseInt(params.registrationId, 10);
    if (isNaN(registrationId)) {
      return errorResponse("ID đăng ký không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin", "Staff"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    if (!rawBody.action || (rawBody.action !== "reject" && typeof rawBody.value !== "boolean")) {
      return errorResponse("Dữ liệu không hợp lệ. Yêu cầu action và value (boolean)", 400);
    }

    const updated = await tournamentService.updateRegistrationAction(
      registrationId,
      { action: rawBody.action, value: rawBody.value },
      auth.userId
    );
    return successResponse(updated, "Cập nhật hành động đăng ký thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/divisions/:divisionId/generate-groups
 */
export async function generateGroupsController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const tournamentId = parseInt(params.id, 10);
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(tournamentId) || isNaN(divisionId)) {
      return errorResponse("Tham số ID giải hoặc nội dung không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const groupCount = parseInt(rawBody.groupCount, 10);
    if (isNaN(groupCount) || groupCount < 2) {
      return errorResponse("Số lượng bảng đấu phải từ 2 trở lên", 400);
    }

    const randomize = !!rawBody.randomize;

    const matches = await tournamentService.generateGroupKnockoutMatches(
      tournamentId,
      divisionId,
      groupCount,
      auth.userId,
      randomize
    );
    return successResponse(matches, "Khởi tạo lịch đấu vòng bảng thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/divisions/:divisionId/generate-knockout
 */
export async function generateKnockoutController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const tournamentId = parseInt(params.id, 10);
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(tournamentId) || isNaN(divisionId)) {
      return errorResponse("Tham số ID giải hoặc nội dung không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const randomize = !!rawBody.randomize;

    const matches = await tournamentService.generateGroupKnockoutBracket(
      tournamentId,
      divisionId,
      auth.userId,
      randomize
    );
    return successResponse(matches, "Tạo nhánh loại trực tiếp chéo thành công", 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournaments/:id/divisions/:divisionId/round-milestones
 */
export async function updateRoundMilestonesController(
  req: NextRequest,
  params: { id: string; divisionId: string }
) {
  try {
    const tournamentId = parseInt(params.id, 10);
    const divisionId = parseInt(params.divisionId, 10);
    if (isNaN(tournamentId) || isNaN(divisionId)) {
      return errorResponse("Tham số ID giải hoặc nội dung không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = updateRoundMilestonesSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse("Dữ liệu không hợp lệ", 400, parseResult.error.flatten());
    }

    await tournamentService.updateRoundMilestones(
      tournamentId,
      divisionId,
      parseResult.data.milestones,
      auth.userId
    );
    return successResponse(null, "Cập nhật cột mốc thời gian các vòng đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tournament-registrations/:registrationId/send-certificate
 */
export async function sendCertificateEmailController(
  req: NextRequest,
  params: { registrationId: string }
) {
  try {
    const registrationId = parseInt(params.registrationId, 10);
    if (isNaN(registrationId)) {
      return errorResponse("ID đăng ký không hợp lệ", 400);
    }

    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleError = requireRoles(auth, ["Admin"]);
    if (roleError) return roleError;

    const rawBody = await req.json().catch(() => ({}));
    const rankOverride = rawBody.rankOverride || "auto";

    const result = await tournamentService.sendCertificateEmail(
      registrationId,
      rankOverride,
      auth.userId
    );
    return successResponse(result, "Gửi email chứng nhận giải đấu thành công");
  } catch (error) {
    return handleError(error);
  }
}



