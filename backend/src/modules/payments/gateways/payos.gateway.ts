// ==========================================
// gateways/payos.gateway.ts
// PayOS payment gateway helper (UC-16)
// SDK version: @payos/node v2 (mới)
// API: payos.paymentRequests.create / webhooks.verify / paymentRequests.cancel
// ==========================================

import { PayOS } from "@payos/node";
import { paymentConfig } from "@/config/payment";

const cfg = paymentConfig.payos;

// ── Khởi tạo PayOS SDK instance ───────────────────────
// Constructor v2 nhận object options, không phải 3 tham số riêng lẻ
let _payosInstance: PayOS | null = null;

function getPayosInstance(): PayOS {
  if (!_payosInstance) {
    if (!cfg.clientId || !cfg.apiKey || !cfg.checksumKey) {
      throw Object.assign(
        new Error(
          "PayOS chưa được cấu hình. Kiểm tra PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY trong .env"
        ),
        { statusCode: 500 }
      );
    }
    // v2 constructor nhận object options
    _payosInstance = new PayOS({
      clientId: cfg.clientId,
      apiKey: cfg.apiKey,
      checksumKey: cfg.checksumKey,
    });
  }
  return _payosInstance;
}

// ── Types ─────────────────────────────────────────────

export type PayosCreateResult = {
  success: boolean;
  checkoutUrl: string;
  orderCode: number;
  rawResponse: string;
  errorMessage?: string;
};

export type PayosWebhookVerifyResult = {
  isValid: boolean;
  data: PayosWebhookData | null;
};

export type PayosWebhookData = {
  orderCode: number;
  amount: number;
  description: string;
  accountNumber: string;
  reference: string;
  transactionDateTime: string;
  currency: string;
  paymentLinkId: string;
  code: string;
  desc: string;
  counterAccountBankId?: string | null;
  counterAccountBankName?: string | null;
  counterAccountName?: string | null;
  counterAccountNumber?: string | null;
  virtualAccountName?: string | null;
  virtualAccountNumber?: string | null;
};

// ── Create PayOS Payment Link ──────────────────────────

/**
 * Tạo payment link qua PayOS SDK v2.
 * API: payos.paymentRequests.create(data)
 *
 * @param paymentId  - Dùng làm orderCode (integer, unique trong DB).
 * @param amount     - Số tiền VND (nguyên).
 * @param paymentCode - PaymentCode để tạo description.
 * @param bookingId  - BookingID để hiển thị thông tin.
 */
export async function createPayosPaymentLink(params: {
  paymentId: number;
  amount: number;
  paymentCode: string;
  bookingId: number;
}): Promise<PayosCreateResult> {
  const payos = getPayosInstance();

  // orderCode: payOS yêu cầu số nguyên > 0, dùng paymentId là safe vì unique
  const orderCode = Date.now();

  // description: tối đa 25 ký tự (giới hạn của payOS)
  const description = `DH${params.bookingId}`;

  const body = {
    orderCode,
    amount: Math.round(params.amount), // VND nguyên
    description,
    returnUrl: cfg.returnUrl,
    cancelUrl: cfg.cancelUrl,
    items: [
      {
        name: `Pickleball #${params.bookingId}`,
        quantity: 1,
        price: Math.round(params.amount),
      },
    ],
    // expiredAt: Unix timestamp (giây) – 10 phút kể từ bây giờ
    expiredAt: Math.floor(Date.now() / 1000) + 10 * 60,
  };

  try {
    // v2 API: paymentRequests.create()
    const response = await payos.paymentRequests.create(body);
    const rawResponse = JSON.stringify(response);

    return {
      success: true,
      checkoutUrl: response.checkoutUrl,
      orderCode,
      rawResponse,
    };
  } catch (err: any) {
    const errorMessage =
      err?.message ?? "PayOS createPaymentLink failed";

    return {
      success: false,
      checkoutUrl: "",
      orderCode,
      rawResponse: JSON.stringify({ error: errorMessage }),
      errorMessage,
    };
  }
}

