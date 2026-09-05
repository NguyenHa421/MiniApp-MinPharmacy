import { CONFIG } from "@/config";
import { storageGet } from "./storage";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Token phiên do BFF cấp. Cache trong RAM để tránh đọc storage mỗi request. */
let sessionToken: string | null = null;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

async function resolveToken(): Promise<string | null> {
  if (sessionToken) return sessionToken;
  sessionToken = await storageGet<string>(CONFIG.STORAGE.TOKEN);
  return sessionToken;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Gắn Authorization header. Mặc định gắn nếu đã có token. */
  auth?: boolean;
  signal?: AbortSignal;
}

/**
 * Gọi BFF. Mọi lỗi HTTP hoặc lỗi nghiệp vụ (`success: false`) đều ném ApiError
 * để phía UI chỉ cần bắt một loại ngoại lệ.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, auth = true, signal } = options;

  let url = `${CONFIG.API_BASE}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await resolveToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      signal,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Không kết nối được máy chủ. Kiểm tra mạng và thử lại.", 0);
  }

  const json = await res.json().catch(() => null);

  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(
      json?.message || `Máy chủ trả lỗi ${res.status}.`,
      res.status,
      json,
    );
  }

  // BFF luôn bọc { success, message, data }
  return (json?.data ?? json) as T;
}
