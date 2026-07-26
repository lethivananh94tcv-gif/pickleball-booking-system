import { NextResponse } from "next/server";
import { successResponse } from "@/utils/response";

export async function POST() {
  const response = successResponse(null, "Logout successfully");
  
  response.cookies.set("token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  
  return response;
}
