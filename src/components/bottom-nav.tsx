import { useAtomValue } from "jotai";
import { BottomNavigation, Icon } from "zmp-ui";
import { useLocation, useNavigate } from "zmp-ui";
import { cartCountAtom } from "@/state";

/** Các nhánh có thanh điều hướng. Trang con (chi tiết, thanh toán) thì ẩn. */
const TABS = [
  { key: "/", label: "Trang chủ", icon: "zi-home" },
  { key: "/categories", label: "Danh mục", icon: "zi-list-1" },
  { key: "/brands", label: "Thương hiệu", icon: "zi-star" },
  { key: "/cart", label: "Giỏ hàng", icon: "zi-cart" },
  { key: "/profile", label: "Tài khoản", icon: "zi-user" },
];

const HIDE_ON = [
  "/product/",
  "/checkout",
  "/order-success",
  "/login",
  "/register",
  "/category/",
  "/brand/",
];

export const AppBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const cartCount = useAtomValue(cartCountAtom);

  if (HIDE_ON.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <BottomNavigation
      fixed
      activeKey={location.pathname}
      onChange={(key) => navigate(key, { animate: false })}
    >
      {TABS.map((tab) => (
        <BottomNavigation.Item
          key={tab.key}
          label={tab.label}
          icon={<Icon icon={tab.icon as never} />}
          activeIcon={<Icon icon={tab.icon as never} />}
          {...(tab.key === "/cart" && cartCount > 0
            ? { badge: cartCount > 99 ? "99+" : String(cartCount) }
            : {})}
        />
      ))}
    </BottomNavigation>
  );
};
