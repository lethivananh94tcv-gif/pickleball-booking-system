import { NextRequest, NextResponse } from "next/server";
import * as path from "path";

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
      return NextResponse.json({ message: "Chỉ được chọn ảnh JPG, PNG hoặc WEBP" }, { status: 400 });
    }

    // Convert file to buffer and create a blob to send to Cloud (Catbox.moe)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const catboxForm = new FormData();
    catboxForm.append("reqtype", "fileupload");
    const blob = new Blob([buffer], { type: file.type });
    catboxForm.append("fileToUpload", blob, file.name);

    const catboxRes = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: catboxForm,
    });

    if (!catboxRes.ok) {
      throw new Error("Lỗi khi kết nối tới máy chủ cloud");
    }

    const cloudUrl = await catboxRes.text();
    if (!cloudUrl || !cloudUrl.trim().startsWith("http")) {
      throw new Error("Máy chủ cloud trả về kết quả không hợp lệ: " + cloudUrl);
    }

    return NextResponse.json({ 
      data: { url: cloudUrl.trim() }, 
      message: "Upload file lên cloud thành công" 
    }, { status: 200 });
  } catch (error: any) {
    console.error("Lỗi upload cloud:", error);
    return NextResponse.json({ message: error.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
