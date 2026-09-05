import { request } from "./api";
import type {
  CartLine,
  Location,
  OrderResult,
  OrderSummary,
  ShippingAddress,
  ShippingService,
} from "@/types";
import type { PaymentMethod } from "@/config";

/* -------------------------------------------------------------------------- */
/* Địa giới hành chính                                                         */
/* -------------------------------------------------------------------------- */

export const fetchCities = (): Promise<Location[]> =>
  request<Location[]>("/locations", { auth: false, query: { type: "city" } });

export const fetchDistricts = (cityId: number): Promise<Location[]> =>
  request<Location[]>("/locations", {
    auth: false,
    query: { type: "district", parentId: cityId },
  });

export const fetchWards = (districtId: number): Promise<Location[]> =>
  request<Location[]>("/locations", {
    auth: false,
    query: { type: "ward", parentId: districtId },
  });

/* -------------------------------------------------------------------------- */
/* Vận chuyển                                                                  */
/* -------------------------------------------------------------------------- */

export interface ShippingFeeInput {
  /** v3 nhận ID địa giới, không nhận tên. */
  cityId: number;
  districtId: number;
  wardId?: number;
  address?: string;
  /** Tổng tiền hàng, dùng để tính phí khai giá. */
  subtotal: number;
  /** Tiền thu hộ. Gửi 0 khi khách đã thanh toán trước. */
  codMoney: number;
  items: Array<{ productId: number; quantity: number }>;
}

/**
 * Tính phí vận chuyển.
 *
 * BFF tự cộng trọng lượng đơn từ khai báo sản phẩm trên Nhanh.vn — v3 bắt
 * buộc truyền `shippingWeight` và không còn tuỳ chọn để Nhanh.vn tự tính.
 */
export const fetchShippingFee = (
  input: ShippingFeeInput,
): Promise<ShippingService[]> =>
  request<ShippingService[]>("/shipping/fee", { method: "POST", body: input });

/* -------------------------------------------------------------------------- */
/* Đơn hàng                                                                    */
/* -------------------------------------------------------------------------- */

export interface CreateOrderInput {
  address: ShippingAddress;
  items: Array<{ productId: number; quantity: number }>;
  paymentMethod: PaymentMethod;
  carrierId: number;
  carrierServiceId: number;
  carrierServiceCode?: string;
  carrierAccountId?: number;
  carrierShopId?: string;
  customerShipFee: number;
  note?: string;
}

/**
 * Tạo đơn.
 *
 * Không gửi giá lên — BFF đọc lại giá và tồn kho từ Nhanh.vn rồi mới tính
 * tổng tiền. Giá do client gửi là thứ không bao giờ được tin.
 */
export const createOrder = (input: CreateOrderInput): Promise<OrderResult> =>
  request<OrderResult>("/orders", { method: "POST", body: input });

export const fetchMyOrders = (): Promise<OrderSummary[]> =>
  request<OrderSummary[]>("/orders");

/** Tổng tiền hàng của giỏ. */
export const cartSubtotal = (lines: CartLine[]): number =>
  lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
