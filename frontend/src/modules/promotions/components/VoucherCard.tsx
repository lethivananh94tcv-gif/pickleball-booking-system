"use client";

import { useState } from "react";
import type { Promotion } from "@/types/promotion";

interface VoucherCardProps {
  promotion: Promotion;
  onSelect?: (code: string) => void;
}

export default function VoucherCard({ promotion, onSelect }: VoucherCardProps) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(promotion.promotionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const endDate = promotion.endDate
    ? new Date(promotion.endDate).toLocaleDateString("vi-VN")
    : "";

  const discountLabel =
    promotion.discountType === "Percent"
      ? `Giảm ${promotion.discountValue}%`
      : `Giảm ${promotion.discountValue.toLocaleString("vi-VN")}đ`;

  return (
    <div style={{
      border: "1px dashed #10b981",
      borderRadius: "10px",
      background: "#f0fdf4",
      padding: "8px 12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>🎟️</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <strong style={{ color: "#047857", fontSize: "0.85rem", letterSpacing: "0.5px" }}>
              {promotion.promotionCode}
            </strong>
            <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 700 }}>
              ({discountLabel})
            </span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>
            HSD: {endDate} {promotion.minBookingAmount ? `• Đơn tối thiểu ${promotion.minBookingAmount.toLocaleString("vi-VN")}đ` : ""}
          </div>
        </div>
      </div>
      
      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
        <button
          onClick={copyCode}
          style={{
            background: "none",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            color: "#475569",
            padding: "3px 8px",
            fontSize: "0.7rem",
            cursor: "pointer",
            fontWeight: 600,
            transition: "all 0.15s",
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
        {onSelect && (
          <button
            onClick={() => onSelect(promotion.promotionCode)}
            style={{
              background: "#10b981",
              border: "none",
              borderRadius: "6px",
              color: "#ffffff",
              padding: "3px 8px",
              fontSize: "0.7rem",
              cursor: "pointer",
              fontWeight: 700,
              transition: "all 0.15s",
            }}
          >
            Dùng
          </button>
        )}
      </div>
    </div>
  );
}
