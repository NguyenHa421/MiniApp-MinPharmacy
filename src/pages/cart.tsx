import { useAtomValue } from "jotai";
import { Box, Button, Header, Icon, Page, Text, useNavigate } from "zmp-ui";
import { cartSubtotalAtom, useCart, useUser } from "@/state";
import { formatPrice } from "@/utils/format";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Empty } from "@/components/state-views";
import { CONFIG } from "@/config";

export default function CartPage() {
  const navigate = useNavigate();
  const { lines, setQuantity, remove } = useCart();
  const subtotal = useAtomValue(cartSubtotalAtom);
  const user = useUser();

  if (lines.length === 0) {
    return (
      <Page className="page">
        <Header title="Giỏ hàng" showBackIcon={false} />
        <Empty
          title="Giỏ hàng đang trống"
          hint="Chọn sản phẩm từ trang chủ hoặc danh mục để bắt đầu."
          actionLabel="Xem sản phẩm"
          onAction={() => navigate("/")}
        />
      </Page>
    );
  }

  const remainForFreeShip = CONFIG.FREE_SHIP_THRESHOLD - subtotal;

  return (
    <Page className="page" style={{ paddingBottom: 100 }}>
      <Header title={`Giỏ hàng (${lines.length})`} showBackIcon={false} />

      {CONFIG.FREE_SHIP_THRESHOLD > 0 && remainForFreeShip > 0 && (
        <Box
          className="mx-4 mt-3 px-3 py-2 rounded-xl"
          style={{ background: "var(--mnp-primary-soft)" }}
        >
          <Text size="xSmall" style={{ color: "var(--mnp-primary-dark)" }}>
            Mua thêm {formatPrice(remainForFreeShip)} để được miễn phí vận chuyển
          </Text>
        </Box>
      )}

      <Box className="px-4 pt-3">
        {lines.map(({ product, quantity }) => (
          <Box key={product.id} className="mnp-card p-3 mb-3" flex style={{ gap: 12 }}>
            <img
              src={product.image || "/static/product-placeholder.png"}
              alt=""
              className="object-contain rounded-lg"
              style={{ width: 72, height: 72, flexShrink: 0 }}
              onClick={() => navigate(`/product/${product.id}`)}
            />
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="small" className="mnp-clamp-2 leading-snug">
                {product.name}
              </Text>
              <Text className="mnp-price mt-1">{formatPrice(product.price)}</Text>

              <Box flex justifyContent="space-between" alignItems="center" className="mt-2">
                <QuantityStepper
                  value={quantity}
                  max={product.available}
                  onChange={(n) => setQuantity(product.id, n)}
                />
                <Box
                  onClick={() => remove(product.id)}
                  role="button"
                  aria-label="Xoá khỏi giỏ hàng"
                  className="p-1"
                >
                  <Icon icon="zi-delete" style={{ color: "var(--mnp-muted)" }} />
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      <Box className="mnp-actionbar">
        <Box flex justifyContent="space-between" alignItems="center" className="mb-2">
          <Text size="small" style={{ color: "var(--mnp-muted)" }}>
            Tạm tính
          </Text>
          <Text.Title size="normal" className="mnp-price">
            {formatPrice(subtotal)}
          </Text.Title>
        </Box>
        <Text size="xxSmall" className="mb-2" style={{ color: "var(--mnp-muted)" }}>
          Phí vận chuyển tính ở bước tiếp theo, sau khi chọn địa chỉ nhận hàng.
        </Text>
        <Button
          fullWidth
          size="large"
          onClick={() =>
            navigate(user ? "/checkout" : "/login?redirect=/checkout")
          }
        >
          Tiến hành đặt hàng
        </Button>
      </Box>
    </Page>
  );
}
