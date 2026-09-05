import {
  authorize,
  getAccessToken,
  getPhoneNumber,
  getUserInfo,
} from "zmp-sdk/apis";
import { request, setSessionToken } from "./api";
import { storageRemove, storageSet } from "./storage";
import { CONFIG } from "@/config";
import type { AppUser } from "@/types";

interface AuthResponse {
  token: string;
  user: AppUser;
}

async function persist(res: AuthResponse): Promise<AppUser> {
  setSessionToken(res.token);
  await storageSet(CONFIG.STORAGE.TOKEN, res.token);
  return res.user;
}

/**
 * Đăng nhập một chạm bằng Zalo.
 *
 * Client chỉ thu thập `access_token` + `code` (token SĐT, sống 2 phút, dùng
 * một lần). Việc đổi `code` ra số điện thoại thật diễn ra hoàn toàn ở server
 * bằng secret key — client không bao giờ tự khai số điện thoại.
 */
export async function loginWithZalo(): Promise<AppUser> {
  await authorize({ scopes: ["scope.userPhonenumber"] });

  const [{ userInfo }, accessToken] = await Promise.all([
    getUserInfo({ autoRequestPermission: true }),
    getAccessToken(),
  ]);

  const { token: code } = await getPhoneNumber();

  const res = await request<AuthResponse>("/auth/zalo", {
    method: "POST",
    auth: false,
    body: {
      openid: userInfo.id,
      access_token: accessToken,
      code,
      name: userInfo.name,
      avatar: userInfo.avatar,
    },
  });

  return persist(res);
}

/** Đăng nhập bằng SĐT + mật khẩu (dành cho khách đã có tài khoản trên web). */
export async function loginWithPassword(
  phone: string,
  password: string,
): Promise<AppUser> {
  const res = await request<AuthResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { phone, password },
  });
  return persist(res);
}

export interface RegisterInput {
  name: string;
  phone: string;
  password: string;
  email?: string;
  address?: string;
}

export async function register(input: RegisterInput): Promise<AppUser> {
  const res = await request<AuthResponse>("/auth/register", {
    method: "POST",
    auth: false,
    body: input,
  });
  return persist(res);
}

/** Lấy hồ sơ theo token đang lưu. Trả null nếu token hết hạn. */
export async function fetchMe(): Promise<AppUser | null> {
  try {
    return await request<AppUser>("/auth/me");
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  setSessionToken(null);
  await storageRemove(CONFIG.STORAGE.TOKEN);
}
