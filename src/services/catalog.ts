import { request } from "./api";
import { CONFIG } from "@/config";
import type { Brand, Category, Product, ProductPage } from "@/types";

/** Cây danh mục. BFF cache 24h nên gọi lại rất rẻ. */
export const fetchCategories = (): Promise<Category[]> =>
  request<Category[]>("/categories", { auth: false });

/** Danh sách thương hiệu. v3 có endpoint riêng nên dữ liệu đầy đủ và nhanh. */
export const fetchBrands = (): Promise<Brand[]> =>
  request<Brand[]>("/brands", { auth: false });

export interface ProductQuery {
  /** Cursor trang sau, lấy từ `next` của lần gọi trước. */
  next?: string | null;
  limit?: number;
  categoryId?: number;
  brandId?: number;
  keyword?: string;
  /**
   * "new"      — mới nhất, sắp theo ID giảm dần.
   * "featured" — danh sách sản phẩm nổi bật nhà thuốc tự chọn trong WP.
   *
   * v3.0 đã bỏ cờ showHot/showNew/showHome của v2, nên không còn cách lọc
   * "sản phẩm hot" trực tiếp từ Nhanh.vn.
   */
  highlight?: "new" | "featured";
}

export const fetchProducts = (
  query: ProductQuery = {},
  signal?: AbortSignal,
): Promise<ProductPage> =>
  request<ProductPage>("/products", {
    auth: false,
    signal,
    query: {
      limit: query.limit ?? CONFIG.PAGE_SIZE,
      next: query.next ?? undefined,
      categoryId: query.categoryId,
      brandId: query.brandId,
      keyword: query.keyword,
      highlight: query.highlight,
    },
  });

export const fetchProduct = (id: number | string): Promise<Product> =>
  request<Product>(`/products/${id}`, { auth: false });
