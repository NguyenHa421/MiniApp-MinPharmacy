import { getSystemInfo } from "zmp-sdk";
import {
  AnimationRoutes,
  App,
  Route,
  SnackbarProvider,
  ZMPRouter,
} from "zmp-ui";
import { AppProps } from "zmp-ui/app";

import { AppBottomNav } from "./bottom-nav";
import { useBootstrap } from "@/state";

import HomePage from "@/pages/index";
import CategoriesPage from "@/pages/categories";
import CategoryDetailPage from "@/pages/category-detail";
import BrandsPage from "@/pages/brands";
import BrandDetailPage from "@/pages/brand-detail";
import SearchPage from "@/pages/search";
import ProductDetailPage from "@/pages/product-detail";
import CartPage from "@/pages/cart";
import CheckoutPage from "@/pages/checkout";
import OrderSuccessPage from "@/pages/order-success";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ProfilePage from "@/pages/profile";

/** Nạp giỏ hàng + phiên đăng nhập trước khi render nhánh route. */
const Bootstrap = ({ children }: { children: React.ReactNode }) => {
  useBootstrap();
  return <>{children}</>;
};

const Layout = () => (
  <App theme={getSystemInfo().zaloTheme as AppProps["theme"]}>
    <SnackbarProvider>
      <ZMPRouter>
        <Bootstrap>
          <AnimationRoutes>
            <Route path="/" element={<HomePage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/category/:id" element={<CategoryDetailPage />} />
            <Route path="/brands" element={<BrandsPage />} />
            <Route path="/brand/:id" element={<BrandDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </AnimationRoutes>
          <AppBottomNav />
        </Bootstrap>
      </ZMPRouter>
    </SnackbarProvider>
  </App>
);

export default Layout;
