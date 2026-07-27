// ==========================================
// refunds.controller.ts
// HTTP handlers cho Refund module
// ==========================================

import { NextRequest } from "next/server";
import { successResponse } from "@/utils/response";
import { handleError } from "@/middlewares/error";
import { requireAuth } from "@/middlewares/auth.middleware";
import { requireRoles } from "@/middlewares/role.middleware";
import * as refundService from "./refunds.service";
import {
  validateRequestRefundBody,
  validateApproveRefundBody,
  validateProcessRefundBody,
  validateCompleteManualBody,
  validateRejectRefundBody,
} from "./refunds.validation";

// ── POST /api/refunds/request ──────────────────────────

/**
 * Player yêu cầu hoàn tiền.
 * Body: { bookingId: number, reason: string }
 * Không nhận refundAmount từ frontend — backend tự tính (BR-71).
 */
export async function requestRefundController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const body = await req.json();
    const validation = validateRequestRefundBody(body);
    if (!validation.valid) {
      throw Object.assign(new Error(validation.error), { statusCode: 400 });
    }

    const result = await refundService.requestRefund(
      Number(body.bookingId),
      auth.userId,
      body.reason.trim()
    );

    return successResponse(result, "Yêu cầu hoàn tiền đã được gửi.", 201);
  } catch (error) {
    return handleError(error);
  }
}

// ── GET /api/refunds/my ────────────────────────────────

/**
 * Player xem danh sách refund của chính mình.
 */
export async function getMyRefundsController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const result = await refundService.getMyRefunds(auth.userId);
    return successResponse(result, "Lấy danh sách hoàn tiền thành công.");
  } catch (error) {
    return handleError(error);
  }
}

// ── GET /api/refunds/manager ───────────────────────────

/**
 * Manager/Admin xem tất cả refund requests.
 * Query params tùy chọn: status, paymentMethod, dateFrom, dateTo
 */
export async function getManagerRefundsController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRoles(auth, ["Admin", "Manager", "Staff"]);
    if (roleCheck) return roleCheck;

    const { searchParams } = new URL(req.url);
    const filters = {
      status: searchParams.get("status") || undefined,
      paymentMethod: searchParams.get("paymentMethod") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
    };

    const result = await refundService.getManagerRefunds(filters);
    return successResponse(result, "Lấy danh sách hoàn tiền thành công.");
  } catch (error) {
    return handleError(error);
  }
}

// ── GET /api/refunds/status?refundCode=RF-... ──────────

/**
 * Xem trạng thái refund theo refundCode.
 * Player chỉ xem của mình. Manager/Admin xem tất cả.
 */
export async function getRefundStatusController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(req.url);
    const refundCode = searchParams.get("refundCode");

    if (!refundCode || refundCode.trim().length === 0) {
      throw Object.assign(new Error("refundCode là bắt buộc."), { statusCode: 400 });
    }

    const result = await refundService.getRefundStatus(refundCode.trim());
    if (!result) {
      throw Object.assign(new Error("Không tìm thấy refund với mã này."), { statusCode: 404 });
    }

    // Player chỉ xem refund của chính mình
    const isManagerOrAdmin = auth.roles?.some((r: string) =>
      ["Admin", "Manager", "Staff"].includes(r)
    );
    if (!isManagerOrAdmin && result.CreatedBy !== auth.userId) {
      throw Object.assign(new Error("Bạn không có quyền xem refund này."), { statusCode: 403 });
    }

    return successResponse(result, "Lấy trạng thái hoàn tiền thành công.");
  } catch (error) {
    return handleError(error);
  }
}

// ── POST /api/refunds/approve ──────────────────────────

/**
 * Manager/Admin duyệt yêu cầu hoàn tiền.
 * Body: { refundCode: string }
 * Momo → Processing, PayOS → PendingManual
 */
