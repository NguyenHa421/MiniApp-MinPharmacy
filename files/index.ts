/**
 * Kiểu dữ liệu dùng chung. BFF đã chuẩn hoá từ Nhanh.vn API v3.0 và lọc bỏ
 * field nội bộ (giá nhập, giá vốn, giá sỉ, tồn từng kho).
 */

export interface Category {
  id: number;
  parentId: number;
  code: string;
  name: string;
  image: string;
  /** v3 trả danh mục phẳng; BFF dựng cây từ parentId. */
  children: Category[];
}

export interface Brand {
  id: number;
  parentId: number;
  code: string;
  name: string;
  /** Nhanh.vn không lưu logo thương hiệu — nhà thuốc tự map trong WP. */
  logo: string;
}

export interface ProductAttribute {
  name: string;
  value: string;
}

export interface Product {
  /** ID sản phẩm trên Nhanh.vn. Khoá duy nhất toàn hệ thống. */
  id: number;
  code: string;
  barcode: string;
  name: string;
  /** Giá cuối cùng khách phải trả, đã cộng VAT nếu giá gốc chưa gồm. */
  price: number;
  /** Giá gạch ngang. Chỉ hiển thị khi > price. */
  oldPrice: number;
  unit: string;
  image: string;
  images: string[];
  categoryId: number;
  brandId: number;
  brandName: string;
  countryName: string;
  /** Trọng lượng tính cước, gram. */
  shippingWeight: number;
  /** Số lượng còn bán được (inventory.available). */
  available: number;
  warrantyMonth: number;
  attributes: ProductAttribute[];
}

/**
 * Một trang sản phẩm.
 *
 * v3 phân trang bằng cursor: `next` là giá trị đục, client chỉ việc gửi lại
 * nguyên văn để lấy trang sau. `next === null` nghĩa là đã hết dữ liệu.
 */
export interface ProductPage {
  products: Product[];
  next: string | null;
}

export interface CartLine {
  product: Product;
  quantity: number;
}

/** Đơn vị hành chính. v3 làm việc bằng ID, không bằng tên. */
export interface Location {
  id: number;
  name: string;
}

export interface ShippingService {
  carrierId: number;
  carrierName: string;
  logo: string;
  serviceId: number;
  serviceCode: string;
  serviceName: string;
  description: string;
  shipFee: number;
  codFee: number;
  declaredFee: number;
  /** Số tiền báo khách = shipFee + codFee + declaredFee. */
  totalFee: number;
  /** Chỉ có khi nhà thuốc dùng tài khoản vận chuyển riêng. */
  accountId: number;
  shopId: string;
}

export interface ShippingAddress {
  name: string;
  phone: string;
  email?: string;
  address: string;
  cityId: number;
  districtId: number;
  wardId: number;
  /** Tên chỉ để hiển thị lại cho khách, không gửi cho hãng vận chuyển. */
  cityName: string;
  districtName: string;
  wardName: string;
}

export interface AppUser {
  id: number;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  zaloVerified: boolean;
}

export interface OrderResult {
  /** Mã đơn trên hệ thống nhà thuốc. */
  id: string;
  /** ID đơn trên Nhanh.vn, null khi chưa đẩy sang (đơn chờ thanh toán). */
  nhanhOrderId: number | null;
  total: number;
  paymentMethod: string;
  /** URL cổng thanh toán, chỉ có khi chọn thanh toán online. */
  paymentUrl?: string;
}

export interface OrderSummary {
  id: string;
  total: number;
  status: string;
  itemCount: number;
  createdAt: string;
}
