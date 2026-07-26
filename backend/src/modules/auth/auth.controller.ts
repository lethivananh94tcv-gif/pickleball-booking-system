import { NextRequest } from "next/server";

import * as authService from "./auth.service";
import { loginSchema, registerSchema } from "./auth.validation";
import { successResponse } from "@/utils/response";
import { handleError } from "@/middlewares/error";
import { verifyAccessToken } from "@/utils/jwt";
import { getTokenFromRequest } from "@/middlewares/auth.middleware";

export async function registerController(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const result = await authService.register(data);

    return successResponse(result, "Register successfully", 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function verifyRegisterOtpController(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await authService.verifyRegisterOtp({
      email: body.email,
      otp: body.otp,
    });

    return successResponse(result, "Verify register OTP successfully");
  } catch (error) {
    return handleError(error);
  }
}

export async function loginController(req: NextRequest) {
  try {
    const body = await req.json();
    const data = loginSchema.parse(body);

    const result = await authService.login(data);

    const response = successResponse(result, "Login successfully");
    
    // Set token cookie
    response.cookies.set("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error) {
    return handleError(error);
  }
}

export async function meController(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      throw new Error("Unauthorized");
    }

    const decoded = verifyAccessToken(token);

    const result = await authService.me(decoded.userId);

    return successResponse(result, "Get current user successfully");
  } catch (error) {
    return handleError(error);
  }
}

export async function forgotPasswordController(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await authService.forgotPassword({
      email: body.email,
    });

    return successResponse(result, "Send reset password OTP successfully");
  } catch (error) {
    return handleError(error);
  }
}

export async function resetPasswordController(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await authService.resetPassword({
      email: body.email,
      otp: body.otp,
      newPassword: body.newPassword,
    });

    return successResponse(result, "Reset password successfully");
  } catch (error) {
    return handleError(error);
  }
}


export async function googleLoginController(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await authService.googleLogin({
      credential: body.credential,
    });

    const response = successResponse(
      result,
      "Đăng nhập Google thành công"
    );

    // Set token cookie
    response.cookies.set("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error) {
    return handleError(error);
  }
}