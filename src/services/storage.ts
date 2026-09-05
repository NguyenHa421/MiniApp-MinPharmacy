import { getStorage, setStorage, removeStorage } from "zmp-sdk/apis";

/**
 * Bọc storage của Zalo Mini App.
 *
 * `zmp-sdk` dùng API bất đồng bộ và có hạn mức riêng; localStorage vẫn chạy
 * trong WebView nhưng có thể bị xoá khi Zalo dọn cache. Ta ưu tiên zmp-sdk,
 * rơi về localStorage khi chạy ngoài Zalo (dev trên trình duyệt).
 */

export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    const res = await getStorage({ keys: [key] });
    const raw = (res as Record<string, unknown>)?.[key];
    return raw ? (JSON.parse(String(raw)) as T) : null;
  } catch {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  try {
    await setStorage({ data: { [key]: raw } });
  } catch {
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      /* private mode — bỏ qua, dữ liệu chỉ sống trong phiên */
    }
  }
}

export async function storageRemove(key: string): Promise<void> {
  try {
    await removeStorage({ keys: [key] });
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* bỏ qua */
    }
  }
}
