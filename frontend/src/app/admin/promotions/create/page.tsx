"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPromotion } from "@/services/promotionApi";
import type { CreatePromotionPayload, UserSearchResult } from "@/types/promotion";
import { getToken } from "@/utils/authStorage";
import UserSelectorForVoucher from "@/modules/promotions/components/UserSelectorForVoucher";
import { FiCheckCircle, FiLock, FiPercent, FiGlobe, FiUser, FiUsers, FiFileText, FiClock, FiList, FiAlertCircle } from "react-icons/fi";
import { FaCircleNotch } from "react-icons/fa"; // For some missing things, but we'll use SVGs for exactness if needed
import { formatCurrency } from "@/utils/formatCurrency";
import styles from "./CreatePromotion.module.css";
import Link from "next/link";

function todayVN() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function AdminCreatePromotionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);

  const [formData, setFormData] = useState<CreatePromotionPayload>({
    promotionCode: "",
    promotionName: "",
    description: "",
    discountType: "Percent",
    discountValue: 0,
    maxDiscountAmount: null,
    minBookingAmount: 0,
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    usageLimit: null,
    perUserLimit: 1,
    applyScope: "Public",
    status: "Active",
  });

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    
    // Validate
    if (!formData.promotionCode || !formData.promotionName || !formData.startDate || !formData.endDate || formData.discountValue <= 0) {
      setError("Vui lòng điền đầy đủ các thông tin bắt buộc (*)");
      return;
    }

    setLoading(true);
    setError("");
    const token = getToken();
    if (!token) return;

    try {
      const payload = { ...formData };
      if (payload.applyScope === "Private") {
        if (selectedUsers.length === 0) throw new Error("Voucher Private cần có ít nhất 1 người dùng.");
        payload.userIds = selectedUsers.map((u) => u.UserID);
      }
      
      // Clean up optional numbers
      if (!payload.maxDiscountAmount) delete payload.maxDiscountAmount;
      if (!payload.usageLimit) delete payload.usageLimit;

      await createPromotion(token, payload);
      router.push("/admin/promotions");
    } catch (err: any) {
      setError(err.message || "Lỗi tạo voucher");
    } finally {
      setLoading(false);
    }
  }

  // Format the discount for the preview card
  const previewDiscountValue = formData.discountValue > 0 
    ? (formData.discountType === "Percent" ? `${formData.discountValue}%` : formatCurrency(formData.discountValue))
    : "0";

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>
            <Link href="/admin/promotions" style={{ textDecoration: 'none', color: 'inherit' }}>Khuyến mãi</Link> / <span style={{color: 'var(--pcs-neutral-500)', fontWeight: 'normal'}}>Voucher</span> / <span>Tạo mới</span>
          </div>
          <h1 className={styles.title}>Tạo Voucher mới</h1>
          <p className={styles.subtitle}>Tạo và cấu hình voucher khuyến mãi cho hệ thống</p>
        </div>
        
        <div className={styles.headerActions}>
          <button type="button" onClick={() => router.back()} className={styles.btnCancel}>
            Hủy
          </button>
          <button type="submit" form="create-voucher-form" disabled={loading} className={styles.btnSubmit}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            {loading ? "Đang tạo..." : "Tạo voucher"}
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>⚠️ {error}</div>}

      <div className={styles.mainGrid}>
        
        {/* === CỘT TRÁI: FORM === */}
        <div>
          <form id="create-voucher-form" onSubmit={handleSubmit}>
            
            {/* 1. Thông tin cơ bản */}
            <div className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}>1</div>
                Thông tin cơ bản
              </div>
              
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Mã voucher <span>*</span></label>
                  <input 
                    required 
                    type="text" 
                    className={styles.input} 
                    value={formData.promotionCode} 
                    onChange={e => setFormData({ ...formData, promotionCode: e.target.value.toUpperCase() })} 
                    placeholder="VD: SUMMER10" 
                  />
                  <p style={{ fontSize: "12px", color: "var(--pcs-neutral-500)", marginTop: "4px" }}>Mã phải viết hoa, không dấu, không khoảng cách</p>
                </div>
                
                <div className={styles.formGroup}>
                  <label>Tên voucher <span>*</span></label>
                  <input 
                    required 
                    type="text" 
                    className={styles.input} 
                    value={formData.promotionName} 
                    onChange={e => setFormData({ ...formData, promotionName: e.target.value })} 
                    placeholder="VD: Giảm giá mùa hè" 
                  />
                </div>
              </div>

              <div className={styles.formGrid} style={{ alignItems: "start" }}>
                <div className={styles.formGroup}>
                  <label>Mô tả</label>
                  <textarea 
                    className={`${styles.input} ${styles.textarea}`} 
                    value={formData.description} 
                    maxLength={200}
                    onChange={e => setFormData({ ...formData, description: e.target.value })} 
                    placeholder="Nhập mô tả voucher (không bắt buộc)" 
                  />
                  <p style={{ fontSize: "12px", color: "var(--pcs-neutral-400)", textAlign: "right", marginTop: "4px" }}>
                    {(formData.description || "").length}/200
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label>Trạng thái <span>*</span></label>
                  <div className={styles.radioGroup}>
                    <label className={`${styles.radioCard} ${formData.status === "Active" ? styles.active : ""}`}>
                      <input 
                        type="radio" 
                        name="status" 
                        checked={formData.status === "Active"} 
                        onChange={() => setFormData({ ...formData, status: "Active" })} 
                      />
                      <FiCheckCircle style={{ color: "var(--pcs-status-success)", fontSize: "18px" }} />
                      <span style={{ color: formData.status === "Active" ? "var(--pcs-status-success)" : "inherit" }}>Đang hoạt động</span>
                      {formData.status === "Active" && <FiCheckCircle style={{ marginLeft: "auto", color: "var(--pcs-status-success)" }} />}
                    </label>
                    <label className={`${styles.radioCard} ${formData.status === "Inactive" ? styles.active : ""}`}>
                      <input 
                        type="radio" 
                        name="status" 
                        checked={formData.status === "Inactive"} 
                        onChange={() => setFormData({ ...formData, status: "Inactive" })} 
                      />
                      <FiLock style={{ color: "var(--pcs-neutral-500)", fontSize: "18px" }} />
                      Tạm khóa
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Cấu hình giảm giá */}
            <div className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}>2</div>
                Cấu hình giảm giá
              </div>
              
              <div className={styles.formGrid} style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className={styles.formGroup}>
                  <label>Loại giảm giá <span>*</span></label>
                  <div className={styles.radioGroup}>
                    <label className={`${styles.radioCard} ${formData.discountType === "Percent" ? styles.active : ""}`} style={{ padding: "8px 12px" }}>
                      <input type="radio" checked={formData.discountType === "Percent"} onChange={() => setFormData({ ...formData, discountType: "Percent" })} />
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <FiPercent style={{ fontSize: "16px", color: formData.discountType === "Percent" ? "var(--pcs-brand-primary)" : "var(--pcs-neutral-500)" }} />
                        <span style={{ fontSize: "11px", color: formData.discountType === "Percent" ? "var(--pcs-brand-primary)" : "var(--pcs-neutral-500)", fontWeight: 500 }}>Phần trăm</span>
                      </div>
                    </label>
                    <label className={`${styles.radioCard} ${formData.discountType === "Fixed" ? styles.active : ""}`} style={{ padding: "8px 12px" }}>
                      <input type="radio" checked={formData.discountType === "Fixed"} onChange={() => setFormData({ ...formData, discountType: "Fixed" })} />
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "bold", color: formData.discountType === "Fixed" ? "var(--pcs-brand-primary)" : "var(--pcs-neutral-500)" }}>₫</span>
                        <span style={{ fontSize: "11px", color: formData.discountType === "Fixed" ? "var(--pcs-brand-primary)" : "var(--pcs-neutral-500)", fontWeight: 500 }}>Số tiền VNĐ</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Giá trị giảm <span>*</span></label>
                  <div style={{ position: "relative" }}>
                    <input 
                      required 
                      type="number" 
                      min="1" 
                      className={styles.input} 
                      value={formData.discountValue || ""} 
                      onChange={e => setFormData({ ...formData, discountValue: Number(e.target.value) })} 
                      placeholder="VD: 10" 
                    />
                    <span style={{ position: "absolute", right: "12px", top: "10px", color: "var(--pcs-neutral-400)", fontSize: "14px", fontWeight: 600 }}>
                      {formData.discountType === "Percent" ? "%" : "đ"}
                    </span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Giảm tối đa</label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type="number" 
                      min="0" 
                      className={styles.input} 
                      value={formData.maxDiscountAmount || ""} 
                      onChange={e => setFormData({ ...formData, maxDiscountAmount: e.target.value ? Number(e.target.value) : null })} 
                      placeholder="VD: 50.000" 
                      disabled={formData.discountType === "Fixed"}
                      style={formData.discountType === "Fixed" ? { backgroundColor: "var(--pcs-neutral-100)", cursor: "not-allowed" } : {}}
                    />
                    <span style={{ position: "absolute", right: "12px", top: "10px", color: "var(--pcs-neutral-400)", fontSize: "14px", fontWeight: 600 }}>đ</span>
                  </div>
                </div>
              </div>

              <div className={styles.formGrid} style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className={styles.formGroup}>
                  <label>Đơn tối thiểu</label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type="number" 
                      min="0" 
                      className={styles.input} 
                      value={formData.minBookingAmount || ""} 
                      onChange={e => setFormData({ ...formData, minBookingAmount: Number(e.target.value) })} 
                      placeholder="VD: 200.000" 
                    />
                    <span style={{ position: "absolute", right: "12px", top: "10px", color: "var(--pcs-neutral-400)", fontSize: "14px", fontWeight: 600 }}>đ</span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Số lượng <span>*</span></label>
                  <input 
                    type="number" 
                    min="1" 
                    className={styles.input} 
                    value={formData.usageLimit || ""} 
                    onChange={e => setFormData({ ...formData, usageLimit: e.target.value ? Number(e.target.value) : null })} 
                    placeholder="VD: 100" 
                  />
                  <p style={{ fontSize: "12px", color: "var(--pcs-neutral-500)", marginTop: "4px" }}>Tổng số lượt sử dụng</p>
                </div>

                <div className={styles.formGroup}>
                  <label>Mỗi người dùng tối đa</label>
                  <input 
                    required 
                    type="number" 
                    min="1" 
                    className={styles.input} 
                    value={formData.perUserLimit || ""} 
                    onChange={e => setFormData({ ...formData, perUserLimit: Number(e.target.value) })} 
                    placeholder="VD: 1" 
                  />
                  <p style={{ fontSize: "12px", color: "var(--pcs-neutral-500)", marginTop: "4px" }}>Số lượt sử dụng tối đa/người</p>
                </div>
              </div>
            </div>

            {/* 3. Phạm vi áp dụng */}
            <div className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}>3</div>
                Phạm vi áp dụng
              </div>
              
              <div className={styles.formGroup} style={{ marginBottom: "20px" }}>
                <label>Phạm vi <span>*</span></label>
                <div className={styles.radioGroup}>
                  <label className={`${styles.radioCard} ${formData.applyScope === "Public" ? styles.active : ""}`}>
                    <input type="radio" checked={formData.applyScope === "Public"} onChange={() => setFormData({ ...formData, applyScope: "Public" })} />
                    <FiGlobe style={{ fontSize: "18px", color: formData.applyScope === "Public" ? "var(--pcs-brand-primary)" : "var(--pcs-neutral-500)" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>Public</span>
                      <span style={{ fontSize: "11px", color: formData.applyScope === "Public" ? "var(--pcs-brand-primary)" : "var(--pcs-neutral-500)" }}>Tất cả người dùng</span>
                    </div>
                  </label>
                  <label className={`${styles.radioCard} ${formData.applyScope === "Private" ? styles.active : ""}`}>
                    <input type="radio" checked={formData.applyScope === "Private"} onChange={() => setFormData({ ...formData, applyScope: "Private" })} />
                    <FiUser style={{ fontSize: "18px", color: formData.applyScope === "Private" ? "var(--pcs-brand-primary)" : "var(--pcs-neutral-500)" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>Người dùng cụ thể</span>
                      <span style={{ fontSize: "11px", color: formData.applyScope === "Private" ? "var(--pcs-brand-primary)" : "var(--pcs-neutral-500)" }}>Chọn người dùng</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Ngày bắt đầu <span>*</span></label>
                  <input 
                    required 
                    type="date" 
                    className={styles.input} 
                    min={todayVN()}
                    value={formData.startDate} 
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Ngày kết thúc <span>*</span></label>
                  <input 
                    required 
                    type="date" 
                    className={styles.input} 
                    min={formData.startDate || todayVN()}
                    value={formData.endDate} 
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })} 
                  />
                </div>
              </div>

              {formData.applyScope === "Private" && (
                <div style={{ marginTop: "20px", borderTop: "1px dashed var(--pcs-neutral-200)", paddingTop: "20px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "12px", color: "var(--pcs-neutral-800)" }}>Người dùng được áp dụng</label>
                  <UserSelectorForVoucher
                    token={getToken()!}
                    selectedUsers={selectedUsers}
                    onAdd={(u) => setSelectedUsers([...selectedUsers, u])}
                    onRemove={(id) => setSelectedUsers(selectedUsers.filter(u => u.UserID !== id))}
                  />
                </div>
              )}
            </div>

          </form>
        </div>

        {/* === CỘT PHẢI: PREVIEW === */}
        <div style={{ position: "sticky", top: "24px" }}>
          <div className={styles.previewSection}>
            <div className={styles.previewHeader}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--pcs-neutral-700)'}}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Xem trước voucher
            </div>
            
            <div className={styles.voucherCard}>
              <div className={styles.voucherCodeArea}>
                <span className={styles.voucherLabel}>Mã voucher</span>
                <span className={styles.voucherCode}>{formData.promotionCode || "SUMMER10"}</span>
                <span className={styles.voucherName}>{formData.promotionName || "Giảm giá mùa hè"}</span>
              </div>
              <div className={styles.voucherDiscountArea}>
                <span className={styles.discountLabel}>Giảm giá</span>
                <span className={styles.discountValue}>{previewDiscountValue}</span>
              </div>
            </div>

            <div className={styles.summaryList}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}><FiLock /> Giảm tối đa</span>
                <span className={styles.summaryValue}>{formData.maxDiscountAmount ? formatCurrency(formData.maxDiscountAmount) : "50.000đ"}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}><FiFileText /> Đơn tối thiểu</span>
                <span className={styles.summaryValue}>{formData.minBookingAmount ? formatCurrency(formData.minBookingAmount) : "200.000đ"}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}><FiGlobe /> Phạm vi</span>
                <span className={styles.summaryValue}>{formData.applyScope}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}><FiClock /> Thời gian</span>
                <span className={styles.summaryValue}>
                  {formData.startDate ? new Date(formData.startDate).toLocaleDateString("vi-VN") : "01/06/2026"} - 
                  {formData.endDate ? new Date(formData.endDate).toLocaleDateString("vi-VN") : "30/06/2026"}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}><FiList /> Số lượng</span>
                <span className={styles.summaryValue}>{formData.usageLimit ? `${formData.usageLimit} lượt` : "100 lượt"}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}><FiUser /> Mỗi người dùng tối đa</span>
                <span className={styles.summaryValue}>{formData.perUserLimit} lượt</span>
              </div>
            </div>
          </div>

          <div className={styles.noteBox}>
            <div className={styles.noteHeader}>
              <FiAlertCircle /> Lưu ý quan trọng
            </div>
            <ul className={styles.noteList}>
              <li>Voucher sẽ chỉ có hiệu lực khi được bật trạng thái <strong>"Đang hoạt động"</strong>.</li>
              <li>Người dùng sẽ không thể sử dụng voucher khi đã hết hạn hoặc hết lượt.</li>
              {formData.applyScope === "Private" && (
                <li>Với voucher <strong>Private</strong>, bạn phải chọn ít nhất 1 người dùng để áp dụng.</li>
              )}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