export async function approveRefundController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRoles(auth, ["Admin", "Manager"]);
    if (roleCheck) return roleCheck;

    const body = await req.json();
    const validation = validateApproveRefundBody(body);
    if (!validation.valid) {
      throw Object.assign(new Error(validation.error), { statusCode: 400 });
    }

    const result = await refundService.approveRefund(body.refundCode.trim(), auth.userId);
    return successResponse(result, result.message);
  } catch (error) {
    return handleError(error);
  }
}

// ── POST /api/refunds/process ──────────────────────────

/**
 * Manager/Admin kích hoạt MoMo refund tự động.
 * Body: { refundCode: string }
 * Chỉ cho RefundMethod = Momo.
 * Không xử lý PayOS ở route này.
 */
export async function processRefundController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRoles(auth, ["Admin", "Manager"]);
    if (roleCheck) return roleCheck;

    const body = await req.json();
    const validation = validateProcessRefundBody(body);
    if (!validation.valid) {
      throw Object.assign(new Error(validation.error), { statusCode: 400 });
    }

    const result = await refundService.processMomoRefund(body.refundCode.trim(), auth.userId);
    return successResponse(result, result.message);
  } catch (error) {
    return handleError(error);
  }
}

// ── POST /api/refunds/complete-manual ─────────────────

/**
 * Manager/Admin xác nhận đã chuyển khoản thủ công.
 * Body: { refundCode: string, note?: string, manualTransactionCode?: string }
 * Dùng cho PayOS/VietQR hoặc mọi manual refund.
 */
export async function completeManualRefundController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRoles(auth, ["Admin", "Manager"]);
    if (roleCheck) return roleCheck;

    const formData = await req.formData();
    const refundCode = formData.get("refundCode")?.toString().trim();
    const file = formData.get("billImage") as File | null;

    if (!refundCode) {
      throw Object.assign(new Error("Mã refundCode là bắt buộc."), { statusCode: 400 });
    }

    if (!file) {
      throw Object.assign(new Error("Bắt buộc phải tải lên ảnh bill chuyển khoản."), { statusCode: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const billImage = {
      buffer,
      filename: file.name,
      mimeType: file.type,
    };

    const result = await refundService.completeManualRefund(
      refundCode,
      auth.userId,
      billImage
    );

    return successResponse(result, result.message);
  } catch (error) {
    return handleError(error);
  }
}

// ── POST /api/refunds/reject ───────────────────────────

/**
 * Manager/Admin từ chối yêu cầu hoàn tiền.
 * Body: { refundCode: string, rejectReason: string }
 */
export async function rejectRefundController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRoles(auth, ["Admin", "Manager"]);
    if (roleCheck) return roleCheck;

    const body = await req.json();
    const validation = validateRejectRefundBody(body);
    if (!validation.valid) {
      throw Object.assign(new Error(validation.error), { statusCode: 400 });
    }

    const result = await refundService.rejectRefund(
      body.refundCode.trim(),
      auth.userId,
      body.rejectReason.trim()
    );

    return successResponse(result, result.message);
  } catch (error) {
    return handleError(error);
  }
}

// ── PUT /api/refunds/update-bank-details ──────────────

/**
 * Staff/Manager/Admin cập nhật thông tin nhận tiền của khách hàng.
 * Body: { refundCode: string, bankId: string, accountNo: string, accountName: string }
 */
export async function updateRefundBankDetailsController(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRoles(auth, ["Admin", "Manager", "Staff"]);
    if (roleCheck) return roleCheck;

    const body = await req.json();
    const { refundCode, bankId, accountNo, accountName } = body;

    if (!refundCode || !bankId || !accountNo || !accountName) {
      throw Object.assign(
        new Error("Vui lòng nhập đầy đủ thông tin: refundCode, bankId, accountNo, accountName."),
        { statusCode: 400 }
      );
    }

    const result = await refundService.updateRefundBankDetails(
      refundCode.trim(),
      bankId.trim(),
      accountNo.trim(),
      accountName.trim(),
      auth.userId
    );

    return successResponse(result, "Cập nhật thông tin ngân hàng thành công.");
  } catch (error) {
    return handleError(error);
  }
}
