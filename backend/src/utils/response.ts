import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
};

export function successResponse<T>(
  data: T,
  message = "Success",
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { 
      status,
      headers: corsHeaders
    }
  );
}

export function errorResponse(message = "Error", status = 500, errors?: unknown) {
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
    },
    { 
      status,
      headers: corsHeaders
    }
  );
}