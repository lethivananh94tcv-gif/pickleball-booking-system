import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16: file đổi tên từ middleware.ts → proxy.ts.
 * Export function phải tên là `proxy` (hoặc default export).
 */
export function proxy(req: NextRequest) {
  const origin = req.headers.get("origin") || "http://localhost:3000";

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
