import { Box, Button, Text } from "zmp-ui";
import { ProductGrid } from "./product-card";
import { Empty, ErrorView, Loading } from "./state-views";
import { useProductList } from "@/hooks/use-product-list";
import type { ProductQuery } from "@/services/catalog";

/**
 * Khối danh sách sản phẩm dùng chung cho trang danh mục, thương hiệu và
 * tìm kiếm — cùng một truy vấn, chỉ khác tham số lọc.
 */
export const ProductListView = ({
  query,
  emptyTitle = "Chưa có sản phẩm nào ở đây",
  emptyHint = "Thử đổi bộ lọc hoặc xem danh mục khác.",
}: {
  query: ProductQuery;
  emptyTitle?: string;
  emptyHint?: string;
}) => {
  const { products, loading, loadingMore, error, hasMore, loadMore, reload } =
    useProductList(query);

  if (loading) return <Loading label="Đang tải sản phẩm" />;
  if (error) return <ErrorView message={error} onRetry={reload} />;
  if (products.length === 0)
    return <Empty title={emptyTitle} hint={emptyHint} />;

  return (
    <Box className="px-4 pt-3">
      <ProductGrid products={products} />

      {hasMore && (
        <Box className="py-5 text-center">
          <Button
            variant="secondary"
            size="medium"
            loading={loadingMore}
            onClick={loadMore}
          >
            Xem thêm
          </Button>
        </Box>
      )}

      {!hasMore && (
        <Text
          size="xxSmall"
          className="py-5 text-center"
          style={{ color: "var(--mnp-muted)" }}
        >
          Đã hiển thị toàn bộ {products.length} sản phẩm
        </Text>
      )}
    </Box>
  );
};
