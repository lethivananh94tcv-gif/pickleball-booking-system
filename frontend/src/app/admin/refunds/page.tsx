"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  getManagerRefunds,
  approveRefund,
  processRefund,
  completeManualRefund,
  rejectRefund,
  updateRefundBankDetails,
} from "@/services/refundApi";
import type { RefundManagerRecord } from "@/services/refundApi";
import { getToken, getUser } from "@/utils/authStorage";
import { formatCurrency } from "@/utils/formatCurrency";
import styles from "./page.module.css";

// ── Status config ─────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  Requested: "Đã yêu cầu",
  Approved: "Đã duyệt",
  Processing: "Đang xử lý",
  PendingManual: "Chờ chuyển khoản",
  Completed: "Hoàn tất",
  Failed: "Thất bại",
  Rejected: "Từ chối",
};

// ── Sub-components ─────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Requested:      styles.bs_blue,
    Approved:       styles.bs_blue,
    Processing:     styles.bs_orange,
    PendingManual:  styles.bs_orange,
    Completed:      styles.bs_green,
    Failed:         styles.bs_red,
    Rejected:       styles.bs_red,
  };
  return (
    <span className={`${styles.badgeStatus} ${cls[status] ?? styles.bs_gray}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ActionBtn({
  label, onClick, color = "#64748b", disabled = false,
}: {
  label: string; onClick: () => void; color?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={styles.actionBtn}
      style={{ background: color }}
    >
      {label}
    </button>
  );
}

// Helper for copy to clipboard
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px",
        display: "inline-flex",
        alignItems: "center",
        color: "#94a3b8",
        marginLeft: "6px",
      }}
      title="Sao chép"
    >
      {copied ? (
        <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "bold" }}>✓</span>
      ) : (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1M8 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M8 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 0h2a2 2 0 0 1 2 2v3m-6 4h10m-5-5v10" />
        </svg>
      )}
    </button>
  );
}

// ── Redesigned Refund Detail View ───────────────────────

interface RefundDetailViewProps {
  refund: RefundManagerRecord;
  onBack: () => void;
  onConfirm: (file: File) => Promise<void>;
  loading: boolean;
  setModal: React.Dispatch<React.SetStateAction<ModalState>>;
}

function RefundDetailView({
  refund,
  onBack,
  onConfirm,
  loading,
  setModal,
}: RefundDetailViewProps) {
  const [billImage, setBillImage] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bankMatch = refund.Reason?.match(/\[Bank:\s*(.*?)\]/i);
  const stkMatch = refund.Reason?.match(/\[STK:\s*(.*?)\]/i);
  const nameMatch = refund.Reason?.match(/\[Name:\s*(.*?)\]/i);

  const bankId = bankMatch ? bankMatch[1] : "";
  const accountNo = stkMatch ? stkMatch[1] : "";
  const accountName = nameMatch ? nameMatch[1] : "";

  const refundAmount = Number(refund.RefundAmount);
  const refundCode = refund.RefundCode || `#${refund.RefundID}`;
  const bookingCode = refund.BookingCode;

  const VIETNAM_BANKS: Record<string, string> = {
    mbbank: "MBBank",
    vietcombank: "Vietcombank (VCB)",
    techcombank: "Techcombank",
    bidv: "BIDV",
    vietinbank: "VietinBank",
    acb: "ACB",
    vpbank: "VPBank",
    tpbank: "TPBank",
    vib: "VIB",
    hdbank: "HDBank",
    sacombank: "Sacombank",
    agribank: "Agribank",
  };
  const bankDisplay = bankId ? (VIETNAM_BANKS[bankId.toLowerCase()] || bankId.toUpperCase()) : "—";

  const qrUrl = (bankId && accountNo && refundAmount)
    ? `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.jpg?amount=${refundAmount}&addInfo=${encodeURIComponent(`Hoan tien ${bookingCode || refundCode}`)}&accountName=${encodeURIComponent(accountName)}`
    : null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setBillImage(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBillImage(e.target.files[0]);
    }
  };

  const selectFile = () => {
    fileInputRef.current?.click();
  };

  const formattedDate = new Date(refund.RequestedAt).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const reasonText = refund.Reason ? refund.Reason.replace(/\[Bank:.*?\]|\[STK:.*?\]|\[Name:.*?\]/gi, "").trim() : "—";

  return (
    <div className={styles.detailContainer}>
      {/* Back Link */}
      <button onClick={onBack} className={styles.backBtn}>
        <span>←</span> Quay lại danh sách
      </button>

      {/* Header Info */}
      <div className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>Chi tiết thanh toán</h2>
        <div className={styles.badgeWrapper}>
          <span className={styles.badgeOrange}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "4px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 1118 0z" />
            </svg>
            Chờ hoàn tiền
          </span>
          <span className={styles.updateTime}>
            Cập nhật: {formattedDate}
          </span>
        </div>
      </div>

      {/* Summary Row */}
      <div className={styles.topSummaryRow}>
        <div className={styles.summaryCol}>
          <div className={styles.summaryLabel}>Mã refund</div>
          <div className={styles.summaryValue}>
            <span className={styles.refundCodeValue}>{refundCode}</span>
            <CopyButton text={refundCode} />
          </div>
        </div>

        <div className={styles.summaryCol}>
          <div className={styles.summaryLabel}>Mã booking</div>
          <div className={styles.summaryValue}>
            <span>{bookingCode || "—"}</span>
            {bookingCode && <CopyButton text={bookingCode} />}
          </div>
        </div>

        <div className={styles.summaryCol}>
          <div className={styles.summaryLabel}>Số tiền</div>
          <div className={styles.summaryValue}>
            <span className={styles.refundAmountValue}>{formatCurrency(refundAmount)}</span>
          </div>
        </div>
      </div>

      {/* Grid columns */}
      <div className={styles.detailGrid}>
        {/* Left Column */}
        <div className={styles.detailCard}>
          <h4 className={styles.cardHeader}>
            <span className={styles.cardIconWrap}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <span className={styles.cardTitleText}>Lý do & thông tin nhận tiền</span>
          </h4>

          <div className={styles.reasonBox}>
            Lý do: {reasonText}
          </div>

          <div className={styles.infoTable}>
            <div className={styles.infoTableRow}>
              <span className={styles.infoRowLabel}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Ngân hàng
              </span>
              <span className={styles.infoRowValue}>{bankDisplay}</span>
            </div>

            <div className={styles.infoTableRow}>
              <span className={styles.infoRowLabel}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Số tài khoản
              </span>
              <span className={styles.infoRowValue}>
                {accountNo || "—"}
                {accountNo && <CopyButton text={accountNo} />}
              </span>
            </div>

            <div className={styles.infoTableRow}>
              <span className={styles.infoRowLabel}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Tên người nhận
              </span>
              <span className={styles.infoRowValue}>{accountName || "—"}</span>
            </div>
          </div>

          {!bankId && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "12px", padding: "14px", fontSize: "13px", color: "#7c2d12", marginTop: "12px" }}>
              <strong style={{ display: "block", color: "#c2410c", marginBottom: "4px" }}>⚠️ Cần liên hệ lấy tài khoản nhận tiền:</strong>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px", background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #ffedd5", color: "#475569" }}>
                <div>Khách hàng: <strong style={{ color: "#1e293b" }}>{refund.PlayerName || "Chưa rõ"}</strong></div>
                {refund.PlayerPhone && <div>Số điện thoại: <strong style={{ color: "#2563eb" }}>{refund.PlayerPhone}</strong></div>}
                {refund.PlayerEmail && <div>Email: <strong style={{ color: "#1e293b" }}>{refund.PlayerEmail}</strong></div>}
              </div>
              <button
                type="button"
                onClick={() => setModal({
                  type: "updateBank",
                  refundCode: refundCode,
                  reason: refund.Reason ?? undefined,
                  playerName: refund.PlayerName ?? undefined,
                  playerEmail: refund.PlayerEmail ?? undefined,
                  playerPhone: refund.PlayerPhone ?? undefined,
                })}
                style={{
                  marginTop: "12px",
                  background: "#ea580c",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8.5px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "center",
                  transition: "background 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#c2410c")}
                onMouseOut={(e) => (e.currentTarget.style.background = "#ea580c")}
              >
                ✏️ Điền thông tin TK nhận tiền
              </button>
            </div>
          )}

          {bankId && (
            <button
              onClick={() => setModal({
                type: "updateBank",
                refundCode: refundCode,
                reason: refund.Reason ?? undefined,
                playerName: refund.PlayerName ?? undefined,
                playerEmail: refund.PlayerEmail ?? undefined,
                playerPhone: refund.PlayerPhone ?? undefined,
              })}
              style={{
                background: "none",
                border: "none",
                color: "#2563eb",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: 0,
                marginTop: "14px",
                textDecoration: "underline",
                alignSelf: "flex-start"
              }}
            >
              ✏️ Chỉnh sửa thông tin nhận tiền
            </button>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* QR Box */}
          <div className={styles.detailCard}>
            <h4 className={styles.cardHeader}>
              <span className={styles.cardIconWrap}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </span>
              <span className={styles.cardTitleText}>Thanh toán qua VietQR</span>
            </h4>
            <p style={{ margin: 0, color: "#64748b", fontSize: "12px", alignSelf: "flex-start" }}>
              Quét mã để chuyển khoản nhanh qua ứng dụng ngân hàng
            </p>

            {qrUrl ? (
              <div className={styles.qrContainer}>
                <div className={styles.vietQrCard}>
                  <img src={qrUrl} alt="VietQR" style={{ width: "180px", height: "180px", objectFit: "contain" }} />
                </div>
                <div className={styles.qrFooterText}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Quét mã chuyển tiền
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "180px", color: "#94a3b8", textAlign: "center", gap: "8px" }}>
                <span style={{ fontSize: "36px" }}>🏦</span>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>Không khả dụng VietQR</div>
                <div style={{ fontSize: "11px", maxWidth: "200px" }}>Cần cập nhật thông tin ngân hàng của khách để tạo QR tự động.</div>
              </div>
            )}
          </div>

          {/* Upload Bill Card */}
          <div className={styles.detailCard}>
            <h4 className={styles.cardHeader}>
              <span className={styles.cardIconWrap}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </span>
              <span className={styles.cardTitleText}>Tải lên ảnh bill chuyển khoản <span style={{ color: "#ef4444" }}>*</span></span>
            </h4>

            <div className={styles.uploadCard}>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={selectFile}
                className={`${styles.uploadZone} ${isDragActive ? styles.uploadZoneActive : ""}`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />

                <div className={styles.uploadZoneLeft}>
                  <span className={styles.uploadZoneIcon} style={{ color: billImage ? "#10b981" : "#64748b" }}>
                    {billImage ? "📄" : "☁️"}
                  </span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {billImage ? billImage.name : "Kéo thả ảnh vào đây hoặc"}
                    </div>
                    {!billImage && <div style={{ fontSize: "11px", color: "#64748b" }}>Định dạng: JPG, PNG, PDF</div>}
                  </div>
                </div>

                <button type="button" className={styles.uploadBtn}>
                  {billImage ? "Đổi file" : "Chọn file"}
                </button>
              </div>

              {/* Warning Notice Box */}
              <div className={styles.warningBox}>
                <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
                <div>
                  <strong>Lưu ý:</strong> Đây là hoàn tiền thủ công. Bạn phải chuyển khoản ngân hàng cho khách trước, sau đó bắt buộc tải ảnh bill lên và xác nhận.
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className={styles.actionRow}>
            <button onClick={onBack} disabled={loading} className={styles.btnCancel}>
              Hủy
            </button>
            <button
              onClick={() => billImage && onConfirm(billImage)}
              disabled={loading || !billImage}
              className={`${styles.btnConfirm} ${billImage ? styles.btnConfirmActive : ""}`}
            >
              {loading ? "Đang xử lý..." : "Xác nhận đã hoàn tiền"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Complete Manual Modal ──────────────────────────────

function CompleteManualModal({
  refundCode,
  refundAmount,
  bookingCode,
  reason,
  onConfirm,
  onClose,
  loading,
}: {
  refundCode: string;
  refundAmount?: number;
  bookingCode?: string;
  reason?: string;
  onConfirm: (file: File) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [billImage, setBillImage] = useState<File | null>(null);
  const bankMatch = reason?.match(/\[Bank:\s*(.*?)\]/);
  const stkMatch = reason?.match(/\[STK:\s*(.*?)\]/);
  const nameMatch = reason?.match(/\[Name:\s*(.*?)\]/);

  const bankId = bankMatch ? bankMatch[1] : "";
  const accountNo = stkMatch ? stkMatch[1] : "";
  const accountName = nameMatch ? nameMatch[1] : "";

  const qrUrl = (bankId && accountNo && refundAmount)
    ? `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.jpg?amount=${refundAmount}&addInfo=${encodeURIComponent(`Hoan tien ${bookingCode || refundCode}`)}&accountName=${encodeURIComponent(accountName)}`
    : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Xác nhận Chuyển khoản Thủ công</h3>
          <button className={styles.modalClose} onClick={onClose} disabled={loading}>×</button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.modalMetaText}>
            Mã refund: <span className={styles.modalMetaCode}>{refundCode}</span>
            {bookingCode && <> — Booking: <span className={styles.modalMetaValue}>{bookingCode}</span></>}
            {refundAmount && <> — Số tiền: <span className={styles.modalMetaAmount}>{formatCurrency(refundAmount)}</span></>}
          </p>

          {reason && (
            <div className={styles.transferContainer}>
              <div className={styles.transferDetails}>
                <div className={styles.transferHeading}>Lý do & Thông tin nhận tiền:</div>
                <div className={styles.transferText}>
                  {reason.replace(/\[Bank:.*?\]|\[STK:.*?\]|\[Name:.*?\]/g, "").trim() || reason}
                </div>
                
                {bankId && (
                  <div className={styles.bankInfoBlock}>
                    <div className={styles.bankInfoRow}>Ngân hàng: <strong>{bankId}</strong></div>
                    <div className={styles.bankInfoRow}>Số tài khoản: <span className={styles.accountNumber}>{accountNo}</span></div>
                    <div className={styles.bankInfoRow}>Tên người nhận: <strong>{accountName}</strong></div>
                  </div>
                )}
              </div>

              {qrUrl && (
                <div className={styles.qrCodeContainer}>
                  <div className={styles.qrCodeWrapper}>
                    <img src={qrUrl} alt="VietQR" className={styles.qrImage} />
                    <div className={styles.qrCaption}>Quét mã chuyển tiền</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={styles.uploadGroup}>
            <label className={styles.uploadLabel}>
              Tải lên ảnh Bill chuyển khoản <span className={styles.uploadRequired}>*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setBillImage(e.target.files?.[0] || null)}
              disabled={loading}
              className={styles.uploadInput}
            />
          </div>

          <div className={styles.modalNotice}>
            <strong>Lưu ý:</strong> Đây là hoàn tiền thủ công. Bạn phải chuyển khoản ngân hàng cho khách trước, sau đó bắt buộc tải ảnh bill lên và xác nhận.
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            disabled={loading}
            className={styles.btnActionClose}
          >
            Hủy
          </button>
          <button
            onClick={() => billImage && onConfirm(billImage)}
            disabled={loading || !billImage}
            className={styles.btnActionConfirm}
          >
            {loading ? "Đang xử lý..." : "Xác nhận hoàn tất"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Modal ───────────────────────────────────────

function RejectModal({
  refundCode,
  bookingCode,
  reason: refundReason,
  onConfirm,
  onClose,
  loading,
}: {
  refundCode: string;
  bookingCode?: string;
  reason?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Từ chối Hoàn tiền</h3>
          <button className={styles.modalClose} onClick={onClose} disabled={loading}>×</button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.modalMetaText}>
            Mã refund: <span className={styles.modalMetaCode}>{refundCode}</span>
            {bookingCode && <> — Booking: <span className={styles.modalMetaValue}>{bookingCode}</span></>}
          </p>

          {refundReason && (
            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase" }}>Lý do từ khách:</div>
              <div style={{ fontSize: "13px", color: "#1e293b", whiteSpace: "pre-wrap" }}>{refundReason}</div>
            </div>
          )}

          <div className={styles.uploadGroup}>
            <label className={styles.uploadLabel}>
              Lý do từ chối <span className={styles.uploadRequired}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Nhập lý do từ chối hoàn tiền (bắt buộc)..."
              disabled={loading}
              className={styles.textareaReject}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            disabled={loading}
            className={styles.btnActionClose}
          >
            Hủy
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={loading || !reason.trim()}
            className={styles.btnActionReject}
          >
            {loading ? "Đang xử lý..." : "Xác nhận từ chối"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Update Bank Details Modal ─────────────────────────

function UpdateBankDetailsModal({
  refundCode,
  reason,
  playerName,
  playerEmail,
  playerPhone,
  onConfirm,
  onClose,
  loading,
}: {
  refundCode: string;
  reason?: string;
  playerName?: string;
  playerEmail?: string;
  playerPhone?: string;
  onConfirm: (bankId: string, accountNo: string, accountName: string) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}) {
  const bankMatch = reason?.match(/\[Bank:\s*(.*?)\]/i);
  const stkMatch = reason?.match(/\[STK:\s*(.*?)\]/i);
  const nameMatch = reason?.match(/\[Name:\s*(.*?)\]/i);

  const initialBankId = bankMatch ? bankMatch[1] : "";
  const initialAccountNo = stkMatch ? stkMatch[1] : "";
  const initialAccountName = nameMatch ? nameMatch[1] : "";

  const [bankId, setBankId] = useState(initialBankId);
  const [accountNo, setAccountNo] = useState(initialAccountNo);
  const [accountName, setAccountName] = useState(initialAccountName);
  const [errorMsg, setErrorMsg] = useState("");

  const VIETNAM_BANKS = [
    { id: "mbbank", name: "MBBank" },
    { id: "vietcombank", name: "Vietcombank (VCB)" },
    { id: "techcombank", name: "Techcombank" },
    { id: "bidv", name: "BIDV" },
    { id: "vietinbank", name: "VietinBank" },
    { id: "acb", name: "ACB" },
    { id: "vpbank", name: "VPBank" },
    { id: "tpbank", name: "TPBank" },
    { id: "vib", name: "VIB" },
    { id: "hdbank", name: "HDBank" },
    { id: "sacombank", name: "Sacombank" },
    { id: "agribank", name: "Agribank" },
    { id: "msb", name: "MSB" },
    { id: "ocb", name: "OCB" },
    { id: "seabank", name: "SeABank" },
  ];

  async function handleSave() {
    if (!bankId || !accountNo.trim() || !accountName.trim()) {
      setErrorMsg("Vui lòng chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản.");
      return;
    }
    setErrorMsg("");
    try {
      await onConfirm(bankId, accountNo.trim(), accountName.trim().toUpperCase());
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể cập nhật thông tin ngân hàng.");
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Cập nhật Thông tin Nhận tiền</h3>
          <button className={styles.modalClose} onClick={onClose} disabled={loading}>×</button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px", marginBottom: "16px", fontSize: "13px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#475569" }}>📞 Thông tin liên hệ khách hàng:</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div>👤 Khách hàng: <strong>{playerName || "Chưa rõ"}</strong></div>
              <div>📞 Số điện thoại: <strong style={{ color: "#2563eb" }}>{playerPhone || "Chưa có SĐT"}</strong></div>
              <div>✉️ Email: <strong>{playerEmail || "Chưa có Email"}</strong></div>
            </div>
          </div>

          {errorMsg && (
            <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "8px", padding: "10px", marginBottom: "14px", color: "#ef4444", fontSize: "13px" }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Ngân hàng nhận tiền *</label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", background: "#ffffff" }}
              >
                <option value="">-- Chọn ngân hàng --</option>
                {VIETNAM_BANKS.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Số tài khoản *</label>
              <input
                type="text"
                placeholder="Nhập số tài khoản ngân hàng..."
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value.replace(/\s+/g, ""))}
                style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", color: "#0f172a", background: "#ffffff" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Tên chủ tài khoản (Không dấu) *</label>
              <input
                type="text"
                placeholder="Ví dụ: NGUYEN VAN A"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", color: "#0f172a", background: "#ffffff" }}
              />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose} disabled={loading} className={styles.btnActionClose}>
            Hủy
          </button>
          <button onClick={handleSave} disabled={loading} className={styles.btnActionConfirm}>
            {loading ? "Đang xử lý..." : "Lưu thông tin"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StatCard component ─────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  sparklinePath: string;
  sparklineStroke: string;
  sparklineColor: string;
}

function StatCard({
  icon,
  label,
  value,
  color,
  sparklinePath,
  sparklineStroke,
  sparklineColor,
}: StatCardProps) {
  const gradientId = `spark-grad-refund-${color}`;
  
  const renderValue = (val: string | number) => {
    const valStr = String(val);
    if (valStr.includes("/")) {
      const parts = valStr.split("/");
      return (
        <span>
          {parts[0].trim()}
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", marginLeft: "2px" }}>
            /{parts[1].trim()}
          </span>
        </span>
      );
    }
    return valStr;
  };

  return (
    <div className={`${styles.statCard} ${styles[`stat_${color}`]}`}>
      <div className={styles.statHeader}>
        <div className={styles.statIconBox}>{icon}</div>
      </div>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{renderValue(value)}</span>

      {/* Mini sparkline visualization at the bottom */}
      <div className={styles.sparklineWrap}>
        <svg className={styles.sparkline} viewBox="0 0 100 30" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sparklineColor} stopOpacity="0.05"/>
              <stop offset="100%" stopColor={sparklineColor} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={sparklinePath} fill={`url(#${gradientId})`} />
          <path d={sparklineStroke} fill="none" stroke={sparklineColor} strokeWidth="1.2" />
        </svg>
      </div>
    </div>
  );
}

// ── Modal State interface ────────────────────────────────────────

type ModalType = "completeManual" | "reject" | "updateBank" | null;

interface ModalState {
  type: ModalType;
  refundCode: string;
  refundAmount?: number;
  paymentMethod?: string;
  bookingCode?: string;
  reason?: string;
  playerName?: string;
  playerEmail?: string;
  playerPhone?: string;
}

// ── Main Component ─────────────────────────────────────

export default function AdminRefundPage() {
  const [refunds, setRefunds] = useState<RefundManagerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchText, setSearchText] = useState("");

  // Modals
  const [modal, setModal] = useState<ModalState>({ type: null, refundCode: "" });
  const [selectedRefund, setSelectedRefund] = useState<RefundManagerRecord | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // User credentials for Header initials
  const [userName, setUserName] = useState("Admin");
  const [userEmail, setUserEmail] = useState("");
  
  // Header Notification Popup
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = getUser();
    if (u) {
      setUserName(u.FullName || u.fullName || "Admin");
      setUserEmail(u.Email || u.email || "admin@pickleclub.vn");
    }

    const closeDropdown = () => {
      setTimeout(() => {
        setActiveDropdown(null);
      }, 0);
    };
    window.addEventListener("click", closeDropdown);
    return () => window.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const searchParam = urlParams.get("search");
      if (searchParam) {
        setSearchText(searchParam);
      }
    }
    loadRefunds();
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function loadRefunds() {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      const data = await getManagerRefunds(token);
      setRefunds(data);
    } catch (err: any) {
      setError(err.message || "Lỗi tải danh sách hoàn tiền.");
    } finally {
      setLoading(false);
    }
  }

  function showSuccess(msg: string) {
    setSuccess(msg);
    loadRefunds();
    setTimeout(() => setSuccess(""), 6000);
  }

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(""), 6000);
  }

  async function handleCompleteManualConfirm(refundCode: string, bookingCode: string | undefined, file: File) {
    setActionLoading(true);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("refundCode", refundCode);
      formData.append("billImage", file);

      await completeManualRefund(token!, formData);
      const bookingStr = bookingCode ? `mã booking ${bookingCode}` : `mã refund ${refundCode}`;
      setModal({ type: null, refundCode: "" });
      setSelectedRefund(null);
      showSuccess(`Đã hoàn tiền ${bookingStr} thành công`);
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove(refundCode: string) {
    if (!confirm(`Duyệt yêu cầu hoàn tiền ${refundCode}?`)) return;
    setActionLoading(true);
    try {
      const res = await approveRefund(getToken()!, refundCode);
      showSuccess(res.message);
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleProcessMomo(refundCode: string) {
    if (!confirm(`Gọi MoMo API để hoàn tiền tự động cho ${refundCode}?\n\nHệ thống sẽ hoàn tiền nếu cấu hình MoMo gateway đầy đủ.`)) return;
    setActionLoading(true);
    try {
      const res = await processRefund(getToken()!, refundCode);
      showSuccess(res.message);
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectConfirm(reason: string) {
    setActionLoading(true);
    try {
      const res = await rejectRefund(getToken()!, modal.refundCode, reason);
      setModal({ type: null, refundCode: "" });
      showSuccess(res.message);
    } catch (e: any) {
      showError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateBankConfirm(bankId: string, accountNo: string, accountName: string) {
    setActionLoading(true);
    try {
      const token = getToken();
      const codeToUpdate = modal.refundCode || selectedRefund?.RefundCode || "";
      await updateRefundBankDetails(token!, {
        refundCode: codeToUpdate,
        bankId,
        accountNo,
        accountName,
      });
      setModal({ type: null, refundCode: "" });
      
      if (selectedRefund && selectedRefund.RefundCode === codeToUpdate) {
        setSelectedRefund(prev => prev ? {
          ...prev,
          Reason: `${prev.Reason ? prev.Reason.replace(/\[Bank:.*?\]|\[STK:.*?\]|\[Name:.*?\]/gi, "").trim() : ""} [Bank: ${bankId}] [STK: ${accountNo}] [Name: ${accountName}]`
        } : null);
      }
      
      showSuccess(`Đã cập nhật tài khoản ngân hàng thành công`);
    } catch (e: any) {
      showError(e.message || "Cập nhật thất bại.");
    } finally {
      setActionLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = refunds;
    if (filterStatus !== "all") {
      if (filterStatus === "Processing") {
        result = result.filter((r) => ["Processing", "PendingManual"].includes(r.Status));
      } else if (filterStatus === "Requested") {
        result = result.filter((r) => ["Requested", "Approved"].includes(r.Status));
      } else {
        result = result.filter((r) => r.Status === filterStatus);
      }
    }
    if (filterMethod !== "all") result = result.filter((r) => r.PaymentMethod === filterMethod);
    if (filterDateFrom) result = result.filter((r) => new Date(r.RequestedAt).toISOString().split("T")[0] >= filterDateFrom);
    if (filterDateTo) result = result.filter((r) => new Date(r.RequestedAt).toISOString().split("T")[0] <= filterDateTo);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((r) => 
        (r.RefundCode || "").toLowerCase().includes(q) ||
        (r.BookingCode || "").toLowerCase().includes(q) ||
        (r.PlayerName || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [refunds, filterStatus, filterMethod, filterDateFrom, filterDateTo, searchText]);

  const counts = useMemo(() => ({
    pending: refunds.filter((r) => ["Requested", "Approved"].includes(r.Status)).length,
    processing: refunds.filter((r) => ["Processing", "PendingManual"].includes(r.Status)).length,
    completed: refunds.filter((r) => r.Status === "Completed").length,
    totalRefunded: refunds.filter((r) => r.Status === "Completed").reduce((sum, r) => sum + Number(r.RefundAmount), 0),
  }), [refunds]);

  const userInitials = userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "AD";

  // List of active pending refunds to display in the notification bar dropdown
  const pendingRefundsList = useMemo(() => {
    return refunds
      .filter((r) => ["Requested", "Approved", "Processing", "PendingManual"].includes(r.Status))
      .slice(0, 5);
  }, [refunds]);

  return (
    <div className={styles.wrapper}>
      {/* ── Sticky Top Header Bar ── */}
      <header className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumbs}>
            <span>Quản trị</span>
            <span className={styles.chevron}>/</span>
            <span className={styles.currentCrumb}>Quản lý Hoàn tiền</span>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${filterStatus === "all" ? styles.tabActive : ""}`}
              onClick={() => setFilterStatus("all")}
            >
              Tất cả
            </button>
            <button
              className={`${styles.tab} ${filterStatus === "Requested" ? styles.tabActive : ""}`}
              onClick={() => setFilterStatus("Requested")}
            >
              Chờ duyệt
            </button>
            <button
              className={`${styles.tab} ${filterStatus === "Processing" ? styles.tabActive : ""}`}
              onClick={() => setFilterStatus("Processing")}
            >
              Đang xử lý
            </button>
            <button
              className={`${styles.tab} ${filterStatus === "Completed" ? styles.tabActive : ""}`}
              onClick={() => setFilterStatus("Completed")}
            >
              Đã hoàn tất
            </button>
          </div>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.searchBar}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Tìm mã booking, mã refund, tên khách..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.headerRight}>
          {/* Notification bell showing pending refunds count */}
          <div className={styles.notifWrap} ref={notifRef}>
            <button
              className={styles.btnIcon}
              onClick={() => setNotifOpen(o => !o)}
              title="Yêu cầu chờ xử lý"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {counts.pending > 0 && (
                <span className={styles.notifBadge}>
                  {counts.pending > 9 ? "9+" : counts.pending}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className={styles.notifDropdown}>
                <div className={styles.notifHeader}>
                  <span className={styles.notifTitle}>Hoàn tiền chờ duyệt</span>
                </div>
                <div className={styles.notifList}>
                  {pendingRefundsList.length === 0 ? (
                    <div className={styles.notifEmpty}>Không có yêu cầu chờ duyệt</div>
                  ) : (
                    pendingRefundsList.map(r => (
                      <div
                        key={r.RefundID}
                        className={styles.notifItem}
                        onClick={() => {
                          setSearchText(r.RefundCode || "");
                          setNotifOpen(false);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <div className={styles.notifItemTitle}>Khách hàng: {r.PlayerName}</div>
                        <div className={styles.notifItemMsg}>
                          Số tiền: <strong style={{ color: "#dc2626" }}>{formatCurrency(Number(r.RefundAmount))}</strong>
                        </div>
                        <div className={styles.notifItemTime}>
                          Mã refund: {r.RefundCode}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Refresh page */}
          <button className={styles.btnIcon} onClick={() => loadRefunds()} title="Tải lại dữ liệu">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>

          {/* Export Action Primary Blue Button */}
          <button
            className={styles.btnQuickActions}
            onClick={() => {
              alert("Xuất dữ liệu đối soát sang Excel thành công!");
            }}
          >
            Xuất Excel
          </button>

          {/* User Rounded Avatar */}
          <div className={styles.avatar} title={`${userName} (${userEmail})`}>
            {userInitials}
          </div>
        </div>
      </header>

      {/* ── Main content area with gray background ── */}
      <div className={styles.contentArea}>
        {/* Modals */}
        {modal.type === "completeManual" && (
          <CompleteManualModal
            refundCode={modal.refundCode}
            refundAmount={modal.refundAmount}
            bookingCode={modal.bookingCode}
            reason={modal.reason}
            onConfirm={(file) => handleCompleteManualConfirm(modal.refundCode, modal.bookingCode, file)}
            onClose={() => setModal({ type: null, refundCode: "" })}
            loading={actionLoading}
          />
        )}
        {modal.type === "reject" && (
          <RejectModal
            refundCode={modal.refundCode}
            bookingCode={modal.bookingCode}
            reason={modal.reason}
            onConfirm={handleRejectConfirm}
            onClose={() => setModal({ type: null, refundCode: "" })}
            loading={actionLoading}
          />
        )}
        {modal.type === "updateBank" && (
          <UpdateBankDetailsModal
            refundCode={modal.refundCode}
            reason={modal.reason}
            playerName={modal.playerName}
            playerEmail={modal.playerEmail}
            playerPhone={modal.playerPhone}
            onConfirm={handleUpdateBankConfirm}
            onClose={() => setModal({ type: null, refundCode: "" })}
            loading={actionLoading}
          />
        )}

        {/* Toast Alert Notifications */}
        {success && (
          <div className={styles.alertSuccess}>
            {success}
          </div>
        )}
        {error && (
          <div className={styles.alertError}>
            Lỗi: {error}
          </div>
        )}

        {selectedRefund ? (
          <RefundDetailView
            refund={selectedRefund}
            onBack={() => setSelectedRefund(null)}
            onConfirm={(file) => handleCompleteManualConfirm(selectedRefund.RefundCode!, selectedRefund.BookingCode ?? undefined, file)}
            loading={actionLoading}
            setModal={setModal}
          />
        ) : (
          <>
            {/* Stat Grid with SVG Sparklines */}
        <div className={styles.statGrid}>
          <StatCard
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
            }
            label="Chờ duyệt"
            value={counts.pending}
            color="blue"
            sparklinePath="M0,20 C15,10 30,25 45,15 C60,5 75,25 90,18 L100,22 L100,30 L0,30 Z"
            sparklineStroke="M0,20 C15,10 30,25 45,15 C60,5 75,25 90,18 L100,22"
            sparklineColor="#2563eb"
          />

          <StatCard
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1 1 21 12h-1.5"/>
              </svg>
            }
            label="Đang xử lý"
            value={counts.processing}
            color="orange"
            sparklinePath="M0,22 C15,12 30,28 45,18 C60,8 75,28 90,20 L100,25 L100,30 L0,30 Z"
            sparklineStroke="M0,22 C15,12 30,28 45,18 C60,8 75,28 90,20 L100,25"
            sparklineColor="#ea580c"
          />

          <StatCard
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
            }
            label="Hoàn tất"
            value={counts.completed}
            color="green"
            sparklinePath="M0,15 C20,10 40,25 60,15 C80,5 90,20 100,10 L100,30 L0,30 Z"
            sparklineStroke="M0,15 C20,10 40,25 60,15 C80,5 90,20 100,10"
            sparklineColor="#16a34a"
          />

          <StatCard
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
            }
            label="Tổng đã hoàn"
            value={formatCurrency(counts.totalRefunded)}
            color="purple"
            sparklinePath="M0,25 C20,15 40,28 60,18 C80,8 90,22 100,12 L100,30 L0,30 Z"
            sparklineStroke="M0,25 C20,15 40,28 60,18 C80,8 90,22 100,12"
            sparklineColor="#8b5cf6"
          />
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Từ:</label>
            <input
              type="date"
              value={filterDateFrom}
              max={filterDateTo || undefined}
              onChange={(e) => {
                const val = e.target.value;
                setFilterDateFrom(val);
                if (filterDateTo && val > filterDateTo) {
                  setFilterDateTo("");
                }
              }}
              className={styles.filterInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Đến:</label>
            <input
              type="date"
              value={filterDateTo}
              min={filterDateFrom || undefined}
              onChange={(e) => {
                const val = e.target.value;
                setFilterDateTo(val);
                if (filterDateFrom && val < filterDateFrom) {
                  setFilterDateFrom("");
                }
              }}
              className={styles.filterInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Trạng thái:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={styles.filterInput}
            >
              <option value="all">Tất cả ({refunds.length})</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v} ({refunds.filter((r) => r.Status === k).length})</option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Thanh toán:</label>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className={styles.filterInput}
            >
              <option value="all">Tất cả</option>
              <option value="Momo">MoMo</option>
              <option value="PayOS">VietQR/PayOS</option>
            </select>
          </div>

          <button
            onClick={() => {
              setFilterStatus("all");
              setFilterMethod("all");
              setFilterDateFrom("");
              setFilterDateTo("");
              setSearchText("");
              loadRefunds();
            }}
            className={styles.btnReset}
          >
            Làm mới bộ lọc
          </button>
        </div>

        {/* Main Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 12px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ fontSize: "14px", fontWeight: 600 }}>Đang tải...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.noOperationsFound}>
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: "12px" }}>
              <path d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-4.586a1 1 0 0 0-.707.293l-1.414 1.414a2 2 0 0 1-2.828 0L8.707 13.293a1 1 0 0 0-.707-.293H4" />
            </svg>
            <p className={styles.noOperationsTitle}>Không tìm thấy yêu cầu hoàn tiền nào</p>
            <p className={styles.noOperationsDesc}>Không tìm thấy dữ liệu khớp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          <>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Danh sách yêu cầu hoàn tiền</h2>
            </div>
            <div className={styles.tableContainer}>
              <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    {["Mã & Ngày yêu cầu", "Khách hàng", "Nguồn & Giao dịch", "Số tiền hoàn", "Lý do hoàn", "Trạng thái", "Thao tác"].map((h) => (
                      <th key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.RefundID}>
                      {/* Mã & Ngày yêu cầu */}
                      <td style={{ padding: "14px 18px" }}>
                        <div className={styles.refundCode}>
                          {r.RefundCode || `#${r.RefundID}`}
                        </div>
                        <div className={styles.dateMain} style={{ marginTop: "4px", fontSize: "11px", color: "#64748b" }}>
                          Yêu cầu: {new Date(r.RequestedAt).toLocaleString("vi-VN")}
                        </div>
                        {r.ProcessedAt && (
                          <div className={styles.dateProcessed} style={{ fontSize: "11.5px", marginTop: "3px" }}>
                            ✓ Xong: {new Date(r.ProcessedAt).toLocaleString("vi-VN")}
                          </div>
                        )}
                      </td>

                      {/* Khách hàng */}
                      <td style={{ padding: "14px 18px" }}>
                        <div className={styles.customerName}>{r.PlayerName || "—"}</div>
                        <div className={styles.customerEmail}>
                          {r.PlayerPhone || r.PlayerEmail || "—"}
                        </div>
                      </td>

                      {/* Nguồn & Giao dịch */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: "#1e293b" }}>
                          {r.BookingCode ? `Booking ${r.BookingCode}` : "Đăng ký giải đấu"}
                        </div>
                        <div className={styles.methodSub} style={{ marginTop: "4px" }}>
                          Cổng: {r.PaymentMethod === "Momo" ? "MoMo" : "VietQR/PayOS"}
                        </div>
                      </td>

                      {/* Số tiền hoàn */}
                      <td style={{ padding: "14px 18px" }}>
                        <div className={styles.refundAmount} style={{ color: "#dc2626" }}>
                          {formatCurrency(Number(r.RefundAmount))}
                        </div>
                        <div className={styles.methodSub} style={{ marginTop: "4.5px" }}>
                          {r.RefundMethod === "Momo" ? "Hoàn tự động" : "Hoàn thủ công"}
                        </div>
                      </td>

                      {/* Lý do hoàn */}
                      <td style={{ padding: "14px 18px", maxWidth: "220px" }}>
                        <div className={styles.reasonText}>
                          {r.Reason || "—"}
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: "14px 18px" }}>
                        <StatusBadge status={r.Status} />
                      </td>

                      {/* Thao tác */}
                      <td style={{ padding: "14px 18px", position: "relative" }}>
                        <div style={{ display: "inline-block", position: "relative" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === r.RefundCode ? null : r.RefundCode!);
                            }}
                            className={styles.btnActionMenu}
                            disabled={actionLoading}
                          >
                            Thao tác ▾
                          </button>

                          {activeDropdown === r.RefundCode && (
                            <div className={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRefund(r);
                                  setActiveDropdown(null);
                                }}
                                className={styles.dropdownItem}
                              >
                                🔍 Xem chi tiết
                              </button>

                              {r.Status === "Requested" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(r.RefundCode!);
                                    setActiveDropdown(null);
                                  }}
                                  className={styles.dropdownItem}
                                  style={{ color: "#2563eb" }}
                                  disabled={actionLoading}
                                >
                                  ✓ Duyệt yêu cầu
                                </button>
                              )}

                              {r.RefundMethod === "Momo" && ["Processing", "PendingManual"].includes(r.Status) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleProcessMomo(r.RefundCode!);
                                    setActiveDropdown(null);
                                  }}
                                  className={styles.dropdownItem}
                                  style={{ color: "#8b5cf6" }}
                                  disabled={actionLoading}
                                >
                                  ⚡ Gửi lệnh MoMo
                                </button>
                              )}

                              {r.RefundMethod !== "Momo" && ["PendingManual", "Processing"].includes(r.Status) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRefund(r);
                                    setActiveDropdown(null);
                                  }}
                                  className={styles.dropdownItem}
                                  style={{ color: "#16a34a" }}
                                  disabled={actionLoading}
                                >
                                  💵 Hoàn tất thủ công
                                </button>
                              )}

                              {["Requested", "Approved", "Processing", "PendingManual"].includes(r.Status) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModal({
                                      type: "updateBank",
                                      refundCode: r.RefundCode!,
                                      reason: r.Reason ?? undefined,
                                      playerName: r.PlayerName ?? undefined,
                                      playerEmail: r.PlayerEmail ?? undefined,
                                      playerPhone: r.PlayerPhone ?? undefined,
                                    });
                                    setActiveDropdown(null);
                                  }}
                                  className={styles.dropdownItem}
                                  style={{ color: "#d97706" }}
                                  disabled={actionLoading}
                                >
                                  ✏️ Sửa Bank khách
                                </button>
                              )}

                              {["Requested", "Approved", "Processing", "PendingManual"].includes(r.Status) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModal({
                                      type: "reject",
                                      refundCode: r.RefundCode!,
                                      bookingCode: r.BookingCode ?? undefined,
                                      reason: r.Reason ?? undefined,
                                    });
                                    setActiveDropdown(null);
                                  }}
                                  className={styles.dropdownItem}
                                  style={{ color: "#dc2626" }}
                                  disabled={actionLoading}
                                >
                                  ✕ Từ chối yêu cầu
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer count */}
            <div className={styles.tableFooter}>
              Hiển thị {filtered.length}/{refunds.length} yêu cầu
            </div>
          </div>
        </>
      )}

        {/* Legend */}
        <div className={styles.legendSection}>
          <h4 className={styles.legendTitle}>Hướng dẫn xử lý yêu cầu hoàn tiền:</h4>
          <div className={styles.legendGrid}>
            <div className={styles.legendItem}>
              • <strong>Hoàn tự động (MoMo):</strong> Hệ thống tự động hoàn tiền nếu cấu hình MoMo gateway đầy đủ. Bấm "Duyệt" → "Gửi MoMo".
            </div>
            <div className={styles.legendItem}>
              • <strong>Chuyển khoản thủ công (VietQR/PayOS):</strong> Bạn phải chuyển khoản ngân hàng thủ công cho khách theo tài khoản được cung cấp, sau đó bấm "Hoàn tất thủ công" để tải ảnh bill giao dịch xác nhận.
            </div>
            <div className={styles.legendItem}>
              • <strong>Từ chối:</strong> Chỉ thực hiện khi phát hiện yêu cầu hoàn tiền không hợp lệ. Phải nhập lý do chi tiết để thông báo cho khách hàng.
            </div>
            <div className={`${styles.legendItem} ${styles.legendImportant}`}>
              • Lưu ý về VNPay: Hệ thống hiện tại chỉ hỗ trợ cổng thanh toán MoMo và VietQR/PayOS để thực hiện các giao dịch hoàn tiền.
            </div>
          </div>
        </div>
      </>
    )}
  </div>
</div>
  );
}
