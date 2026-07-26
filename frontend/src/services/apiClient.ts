const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
};

export async function apiClient<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body
      ? isFormData
        ? (options.body as any)
        : JSON.stringify(options.body)
      : undefined,
    cache: "no-store",
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") || "";
  let result: any = null;

  if (contentType.includes("application/json")) {
    result = await response.json();
  } else {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`API error (status: ${response.status}): ${text.slice(0, 100)}`);
    }
    return text as unknown as T;
  }

  if (!response.ok) {
    // Tự động logout nếu token hết hạn hoặc không hợp lệ
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("pickleclub_token");
      localStorage.removeItem("pickleclub_user");
      window.location.href = "/login";
    }
    throw new Error(result?.message || "API request failed");
  }

  return result as T;
}