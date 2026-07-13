import nodemailer from "nodemailer";

// ── Transporter singleton ─────────────────────────────
// Tạo một lần, tái dùng – tránh tạo connection mới mỗi lần gửi mail.
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      `[Mail] Thiếu GMAIL_USER hoặc GMAIL_APP_PASSWORD trong .env`
    );
  }

  _transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // TLS
    auth: { user, pass },
    // Giữ kết nối – tránh tạo TCP connection mới mỗi lần gửi
    pool: true,
    maxConnections: 3,
    // Timeout rõ ràng
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return _transporter;
}

// ── OTP Email ─────────────────────────────────────────
export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Mã OTP xác thực tài khoản",
    html: `
      <h2>Xác thực tài khoản Pickleball</h2>
      <p>Mã OTP của bạn là:</p>
      <h1>${otp}</h1>
      <p>Mã có hiệu lực trong 5 phút.</p>
    `,
  });
}

// ── Booking Created Email (chờ thanh toán) ────────────
export async function sendBookingCreatedEmail(
  email: string,
  details: any
): Promise<void> {
  try {
    if (!email) return;
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Đặt lịch thành công - Pickleball Booking",
      html: `
        <h2>Xác nhận đặt lịch thành công</h2>
        <p>Chào ${details.playerName},</p>
        <ul>
          <li><strong>Mã booking:</strong> ${details.bookingCode}</li>
          <li><strong>Loại:</strong> ${details.bookingType}</li>
          <li><strong>Ngày:</strong> ${details.bookingDate}</li>
          <li><strong>Khung giờ:</strong> ${details.startTime} - ${details.endTime}</li>
          ${details.courtName ? `<li><strong>Sân:</strong> ${details.courtName}</li>` : ""}
          ${details.coachName ? `<li><strong>HLV:</strong> ${details.coachName}</li>` : ""}
          <li><strong>Trạng thái:</strong> Chờ thanh toán</li>
        </ul>
        <p><strong>Lưu ý:</strong> Vui lòng thanh toán trong 10 phút.</p>
      `,
    });
  } catch (err: any) {
    console.error("[Mail] sendBookingCreatedEmail FAILED:", err?.message ?? err);
  }
}

// ── Payment Success Email ─────────────────────────────
/**
 * Gửi email xác nhận đặt sân thành công sau khi payment được verify.
 * Hàm này PHẢI được gọi bằng await – không dùng void.
 * Nếu SMTP lỗi thì catch và log, KHÔNG throw để không ảnh hưởng webhook.
 */
