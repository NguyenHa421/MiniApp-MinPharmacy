import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { CONFIG } from "@/config";
import { storageGet, storageSet } from "@/services/storage";
import { fetchMe } from "@/services/auth";
import { setSessionToken } from "@/services/api";
import type { AppUser, CartLine, Product, ShippingAddress } from "@/types";

/* -------------------------------------------------------------------------- */
/* Giỏ hàng                                                                    */
/* -------------------------------------------------------------------------- */

export const cartAtom = atom<CartLine[]>([]);

export const cartCountAtom = atom((get) =>
  get(cartAtom).reduce((n, l) => n + l.quantity, 0),
);

export const cartSubtotalAtom = atom((get) =>
  get(cartAtom).reduce((s, l) => s + l.product.price * l.quantity, 0),
);

export function useCart() {
  const [lines, setLines] = useAtom(cartAtom);

  /** Ghi lại storage mỗi khi giỏ đổi. Chỉ lưu id + số lượng + giá tại thời
   *  điểm thêm, tránh giữ snapshot sản phẩm đã cũ giá. */
  useEffect(() => {
    storageSet(CONFIG.STORAGE.CART, lines);
  }, [lines]);

  const add = useCallback(
    (product: Product, quantity = 1) => {
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.product.id === product.id);
        if (idx === -1) return [...prev, { product, quantity }];
        const next = [...prev];
        const merged = next[idx].quantity + quantity;
        // Không cho vượt tồn kho khả dụng.
        next[idx] = {
          ...next[idx],
          quantity: Math.min(merged, product.available || merged),
        };
        return next;
      });
    },
    [setLines],
  );

  const setQuantity = useCallback(
    (productId: number, quantity: number) => {
      setLines((prev) =>
        quantity <= 0
          ? prev.filter((l) => l.product.id !== productId)
          : prev.map((l) =>
              l.product.id === productId ? { ...l, quantity } : l,
            ),
      );
    },
    [setLines],
  );

  const remove = useCallback(
    (productId: number) =>
      setLines((prev) => prev.filter((l) => l.product.id !== productId)),
    [setLines],
  );

  const clear = useCallback(() => setLines([]), [setLines]);

  return { lines, add, setQuantity, remove, clear };
}

/* -------------------------------------------------------------------------- */
/* Người dùng                                                                  */
/* -------------------------------------------------------------------------- */

export const userAtom = atom<AppUser | null>(null);
/** true khi chưa xác định xong trạng thái đăng nhập — dùng để tránh nháy UI. */
export const authLoadingAtom = atom(true);

export const useUser = () => useAtomValue(userAtom);
export const useSetUser = () => useSetAtom(userAtom);

/* -------------------------------------------------------------------------- */
/* Địa chỉ giao hàng gần nhất                                                  */
/* -------------------------------------------------------------------------- */

export const addressAtom = atom<ShippingAddress | null>(null);

/* -------------------------------------------------------------------------- */
/* Khởi tạo app: nạp giỏ hàng + phiên đăng nhập từ storage                     */
/* -------------------------------------------------------------------------- */

export function useBootstrap() {
  const setCart = useSetAtom(cartAtom);
  const setUser = useSetAtom(userAtom);
  const setAddress = useSetAtom(addressAtom);
  const setAuthLoading = useSetAtom(authLoadingAtom);

  useEffect(() => {
    let alive = true;

    (async () => {
      const [cart, address, token] = await Promise.all([
        storageGet<CartLine[]>(CONFIG.STORAGE.CART),
        storageGet<ShippingAddress>(CONFIG.STORAGE.ADDRESS),
        storageGet<string>(CONFIG.STORAGE.TOKEN),
      ]);

      if (!alive) return;
      if (cart?.length) setCart(cart);
      if (address) setAddress(address);

      if (token) {
        setSessionToken(token);
        const me = await fetchMe();
        if (alive && me) setUser(me);
      }
      if (alive) setAuthLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [setCart, setUser, setAddress, setAuthLoading]);
}
