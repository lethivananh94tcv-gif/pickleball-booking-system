"use client";

import { useState } from "react";
import type { PromotionValidateResult } from "@/types/promotion";

interface VoucherInputProps {
  token: string;
  bookingId: number;
  appliedPromotion: PromotionValidateResult | null;
  onApply: (code: string) => Promise<void>;
  onRemove: () => Promise<void>;
  loading?: boolean;
}

export default function VoucherInput({
  appliedPromotion,
  onApply,
  onRemove,
  loading = false,
}: VoucherInputProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  async function handleApply() {
    if (!code.trim()) return;
    setError("");
    setApplying(true);
    try {
      await onApply(code.trim().toUpperCase());
      setCode("");
    } catch (err: any) {
      setError(err.message || "Voucher không hợp lệ");
    } finally {
      setApplying(false);
    }
  }

  async function handleRemove() {
    setError("");
    try {
      await onRemove();
    } catch (err: any) {
      setError(err.message || "Không thể gỡ voucher");
    }
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <label style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.3rem", display: "block", color: "#475569" }}>
        🎟️ Mã voucher
      </label>

      {appliedPromotion ? (
        // Đã apply – hiển thị thông tin giảm giá
        <div style={{
          background: "var(--pcs-status-success-bg)",
          border: "1.5px solid var(--pcs-status-success-border)",
          borderRadius: "10px",
          padding: "0.5rem 0.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
        }}>
          <div>
            <div style={{ fontWeight: 700, color: "var(--pcs-status-success)", fontSize: "0.85rem" }}>
              ✅ {appliedPromotion.promotionCode}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--pcs-status-success)" }}>
              {appliedPromotion.promotionName} –{" "}
              Giảm{" "}
              <strong>{appliedPromotion.discountAmount.toLocaleString("vi-VN")}đ</strong>
            </div>
          </div>
          <button
            onClick={handleRemove}
            disabled={loading}
            style={{
              background: "none",
              border: "1px solid var(--pcs-status-error)",
              borderRadius: "6px",
              color: "var(--pcs-status-error)",
              padding: "2px 8px",
              fontSize: "0.75rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Gỡ voucher
          </button>
        </div>
      ) : (
        // Chưa apply – hiện ô nhập
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            placeholder="NHẬP MÃ VOUCHER"
            disabled={applying || loading}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              border: "1.5px solid #cbd5e1",
              borderRadius: "10px",
              fontSize: "0.85rem",
              outline: "none",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              transition: "border-color 0.2s",
            }}
          />
          <button
            onClick={handleApply}
            disabled={applying || loading || !code.trim()}
            style={{
              padding: "0.5rem 1.1rem",
              background: applying || !code.trim() ? "#cbd5e1" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: applying || !code.trim() ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              boxShadow: applying || !code.trim() ? "none" : "0 3px 8px rgba(16, 185, 129, 0.15)",
              transition: "all 0.2s",
            }}
          >
            {applying ? "Đang áp dụng..." : "Áp dụng"}
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: "var(--pcs-status-error)", fontSize: "0.8rem", marginTop: "0.3rem", margin: 0 }}>
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