export async function sendPaymentSuccessEmail(
  email: string,
  details: {
    playerName: string;
    bookingCode: string;
    bookingType: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    courtName?: string;
    coachName?: string;
    courtFee?: number;
    coachFee?: number;
    originalAmount?: number;
    amount: number;
    discountAmount?: number;
    paymentMethod: string;
    paymentCode?: string;
    transactionCode?: string;
  }
): Promise<void> {
  if (!email) {
    console.warn("[Mail] sendPaymentSuccessEmail: email rỗng, bỏ qua.");
    return;
  }

  console.log(
    `[Mail] Chuẩn bị gửi email xác nhận cho booking ${details.bookingCode} → ${email}`
  );

  const fmtMoney = (n: number) =>
    n ? n.toLocaleString("vi-VN") + " ₫" : "0 ₫";

  const discountRow =
    details.discountAmount && details.discountAmount > 0
      ? `<tr style="background:#f0fdf4;">
          <td style="${tdStyle}">Giảm giá (Voucher)</td>
          <td style="${tdStyle};color:#16a34a;">- ${fmtMoney(details.discountAmount)}</td>
        </tr>`
      : "";

  const courtRow = details.courtName
    ? `<tr>
        <td style="${tdStyle}">Tên sân</td>
        <td style="${tdStyle}">${details.courtName}</td>
       </tr>`
    : "";

  const coachRow = details.coachName
    ? `<tr>
        <td style="${tdStyle}">HLV</td>
        <td style="${tdStyle}">${details.coachName}</td>
       </tr>`
    : "";

  const payCodeRow = details.paymentCode
    ? `<tr style="background:#f0fdf4;">
        <td style="${tdStyle}">Mã thanh toán</td>
        <td style="${tdStyle}">${details.paymentCode}</td>
       </tr>`
    : "";

  const courtFeeRow = (details.courtFee && details.courtFee > 0)
    ? `<tr>
        <td style="${tdStyle}">Phí thuê sân</td>
        <td style="${tdStyle}">${fmtMoney(details.courtFee)}</td>
       </tr>`
    : "";

  const coachFeeRow = (details.coachFee && details.coachFee > 0)
    ? `<tr>
        <td style="${tdStyle}">Phí thuê HLV</td>
        <td style="${tdStyle}">${fmtMoney(details.coachFee)}</td>
       </tr>`
    : "";

  const originalAmountRow = (details.originalAmount && details.originalAmount > 0 && details.discountAmount && details.discountAmount > 0)
    ? `<tr>
        <td style="${tdStyle}">Tổng tiền trước giảm</td>
        <td style="${tdStyle}">${fmtMoney(details.originalAmount)}</td>
       </tr>`
    : "";

  const txRow = details.transactionCode
    ? `<tr>
        <td style="${tdStyle}">Mã giao dịch</td>
        <td style="${tdStyle}">${details.transactionCode}</td>
       </tr>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            
            <!-- Header -->
            <tr>
              <td style="background:#16a34a;padding:24px 32px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;">✅ Thanh toán thành công!</h1>
                <p style="margin:6px 0 0;color:#dcfce7;font-size:14px;">
                  Xác nhận đặt sân - PCS Pickleball Booking
                </p>
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td style="padding:24px 32px 8px;">
                <p style="margin:0;font-size:15px;color:#111;">
                  Chào <strong>${details.playerName}</strong>,
                </p>
                <p style="margin:8px 0 0;color:#555;font-size:14px;">
                  Booking <strong>${details.bookingCode}</strong> của bạn đã được thanh toán và xác nhận thành công.
                  Vui lòng kiểm tra thông tin chi tiết bên dưới.
                </p>
              </td>
            </tr>

            <!-- Booking Detail Table -->
            <tr>
              <td style="padding:16px 32px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
                  <tr style="background:#f0fdf4;">
                    <td style="${tdStyle};font-weight:bold;color:#111;" colspan="2">📋 Chi tiết booking</td>
                  </tr>
                  <tr>
                    <td style="${tdStyle};color:#555;width:45%;">Mã booking</td>
                    <td style="${tdStyle};font-weight:bold;">${details.bookingCode}</td>
                  </tr>
                  <tr style="background:#f9fafb;">
                    <td style="${tdStyle};color:#555;">Loại dịch vụ</td>
                    <td style="${tdStyle};">${details.bookingType}</td>
                  </tr>
                  ${courtRow}
                  ${coachRow}
                  <tr style="background:#f9fafb;">
                    <td style="${tdStyle};color:#555;">Ngày chơi</td>
                    <td style="${tdStyle};">${details.bookingDate}</td>
                  </tr>
                  <tr>
                    <td style="${tdStyle};color:#555;">Khung giờ</td>
                    <td style="${tdStyle};">${details.startTime} – ${details.endTime}</td>
                  </tr>

                  <!-- Separator -->
                  <tr>
                    <td colspan="2" style="${tdStyle};background:#f0fdf4;font-weight:bold;color:#111;">💳 Thanh toán</td>
                  </tr>
                  <tr>
                    <td style="${tdStyle};color:#555;">Phương thức</td>
                    <td style="${tdStyle};">${details.paymentMethod}</td>
                  </tr>
                  ${payCodeRow}
                  ${txRow}
                  ${courtFeeRow}
                  ${coachFeeRow}
                  ${originalAmountRow}
                  ${discountRow}
                  <tr style="background:#fef2f2;">
                    <td style="${tdStyle};color:#555;font-weight:bold;">Số tiền đã thanh toán</td>
                    <td style="${tdStyle};font-weight:bold;color:#dc2626;font-size:16px;">${fmtMoney(details.amount)}</td>
                  </tr>
                  <tr style="background:#f0fdf4;">
                    <td style="${tdStyle};color:#555;">Trạng thái</td>
                    <td style="${tdStyle};color:#16a34a;font-weight:bold;">✅ Đã thanh toán & Xác nhận</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer note -->
            <tr>
              <td style="padding:0 32px 24px;">
                <p style="margin:0;font-size:14px;color:#555;">
                  🏓 Vui lòng đến đúng giờ để check-in tại sân. Chúc bạn chơi vui vẻ!
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                  Email này được gửi tự động từ hệ thống PCS Pickleball Booking.<br/>
                  Vui lòng không reply email này.
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Xác nhận đặt sân thành công - ${details.bookingCode}`,
      html,
    });
    console.log(
      `[Mail] ✅ Email xác nhận đã gửi thành công → ${email} (booking: ${details.bookingCode})`
    );
  } catch (err: any) {
    console.error(
      `[Mail] ❌ sendPaymentSuccessEmail FAILED → ${email}:`,
      err?.message ?? err
    );
    if (err?.code) console.error("[Mail] SMTP error code:", err.code);
    if (err?.response) console.error("[Mail] SMTP response:", err.response);
    // KHÔNG throw – để webhook vẫn trả success, payment không bị rollback
  }
}

