// ==========================================
// promotions.validation.ts
// Zod schemas for Promotion module
// ==========================================

import { z } from "zod";

export const createPromotionSchema = z
  .object({
    promotionCode: z
      .string()
      .min(1, "Mã voucher không được rỗng")
      .max(50, "Mã voucher tối đa 50 ký tự")
      .regex(/^[A-Z0-9_-]+$/i, "Mã voucher chỉ chứa chữ cái, số, _ hoặc -")
      .transform((v) => v.trim().toUpperCase()),
    promotionName: z.string().min(1, "Tên voucher không được rỗng").max(100),
    description: z.string().max(500).optional(),
    discountType: z.enum(["Percent", "Fixed"], {
      error: "discountType phải là Percent hoặc Fixed",
    }),
    discountValue: z.number().positive("discountValue phải > 0"),
    maxDiscountAmount: z.number().min(0).nullable().optional(),
    minBookingAmount: z.number().min(0).optional().default(0),
    startDate: z.string().min(1, "startDate không được rỗng"),
    endDate: z.string().min(1, "endDate không được rỗng"),
    usageLimit: z.number().int().positive().nullable().optional(),
    perUserLimit: z.number().int().positive().optional().default(1),
    applyScope: z.enum(["Public", "Private"], {
      error: "applyScope phải là Public hoặc Private",
    }),
    status: z.enum(["Active", "Inactive", "Expired"]).optional().default("Active"),
    userIds: z.array(z.number().int().positive()).optional(),
  })
  .superRefine((data, ctx) => {
    // Percent: discountValue <= 100
    if (data.discountType === "Percent" && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "discountValue phần trăm không được vượt quá 100",
        path: ["discountValue"],
      });
    }
    // endDate >= startDate
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate phải sau hoặc bằng startDate",
        path: ["endDate"],
      });
    }
    // startDate >= today VN
    const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const todayStr = `${nowVN.getFullYear()}-${String(nowVN.getMonth() + 1).padStart(2, "0")}-${String(nowVN.getDate()).padStart(2, "0")}`;
    const startStr = data.startDate.split("T")[0];
    if (startStr < todayStr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate không được ở quá khứ",
        path: ["startDate"],
      });
    }
    // Private: userIds không được rỗng
    if (data.applyScope === "Private" && (!data.userIds || data.userIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Voucher Private phải có ít nhất 1 user được gán",
        path: ["userIds"],
      });
    }
  });

export const updatePromotionSchema = z
  .object({
    promotionName: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    discountType: z.enum(["Percent", "Fixed"]).optional(),
    discountValue: z.number().positive().optional(),
    maxDiscountAmount: z.number().min(0).nullable().optional(),
    minBookingAmount: z.number().min(0).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    perUserLimit: z.number().int().positive().optional(),
    applyScope: z.enum(["Public", "Private"]).optional(),
    status: z.enum(["Active", "Inactive", "Expired"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "Percent" && data.discountValue !== undefined && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "discountValue phần trăm không được vượt quá 100",
        path: ["discountValue"],
      });
    }
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate phải sau hoặc bằng startDate",
        path: ["endDate"],
      });
    }
    if (data.startDate) {
      const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      const todayStr = `${nowVN.getFullYear()}-${String(nowVN.getMonth() + 1).padStart(2, "0")}-${String(nowVN.getDate()).padStart(2, "0")}`;
      const startStr = data.startDate.split("T")[0];
      if (startStr < todayStr) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "startDate không được ở quá khứ",
          path: ["startDate"],
        });
      }
    }
  });

export const updateStatusSchema = z.object({
  status: z.enum(["Active", "Inactive", "Expired"], {
    error: "status phải là Active, Inactive hoặc Expired",
  }),
});

export const validatePromotionSchema = z.object({
  promotionCode: z.string().min(1, "Mã voucher không được rỗng").transform((v) => v.trim().toUpperCase()),
  bookingId: z.number().int().positive("bookingId phải là số nguyên dương"),
});

export const applyPromotionSchema = z.object({
  bookingId: z.number().int().positive("bookingId phải là số nguyên dương"),
  promotionCode: z.string().min(1, "Mã voucher không được rỗng").transform((v) => v.trim().toUpperCase()),
});

export const removePromotionSchema = z.object({
  bookingId: z.number().int().positive("bookingId phải là số nguyên dương"),
});

export const assignUsersSchema = z.object({
  userIds: z
    .array(z.number().int().positive())
    .min(1, "Phải có ít nhất 1 user"),
});
