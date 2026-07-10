import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    success: true,
    service: "pcs-backend",
    status: "ok",
  });
}
