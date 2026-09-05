import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import {
  Box,
  Button,
  Header,
  Page,
  Text,
  useNavigate,
  useSnackbar,
} from "zmp-ui";
import { fetchProduct } from "@/services/catalog";
import { cartCountAtom, useCart } from "@/state";
import type { Product } from "@/types";
import { discountPercent, formatPrice } from "@/utils/format";
import { QuantityStepper } from "@/components/quantity-stepper";
import { ErrorView, Loading } from "@/components/state-views";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const { add } = useCart();
  const cartCount = useAtomValue(cartCountAtom);

  const [product, setProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchProduct(id!);
      setProduct(p);
      setActiveImage(0);
      setQuantity(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAdd = (buyNow: boolean) => {
    if (!product) return;
    add(product, quantity);
    if (buyNow) {
      navigate("/cart");
    } else {
      openSnackbar({ text: "Đã thêm vào giỏ hàng", type: "success" });
    }
  };

  if (loading) return <Page className="page"><Header title="Sản phẩm" /><Loading /></Page>;
  if (error || !product)
    return (
      <Page className="page">
        <Header title="Sản phẩm" />
        <ErrorView message={error || "Không tìm thấy sản phẩm."} onRetry={load} />
      </Page>
    );

  const gallery = product.images?.length ? product.images : [product.image];
  const off = discountPercent(product.price, product.oldPrice);
  const soldOut = product.available <= 0;

  return (
    <Page className="page" style={{ paddingBottom: 96 }}>
      <Header title={product.name} />

      {/* Ảnh sản phẩm */}
      <Box className="bg-white">
        <img
          src={gallery[activeImage] || "/static/product-placeholder.png"}
          alt={product.name}
          className="w-full aspect-square object-contain"
        />
        {gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3">
            {gallery.map((src, i) => (
              <img
                key={src + i}
                src={src}
                alt=""
                onClick={() => setActiveImage(i)}
                className="flex-shrink-0 object-contain rounded-lg"
                style={{
                  width: 56,
                  height: 56,
                  border: `1px solid ${i === activeImage ? "var(--mnp-primary)" : "var(--mnp-line)"}`,
                }}
              />
            ))}
          </div>
        )}
      </Box>

      {/* Giá + tên */}
      <Box className="bg-white mt-2 p-4">
        <Box flex alignItems="baseline" className="gap-2">
          <Text.Title size="large" className="mnp-price">
            {formatPrice(product.price)}
          </Text.Title>
          {off > 0 && (
            <>
              <span className="mnp-price-old">{formatPrice(product.oldPrice)}</span>
              <span className="mnp-badge-sale">-{off}%</span>
            </>
          )}
        </Box>

        <Text.Title size="normal" className="mt-2">
          {product.name}
        </Text.Title>

        <Box flex className="gap-4 mt-2">
          {product.unit && (
            <Text size="xSmall" style={{ color: "var(--mnp-muted)" }}>
              Đơn vị: {product.unit}
            </Text>
          )}
          <Text
            size="xSmall"
            style={{ color: soldOut ? "var(--mnp-accent)" : "var(--mnp-primary)" }}
          >
            {soldOut ? "Tạm hết hàng" : `Còn ${product.available} sản phẩm`}
          </Text>
        </Box>
      </Box>

      {/* Thông tin từ Nhanh.vn */}
      <Box className="bg-white mt-2 p-4">
        <Text.Title size="small" className="mb-2">
          Thông tin sản phẩm
        </Text.Title>
        {[
          ["Mã sản phẩm", product.code],
          ["Thương hiệu", product.brandName],
          ["Xuất xứ", product.countryName],
          ["Bảo hành", product.warrantyMonth ? `${product.warrantyMonth} tháng` : ""],
        ]
          .filter(([, v]) => Boolean(v))
          .map(([label, value]) => (
            <Box key={label} flex justifyContent="space-between" className="py-1.5">
              <Text size="xSmall" style={{ color: "var(--mnp-muted)" }}>
                {label}
              </Text>
              <Text size="xSmall">{value}</Text>
            </Box>
          ))}
      </Box>

      {product.attributes.length > 0 && (
        <Box className="bg-white mt-2 p-4">
          <Text.Title size="small" className="mb-2">
            Thuộc tính
          </Text.Title>
          {product.attributes.map((attr) => (
            <Box
              key={`${attr.name}-${attr.value}`}
              flex
              justifyContent="space-between"
              className="py-1.5"
            >
              <Text size="xSmall" style={{ color: "var(--mnp-muted)" }}>
                {attr.name}
              </Text>
              <Text size="xSmall">{attr.value}</Text>
            </Box>
          ))}
        </Box>
      )}

      <Box className="p-4">
        <Text size="xxSmall" style={{ color: "var(--mnp-muted)", lineHeight: 1.5 }}>
          Thông tin sản phẩm chỉ mang tính tham khảo, không thay thế cho tư vấn
          của dược sĩ hoặc bác sĩ. Đọc kỹ hướng dẫn trước khi dùng.
        </Text>
      </Box>

      {/* Thanh mua hàng */}
      <Box className="mnp-actionbar" flex alignItems="center" style={{ gap: 12 }}>
        <QuantityStepper
          value={quantity}
          max={product.available}
          onChange={setQuantity}
        />
        <Button
          variant="secondary"
          size="medium"
          disabled={soldOut}
          onClick={() => handleAdd(false)}
          style={{ flex: 1 }}
        >
          Thêm vào giỏ{cartCount > 0 ? ` (${cartCount})` : ""}
        </Button>
        <Button
          size="medium"
          disabled={soldOut}
          onClick={() => handleAdd(true)}
          style={{ flex: 1 }}
        >
          Mua ngay
        </Button>
      </Box>
    </Page>
  );
}
