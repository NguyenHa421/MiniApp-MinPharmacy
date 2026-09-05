/**
 * Cấu hình toàn cục của Mini App.
 *
 * QUAN TRỌNG: Mini App KHÔNG gọi thẳng Nhanh.vn. Toàn bộ request đi qua BFF
 * đặt tại minpharmacy.com.vn, vì:
 *
 *  1. Nhanh.vn v3.0 xác thực bằng `Authorization: {accessToken}` cấp doanh
 *     nghiệp. Nhúng vào bundle Mini App là công khai nó — bundle JS ai cũng
 *     tải và đọc được.
 *  2. Open API không trả CORS header cho origin của Mini App WebView.
 *  3. Nhanh.vn giới hạn 150 request/30 giây theo appId + businessId và khoá
 *     app nếu bị gọi dồn. Cache phải nằm ở server, không phải ở từng máy.
 *
 * Sau khi deploy BFF, khai báo domain trong `app-config.json`:
 *   "listCSP": { "connect-src": ["https://minpharmacy.com.vn"] }
 */
export const CONFIG = {
  /** Base URL của BFF. Đổi sang staging khi test. */
  API_BASE: "https://minpharmacy.com.vn/wp-json/mnp/v1",

  STORAGE: {
    TOKEN: "mnp_token",
    CART: "mnp_cart",
    ADDRESS: "mnp_last_address",
  },

  /** Số sản phẩm mỗi lần tải thêm. Nhanh.vn giới hạn tối đa 100. */
  PAGE_SIZE: 20,

  /** Ngưỡng miễn phí vận chuyển (VND). Đặt 0 để tắt. */
  FREE_SHIP_THRESHOLD: 500000,
} as const;

export type PaymentMethod = "COD" | "BANK_TRANSFER" | "ZALOPAY";
