import type { AuthUser } from "@/types/auth";

const TOKEN_KEY = "pickleclub_token";
const USER_KEY = "pickleclub_user";

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getDashboardPath(role?: string): string {
  const normalizedRole = String(role || "").toLowerCase();

  if (normalizedRole.includes("admin") || normalizedRole.includes("manager")) {
    return "/admin";
  }

  if (normalizedRole.includes("staff")) {
    return "/staff/operations";
  }

  return "/";
}
