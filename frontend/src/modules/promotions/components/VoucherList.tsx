"use client";

import { useState, useEffect, useCallback } from "react";
import type { Promotion } from "@/types/promotion";
import VoucherCard from "./VoucherCard";
import { getMyPromotions } from "@/services/promotionApi";

interface VoucherListProps {
  token: string;
  bookingAmount?: number;
  onSelect?: (code: string) => void;
}

export default function VoucherList({ token, bookingAmount, onSelect }: VoucherListProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getMyPromotions(token, bookingAmount);
      setPromotions(data);
    } catch {
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  }, [token, bookingAmount]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;
  if (promotions.length === 0) return null;

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <div
        style={{
          color: "#059669",
          fontSize: "0.85rem",
          fontWeight: 700,
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "4px"
        }}
      >
        <span>🎁</span> Voucher khả dụng ({promotions.length}):
      </div>

      {open && (
        <div style={{
          marginTop: "0.4rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          maxHeight: "135px",
          overflowY: "auto",
        }}>
          {promotions.map((p) => (
            <VoucherCard key={p.promotionId} promotion={p} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
