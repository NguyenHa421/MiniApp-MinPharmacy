/** Định dạng tiền VND: 125000 -> "125.000đ" */
export const formatPrice = (value: number): string =>
  `${Math.round(value || 0).toLocaleString("vi-VN")}đ`;

/** Phần trăm giảm giá, làm tròn xuống. Trả 0 nếu không giảm. */
export const discountPercent = (price: number, oldPrice: number): number => {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.floor(((oldPrice - price) / oldPrice) * 100);
};

/** Chuẩn hoá SĐT Việt Nam về dạng 0xxxxxxxxx. */
export const normalizePhone = (raw: string): string => {
  const p = (raw || "").replace(/[\s\-.()]/g, "");
  if (p.startsWith("+84")) return `0${p.slice(3)}`;
  if (p.startsWith("84") && p.length === 11) return `0${p.slice(2)}`;
  return p;
};

export const isValidPhone = (raw: string): boolean =>
  /^(03|05|07|08|09)\d{8}$/.test(normalizePhone(raw));

/** Bỏ thẻ HTML trong mô tả sản phẩm trả về từ Nhanh.vn. */
export const stripHtml = (html: string): string =>
  (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
