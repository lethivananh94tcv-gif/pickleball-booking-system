import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import { v2 as cloudinary } from "cloudinary";

// Khởi tạo Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "jwbyk0m0",
  api_key: process.env.CLOUDINARY_API_KEY || "155385268322998",
  api_secret: process.env.CLOUDINARY_API_SECRET || "QsZaTO70NScEb-SbkBseVFRfuG8"
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file || !file.name) {
      return NextResponse.json({ message: "Không tìm thấy file upload" }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      return NextResponse.json({ message: "File không được vượt quá 5MB" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ message: "Chỉ được chọn ảnh JPG, PNG, WEBP hoặc file PDF" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Xác định resource type và folder trên Cloudinary
    const isPdf = file.type === "application/pdf" || ext === ".pdf";
    const resourceType = isPdf ? "raw" : "image";
    const folderPath = `pcs_project/tournaments/${isPdf ? "certificates" : "banners"}`;

    const timestamp = Date.now();
    const safeFilename = `tournament-${timestamp}${ext}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          public_id: safeFilename.split(".")[0],
          resource_type: resourceType
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    const cloudUrl = (uploadResult as any).secure_url;

    return NextResponse.json({ 
      data: { url: cloudUrl }, 
      message: "Upload file lên Cloudinary thành công" 
    }, { status: 200 });
  } catch (error: any) {
    console.error("Lỗi upload Cloudinary cho giải đấu:", error);
    return NextResponse.json({ message: error.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
