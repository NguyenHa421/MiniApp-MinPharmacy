import { Box, Text } from "zmp-ui";
import { useNavigate } from "zmp-ui";
import type { Product } from "@/types";
import { discountPercent, formatPrice } from "@/utils/format";

export const ProductCard = ({ product }: { product: Product }) => {
  const navigate = useNavigate();
  const off = discountPercent(product.price, product.oldPrice);
  const soldOut = product.available <= 0;

  return (
    <Box
      className="mnp-card"
      onClick={() => navigate(`/product/${product.id}`)}
      role="button"
      tabIndex={0}
    >
      <Box className="relative">
        <img
          src={product.image || "/static/product-placeholder.png"}
          alt={product.name}
          loading="lazy"
          className="w-full aspect-square object-contain bg-white"
        />
        {off > 0 && (
          <span className="mnp-badge-sale absolute top-2 left-2">-{off}%</span>
        )}
        {soldOut && (
          <Box
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(255,255,255,.72)" }}
          >
            <Text size="xSmall" style={{ color: "var(--mnp-muted)" }}>
              Tạm hết hàng
            </Text>
          </Box>
        )}
      </Box>

      <Box className="p-2.5">
        <Text size="xSmall" style={{ color: "var(--mnp-muted)" }}>
          {product.brandName || "\u00A0"}
        </Text>
        <Text size="small" className="mnp-clamp-2 mt-0.5 leading-snug">
          {product.name}
        </Text>
        <Box flex alignItems="baseline" className="mt-1.5 gap-1.5">
          <Text className="mnp-price">{formatPrice(product.price)}</Text>
          {off > 0 && (
            <span className="mnp-price-old">{formatPrice(product.oldPrice)}</span>
          )}
        </Box>
        {product.unit && (
          <Text size="xxSmall" style={{ color: "var(--mnp-muted)" }}>
            / {product.unit}
          </Text>
        )}
      </Box>
    </Box>
  );
};

export const ProductGrid = ({ products }: { products: Product[] }) => (
  <div className="grid grid-cols-2 gap-3">
    {products.map((p) => (
      <ProductCard key={p.id} product={p} />
    ))}
  </div>
);
