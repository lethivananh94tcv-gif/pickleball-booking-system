"use client";

import { useState } from "react";
import { createPayment } from "@/services/paymentApi";
import type { PaymentMethod } from "@/services/paymentApi";
import { getToken } from "@/utils/authStorage";
import { formatCurrency } from "@/utils/formatCurrency";
import styles from "./PaymentModal.module.css";
import VoucherInput from "@/modules/promotions/components/VoucherInput";
import VoucherList from "@/modules/promotions/components/VoucherList";
import { applyPromotion, removePromotion } from "@/services/promotionApi";

// ── Props ─────────────────────────────────────────────

type Props = {
  bookingId: number;
  bookingCode: string;
  totalAmount: number;
  onClose: () => void;
};

// ── Payment method options ────────────────────────────

const METHODS: {
  id: PaymentMethod;
  label: string;
  icon: React.ReactNode;
  desc: string;
  badge?: string;
}[] = [
  {
    id: "PayOS",
    label: "VietQR",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 3H9V9H3V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 3H21V9H15V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 15H9V21H3V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 15H15.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 18H15.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 21H15.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18 15H18.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18 18H18.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18 21H18.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 15H21.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 18H21.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 21H21.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    desc: "Chuyển khoản ngân hàng",
  },
];

// ── Component ─────────────────────────────────────────

export default function PaymentModal({
  bookingId,
  bookingCode,
  totalAmount,
  onClose,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PayOS");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Voucher state
  const [currentAmount, setCurrentAmount] = useState(totalAmount);
  const [originalAmount, setOriginalAmount] = useState(totalAmount);
  const [appliedPromotion, setAppliedPromotion] = useState<any>(null);

  async function handleApplyVoucher(code: string) {
    setErrorMsg("");
    try {
      const token = getToken();
      if (!token) {
        setErrorMsg("Vui lòng đăng nhập để áp dụng voucher.");
        return;
      }
      const result = await applyPromotion(token, bookingId, code);
      setAppliedPromotion({
        promotionCode: result.promotionCode,
        promotionName: "Voucher giảm giá",
        discountAmount: result.discountAmount,
      });
      setCurrentAmount(result.finalAmount);
      setOriginalAmount(result.originalAmount);
    } catch (err: any) {
      setErrorMsg(err instanceof Error ? err.message : "Áp dụng voucher thất bại.");
    }
  }

  async function handleRemoveVoucher() {
    setErrorMsg("");
    try {
      const token = getToken();
      if (!token) {
        setErrorMsg("Vui lòng đăng nhập.");
        return;
      }
      await removePromotion(token, bookingId);
      setAppliedPromotion(null);
      setCurrentAmount(originalAmount);
    } catch (err: any) {
      setErrorMsg(err instanceof Error ? err.message : "Gỡ voucher thất bại.");
    }
  }

  async function handlePay() {
    const token = getToken();
    if (!token) {
      setErrorMsg("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const result = await createPayment(token, {
        bookingId,
        paymentMethod,
      });

      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        setErrorMsg("Không nhận được link thanh toán từ gateway. Vui lòng thử lại.");
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Có lỗi xảy ra khi tạo link thanh toán. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedMethod = METHODS.find((m) => m.id === paymentMethod);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Chọn phương thức thanh toán">
        {/* Header */}
        <div className={styles.header}>
          <div style={{ 
            background: "#e0f2fe", 
            color: "#0284c7", 
            width: "48px", 
            height: "48px", 
            borderRadius: "50%", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            margin: "0 auto 12px auto" 
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <h2>Chọn phương thức thanh toán</h2>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>
            Mã booking: <strong style={{ color: "#0f172a" }}>{bookingCode}</strong>
          </p>
        </div>

        {/* Voucher Section */}
        <div style={{ marginBottom: "1rem" }}>
          <VoucherInput
            token={getToken() || ""}
            bookingId={bookingId}
            appliedPromotion={appliedPromotion}
            onApply={handleApplyVoucher}
            onRemove={handleRemoveVoucher}
            loading={loading}
          />
          {!appliedPromotion && (
            <VoucherList
              token={getToken() || ""}
              bookingAmount={originalAmount}
              onSelect={handleApplyVoucher}
            />
          )}
        </div>

        {/* Booking info */}
        <div className={styles.infoCard} style={{ marginTop: "1rem" }}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Mã booking</span>
            <span className={`${styles.infoValue} ${styles.bookingCode}`}>
              {bookingCode}
            </span>
          </div>
          {appliedPromotion && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Tạm tính</span>
              <span className={styles.infoValue} style={{ textDecoration: "line-through", color: "var(--pcs-neutral-400)" }}>
                {formatCurrency(originalAmount)}
              </span>
            </div>
          )}
          {appliedPromotion && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Giảm giá</span>
              <span className={styles.infoValue} style={{ color: "var(--pcs-status-success)" }}>
                - {formatCurrency(appliedPromotion.discountAmount)}
              </span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>💰 Tổng thanh toán</span>
            <span className={`${styles.infoValue} ${styles.price}`}>
              {formatCurrency(currentAmount)}
            </span>
          </div>
        </div>

        {/* Payment method picker */}
        <div className={styles.payMethodSection}>
          <p className={styles.payMethodLabel}>Chọn cổng thanh toán:</p>
          <div className={styles.payMethods}>
            {METHODS.map((m) => (
              <label
                key={m.id}
                className={`${styles.payMethodCard} ${
                  paymentMethod === m.id ? styles.payMethodActive : ""
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.id}
                  checked={paymentMethod === m.id}
                  onChange={() => setPaymentMethod(m.id)}
                  disabled={loading}
                />
                {m.badge && (
                  <span className={styles.payMethodBadge}>{m.badge}</span>
                )}
                <span className={styles.payMethodIcon}>{m.icon}</span>
                <span className={styles.payMethodName}>{m.label}</span>
                <span className={styles.payMethodDesc}>{m.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* PayOS hint */}
        {paymentMethod === "PayOS" && (
          <div className={styles.payosHint}>
            <span>📲</span>
            <p>
              Bạn sẽ quét mã <strong>VietQR</strong> bằng app ngân hàng bất kỳ
              (MBBank, VCB, Techcombank...). Tiền về tài khoản nhận ngay lập tức.
            </p>
          </div>
        )}





        {/* Error */}
        {errorMsg && (
          <div className={styles.errorBox}>
            <p>⚠️ {errorMsg}</p>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button
            className={styles.btnCancel}
            onClick={onClose}
            disabled={loading}
          >
            Hủy & giữ booking
          </button>
          <button
            className={styles.btnPay}
            onClick={handlePay}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Đang xử lý...
              </>
            ) : paymentMethod === "PayOS" ? (
              "Tạo mã VietQR →"
            ) : (
              `Thanh toán ${selectedMethod?.label} →`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