const tdStyle =
  "padding:10px 14px;border:1px solid #e5e7eb;vertical-align:top;";

// ── Coach Assigned Email ──────────────────────────────
export async function sendCoachAssignedEmail(
  email: string,
  details: any
): Promise<void> {
  try {
    if (!email) return;
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Bạn có booking mới",
      html: `
        <h2>Bạn có một lịch hướng dẫn mới</h2>
        <ul>
          <li><strong>Mã booking:</strong> ${details.bookingCode}</li>
          <li><strong>Học viên:</strong> ${details.playerName}</li>
          <li><strong>Ngày:</strong> ${details.bookingDate}</li>
          <li><strong>Khung giờ:</strong> ${details.startTime} - ${details.endTime}</li>
          <li><strong>Dịch vụ:</strong> ${details.bookingType}</li>
        </ul>
        <p>Vui lòng theo dõi và đến sân đúng giờ.</p>
      `,
    });
  } catch (err: any) {
    console.error("[Mail] sendCoachAssignedEmail FAILED:", err?.message ?? err);
  }
}

// ── Coach New Teaching Schedule Email (Payment Success) ─
export async function sendCoachNewTeachingScheduleEmail(
  email: string,
  details: {
    coachName: string;
    playerName: string;
    playerEmail?: string;
    playerPhone?: string;
    bookingId: number;
    bookingCode: string;
    bookingType: string;
    courtName?: string;
    courtCode?: string;
    courtLocation?: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    coachFee?: number;
  }
): Promise<void> {
  try {
    if (!email) return;
    const transporter = getTransporter();

    const fmtMoney = (n: number) => (n ? n.toLocaleString("vi-VN") + " ₫" : "0 ₫");

    const courtInfo = details.courtName
      ? `<li><strong>Sân:</strong> ${details.courtName} ${details.courtCode ? `(${details.courtCode})` : ""}</li>
         ${details.courtLocation ? `<li><strong>Địa chỉ/Vị trí:</strong> ${details.courtLocation}</li>` : ""}`
      : "";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2 style="color: #16a34a;">Lịch dạy mới đã được xác nhận</h2>
        <p>Chào Coach <strong>${details.coachName}</strong>,</p>
        <p>Bạn có một lịch dạy mới đã được thanh toán và xác nhận thành công.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; max-width: 600px;">
          <tr style="background: #f3f4f6;">
            <td colspan="2" style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Thông tin Booking</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; width: 35%;"><strong>Mã booking:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${details.bookingCode}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Loại dịch vụ:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${details.bookingType}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Ngày dạy:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${details.bookingDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Khung giờ:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${details.startTime} - ${details.endTime}</td>
          </tr>
          ${details.courtName ? `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Tên sân:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${details.courtName} ${details.courtCode ? `(${details.courtCode})` : ""}</td>
          </tr>
          ${details.courtLocation ? `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Vị trí sân:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${details.courtLocation}</td>
          </tr>` : ""}
          ` : ""}
          <tr style="background: #f3f4f6;">
            <td colspan="2" style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Thông tin Học viên</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Học viên:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${details.playerName}</td>
          </tr>
          ${details.playerEmail ? `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Email:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${details.playerEmail}</td>
          </tr>` : ""}
          ${details.playerPhone ? `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>SĐT:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${details.playerPhone}</td>
          </tr>` : ""}
          <tr style="background: #f3f4f6;">
            <td colspan="2" style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Thông tin Thanh toán</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Phí HLV:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${fmtMoney(details.coachFee ?? 0)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Trạng thái:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #16a34a; font-weight: bold;">Đã xác nhận</td>
          </tr>
        </table>
        
        <p style="margin-top: 20px;"><strong>Ghi chú:</strong> Vui lòng kiểm tra lịch dạy trong hệ thống và có mặt đúng giờ.</p>
        <p>Chúc bạn một buổi dạy thành công!</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Bạn có lịch dạy mới - ${details.bookingCode}`,
      html,
    });
    console.log(`[Mail] ✅ Đã gửi email lịch dạy mới cho Coach → ${email} (booking: ${details.bookingCode})`);
  } catch (err: any) {
    console.error("[Mail] sendCoachNewTeachingScheduleEmail FAILED:", err?.message ?? err);
  }
}

// ── No Show Email ─────────────────────────────────────
export async function sendNoShowEmail(
  email: string,
  details: any
): Promise<void> {
  try {
    if (!email) return;
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: details.isAuto
        ? "Booking của bạn đã bị tự động đánh dấu No-show"
        : "Booking của bạn đã bị đánh dấu No-show",
      html: `
        <h2>Thông báo No-show</h2>
        <p>Booking <strong>${details.bookingCode}</strong> vào lúc ${details.startTime} ngày ${details.bookingDate} đã bị đánh dấu No-show.</p>
        ${
          details.isAuto
            ? "<p>Booking của bạn đã bị đánh dấu No-show do không check-in sau 15 phút kể từ giờ bắt đầu.</p>"
            : details.reason
            ? `<p>Lý do: ${details.reason}</p>`
            : ""
        }
      `,
    });
  } catch (err: any) {
    console.error("[Mail] sendNoShowEmail FAILED:", err?.message ?? err);
  }
}

// ── Payment Expired Email ─────────────────────────────
export async function sendPaymentExpiredEmail(
  email: string,
  details: any
): Promise<void> {
  try {
    if (!email) return;
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Booking đã hết hạn thanh toán",
      html: `
        <h2>Thông báo hết hạn thanh toán</h2>
        <p>Booking <strong>${details.bookingCode}</strong> đã quá thời gian thanh toán và đã tự động bị huỷ.</p>
        <p>Slot đã được mở lại. Bạn có thể đặt lại một lịch mới trên hệ thống.</p>
      `,
    });
  } catch (err: any) {
    console.error(
      "[Mail] sendPaymentExpiredEmail FAILED:",
      err?.message ?? err
    );
  }
}

// ── Refund Completed Email ────────────────────────────
export async function sendRefundCompletedEmail(
  email: string,
  details: any
): Promise<void> {
  try {
    if (!email) return;
    const transporter = getTransporter();

    const hasBillImage = details.billImage && details.billImage.buffer;
    const attachments: any[] = [];
    if (hasBillImage) {
      attachments.push({
        filename: details.billImage.filename || "bill.jpg",
        content: details.billImage.buffer,
        contentType: details.billImage.mimeType || "image/jpeg",
        cid: "billimage@pickleball",
        contentDisposition: "inline" as const,
      });
    }

    await transporter.sendMail({
      from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Hoàn tiền thành công - Pickleball Booking",
      html: `
        <h2>Xác nhận hoàn tiền thành công</h2>
        <p>Yêu cầu hoàn tiền cho Booking <strong>${details.bookingCode}</strong> đã được xử lý thành công.</p>
        <ul>
          <li><strong>Số tiền hoàn lại:</strong> ${Number(details.amount).toLocaleString("vi-VN")} ₫</li>
        </ul>
        <p>Quản trị viên đã thực hiện chuyển khoản. Bạn vui lòng kiểm tra tài khoản nhận tiền.</p>
        ${
          hasBillImage
            ? `<p><strong>Bill chuyển khoản:</strong></p><img src="cid:billimage@pickleball" alt="Bill hoàn tiền" style="max-width:500px;height:auto;border-radius:8px;" />`
            : ""
        }
        <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.</p>
      `,
      attachments,
    });
  } catch (err: any) {
    console.error(
      "[Mail] sendRefundCompletedEmail FAILED:",
      err?.message ?? err
    );
  }
}

// ── Tournament Refund Completed Email ───────────────────
export async function sendTournamentRefundCompletedEmail(
  email: string,
  details: {
    tournamentName: string;
    divisionName: string;
    amount: number;
    billImage?: any;
  }
): Promise<void> {
  try {
    if (!email) return;
    const transporter = getTransporter();

    const hasBillImage = details.billImage && details.billImage.buffer;
    const attachments: any[] = [];
    if (hasBillImage) {
      attachments.push({
        filename: details.billImage.filename || "bill.jpg",
        content: details.billImage.buffer,
        contentType: details.billImage.mimeType || "image/jpeg",
        cid: "billimage@pickleball",
        contentDisposition: "inline" as const,
      });
    }

    await transporter.sendMail({
      from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Hoàn tất hoàn tiền lệ phí giải đấu - ${details.tournamentName}`,
      html: `
        <h2>Xác nhận hoàn tiền lệ phí giải đấu thành công</h2>
        <p>Yêu cầu hoàn tiền lệ phí đăng ký nội dung <strong>${details.divisionName}</strong> của giải đấu <strong>${details.tournamentName}</strong> đã được xử lý thành công.</p>
        <ul>
          <li><strong>Số tiền hoàn lại:</strong> ${Number(details.amount).toLocaleString("vi-VN")} ₫</li>
        </ul>
        <p>Ban tổ chức đã thực hiện chuyển khoản ngân hàng thủ công. Bạn vui lòng kiểm tra tài khoản thụ hưởng.</p>
        ${
          hasBillImage
            ? `<p><strong>Biên lai chuyển khoản:</strong></p><img src="cid:billimage@pickleball" alt="Biên lai hoàn tiền" style="max-width:500px;height:auto;border-radius:8px;" />`
            : ""
        }
        <p>Hồ sơ đăng ký của bạn đã được cập nhật sang trạng thái <strong>Từ chối (Rejected)</strong>.</p>
      `,
      attachments,
    });
  } catch (err: any) {
    console.error(
      "[Mail] sendTournamentRefundCompletedEmail FAILED:",
      err?.message ?? err
    );
  }
}