// ── Verify Webhook ─────────────────────────────────────

/**
 * Verify webhook signature từ PayOS bằng SDK v2.
 * API: payos.webhooks.verify(body) – async, trả WebhookData nếu hợp lệ.
 * Throw nếu signature không hợp lệ.
 *
 * @param body - Raw body JSON từ PayOS webhook POST request.
 */
export async function verifyPayosWebhook(body: unknown): Promise<PayosWebhookVerifyResult> {
  const payos = getPayosInstance();

  try {
    // v2 API: webhooks.verify() – async, throw nếu invalid
    const data = await payos.webhooks.verify(body as any) as PayosWebhookData;
    return { isValid: true, data };
  } catch {
    return { isValid: false, data: null };
  }
}

/**
 * Kiểm tra webhook payOS có nghĩa là thanh toán thành công không.
 * code = "00" là thành công.
 */
export function isPayosWebhookSuccess(code: string): boolean {
  return code === "00";
}

// ── Get Payment Link Information ───────────────────────

/**
 * Lấy thông tin payment link từ PayOS (dùng để kiểm tra trạng thái thủ công).
 * API: payos.paymentRequests.get(orderCode)
 *
 * @param orderCode - Số nguyên orderCode (= paymentId).
 */
export async function getPayosPaymentInfo(orderCode: number): Promise<unknown> {
  const payos = getPayosInstance();
  try {
    return await payos.paymentRequests.get(orderCode);
  } catch (err: any) {
    throw Object.assign(
      new Error(`Không lấy được thông tin PayOS payment: ${err?.message ?? "unknown"}`),
      { statusCode: 502 }
    );
  }
}

// ── Cancel Payment Link ────────────────────────────────

/**
 * Huỷ payment link trên PayOS.
 * API: payos.paymentRequests.cancel(orderCode, reason)
 *
 * @param orderCode  - Số nguyên orderCode.
 * @param cancelReason - Lý do huỷ (optional).
 */
export async function cancelPayosPaymentLink(
  orderCode: number,
  cancelReason?: string
): Promise<void> {
  const payos = getPayosInstance();
  try {
    await payos.paymentRequests.cancel(orderCode, cancelReason);
  } catch (err: any) {
    // Không throw – nếu cancel thất bại (link đã expired/paid) thì bỏ qua
    console.warn(`[PayOS] cancelPaymentLink(${orderCode}) failed:`, err?.message ?? err);
  }
}

/**
 * Tạo link thanh toán PayOS dành riêng cho giải đấu.
 */
export async function createPayosTournamentPaymentLink(params: {
  paymentId: number;
  amount: number;
  paymentCode: string;
  registrationId: number;
}): Promise<PayosCreateResult> {
  const payos = getPayosInstance();

  // orderCode: payOS yêu cầu số nguyên > 0, dùng paymentId
  const orderCode = params.paymentId;

  // description: tối đa 25 ký tự (tiền tố GL + id để phân biệt ở webhook)
  const description = `GL${params.registrationId}`;

  const body = {
    orderCode,
    amount: Math.round(params.amount), // VND nguyên
    description,
    returnUrl: `${cfg.returnUrl}?type=tournament`,
    cancelUrl: `${cfg.cancelUrl}?type=tournament`,
    items: [
      {
        name: `Le phi Giai dau #${params.registrationId}`,
        quantity: 1,
        price: Math.round(params.amount),
      },
    ],
    // Hết hạn sau 10 phút
    expiredAt: Math.floor(Date.now() / 1000) + 10 * 60,
  };

  try {
    const response = await payos.paymentRequests.create(body);
    const rawResponse = JSON.stringify(response);

    return {
      success: true,
      checkoutUrl: response.checkoutUrl,
      orderCode,
      rawResponse,
    };
  } catch (err: any) {
    const errorMessage = err?.message ?? "PayOS createTournamentPaymentLink failed";
    return {
      success: false,
      checkoutUrl: "",
      orderCode,
      rawResponse: JSON.stringify({ error: errorMessage }),
      errorMessage,
    };
  }
}

