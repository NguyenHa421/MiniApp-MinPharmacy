import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProducts, type ProductQuery } from "@/services/catalog";
import type { Product } from "@/types";

/**
 * Tải danh sách sản phẩm theo cursor.
 *
 * Nhanh.vn v3.0 phân trang bằng `paginator.next` chứ không phải số trang, nên
 * chỉ đi tiến được — không nhảy tới "trang 5". Giao diện vì thế dùng nút
 * "Xem thêm" thay cho dãy số trang.
 */
export function useProductList(query: ProductQuery) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(query);
  const abortRef = useRef<AbortController | null>(null);
  /** Chặn tải trùng khi người dùng bấm "Xem thêm" liên tục. */
  const inFlight = useRef(false);

  const load = useCallback(
    async (next: string | null, replace: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const res = await fetchProducts({ ...query, next }, ctrl.signal);

        setProducts((prev) =>
          replace ? res.products : [...prev, ...res.products],
        );
        setCursor(res.next);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
        }
      } finally {
        inFlight.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    setProducts([]);
    setCursor(null);
    load(null, true);
    return () => abortRef.current?.abort();
  }, [load]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !cursor) return;
    load(cursor, false);
  }, [load, loading, loadingMore, cursor]);

  return {
    products,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(cursor),
    loadMore,
    reload: () => load(null, true),
  };
}
