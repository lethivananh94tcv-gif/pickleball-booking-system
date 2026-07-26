import * as fs from "fs";
import * as path from "path";
import { v2 as cloudinary } from "cloudinary";

// Khởi tạo Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "jwbyk0m0",
  api_key: process.env.CLOUDINARY_API_KEY || "155385268322998",
  api_secret: process.env.CLOUDINARY_API_SECRET || "QsZaTO70NScEb-SbkBseVFRfuG8"
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

class CustomUploadError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "CustomUploadError";
    this.statusCode = statusCode;
  }
}

function getPublicIdFromUrl(url: string): string | null {
  try {
    if (!url.includes("res.cloudinary.com")) return null;
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;
    const remaining = parts[1];
    const pathParts = remaining.split("/");
    if (pathParts[0].startsWith("v")) {
      pathParts.shift();
    }
    const pathWithoutVersion = pathParts.join("/");
    const publicId = pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf("."));
    return publicId;
  } catch (err) {
    console.error("Lỗi khi parse publicId từ Cloudinary URL:", err);
    return null;
  }
}

export function deleteFile(relativePath: string): void {
  if (!relativePath) return;

  if (relativePath.includes("res.cloudinary.com")) {
    const publicId = getPublicIdFromUrl(relativePath);
    if (publicId) {
      cloudinary.uploader.destroy(publicId)
        .then((res) => {
          console.log(`[Cloudinary] Deleted asset: ${publicId}`, res);
        })
        .catch((err) => {
          console.error(`[Cloudinary] Error deleting asset: ${publicId}`, err);
        });
    }
  } else {
    try {
      const fullPath = path.join(process.cwd(), "public", relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.error("Lỗi khi xóa file local:", err);
    }
  }
}

export async function validateAndSaveFile(
  file: File,
  type: "avatar" | "certificate",
  coachId: number
): Promise<string> {
  if (!file || !file.name) {
    throw new CustomUploadError("Không tìm thấy file upload", 400);
  }

  const maxSize = type === "avatar" ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) {
    const limitLabel = type === "avatar" ? "3MB" : "5MB";
    const entityLabel = type === "avatar" ? "Ảnh đại diện" : "Ảnh chứng chỉ";
    throw new CustomUploadError(
      `${entityLabel} không được vượt quá ${limitLabel}`,
      400
    );
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new CustomUploadError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP", 400);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new CustomUploadError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP", 400);
  }

  const timestamp = Date.now();
  const safeFilename = `coach-${coachId}-${type}-${timestamp}${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const subDir = type === "avatar" ? "avatars" : "certificates";
  const folderPath = `pcs_project/coaches/${subDir}`;

  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          public_id: safeFilename.split(".")[0],
          resource_type: "image"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return (uploadResult as any).secure_url;
  } catch (err: any) {
    console.error("Cloudinary upload error:", err);
    throw new CustomUploadError(`Tải ảnh lên đám mây thất bại: ${err.message || err}`, 500);
  }
}

export async function validateAndSaveCourtFile(
  file: File,
  courtId: number
): Promise<string> {
  if (!file || !file.name) {
    throw new CustomUploadError("Không tìm thấy file upload", 400);
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new CustomUploadError("Hình ảnh sân không được vượt quá 5MB", 400);
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new CustomUploadError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP", 400);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new CustomUploadError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP", 400);
  }

  const timestamp = Date.now();
  const safeFilename = `court-${courtId}-${timestamp}${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const folderPath = "pcs_project/courts";

  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          public_id: safeFilename.split(".")[0],
          resource_type: "image"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return (uploadResult as any).secure_url;
  } catch (err: any) {
    console.error("Cloudinary upload error:", err);
    throw new CustomUploadError(`Tải ảnh lên đám mây thất bại: ${err.message || err}`, 500);
  }
}

export async function validateAndSaveRefundFile(
  file: File,
  refundId: number
): Promise<string> {
  if (!file || !file.name) {
    throw new CustomUploadError("Không tìm thấy file upload", 400);
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new CustomUploadError("Hình ảnh bill không được vượt quá 5MB", 400);
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new CustomUploadError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP", 400);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new CustomUploadError("Chỉ được chọn ảnh JPG, PNG hoặc WEBP", 400);
  }

  const timestamp = Date.now();
  const safeFilename = `refund-${refundId}-${timestamp}${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const folderPath = "pcs_project/refunds";

  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          public_id: safeFilename.split(".")[0],
          resource_type: "image"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return (uploadResult as any).secure_url;
  } catch (err: any) {
    console.error("Cloudinary upload error:", err);
    throw new CustomUploadError(`Tải ảnh lên đám mây thất bại: ${err.message || err}`, 500);
  }
}