// ── Generic Notification Email ────────────────────────
export interface NotificationEmailParams {
  to: string;
  fullName: string;
  type: string;
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

export async function sendNotificationEmail(
  params: NotificationEmailParams
): Promise<void> {
  try {
    if (!params.to) return;
    const transporter = getTransporter();

    const actionButton = params.actionUrl
      ? `<div style="text-align: center; margin-top: 24px;">
           <a href="${params.actionUrl}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
             ${params.actionText || "Xem chi tiết"}
           </a>
         </div>`
      : "";

    const html = `
      <!DOCTYPE html>
      <html lang="vi">
      <head><meta charset="UTF-8" /></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
              <!-- Header -->
              <tr>
                <td style="background:#16a34a;padding:24px 32px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;">${params.title}</h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px 0;font-size:15px;color:#111;">
                    Chào <strong>${params.fullName}</strong>,
                  </p>
                  <p style="margin:0 0 16px 0;color:#4b5563;font-size:14px;line-height:1.6;white-space:pre-wrap;">${params.message}</p>
                  ${actionButton}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                    Email này được gửi tự động từ hệ thống PCS Pickleball Booking.<br/>
                    Vui lòng không reply email này.
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"PCS Booking" <${process.env.GMAIL_USER}>`,
      to: params.to,
      subject: params.subject,
      html,
    });
  } catch (err: any) {
    console.error(
      `[Mail] sendNotificationEmail [${params.type}] FAILED to ${params.to}:`,
      err?.message ?? err
    );
    throw err; // throw to let caller know and log as failed in DB
  }
}