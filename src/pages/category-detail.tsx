import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Header, Page } from "zmp-ui";
import { ProductListView } from "@/components/product-list-view";

/**
 * Sản phẩm theo danh mục.
 *
 * Không có thanh sắp xếp theo giá hay tên: Nhanh.vn v3.0 chỉ sắp xếp được
 * theo ID sản phẩm. Sắp xếp phía client chỉ áp dụng cho các sản phẩm đã tải
 * về, nên thứ tự sẽ sai ngay khi bấm "Xem thêm" — tệ hơn là không có.
 */
export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useMemo(() => ({ categoryId: Number(id) }), [id]);

  return (
    <Page className="page">
      <Header title="Sản phẩm" />
      <ProductListView
        query={query}
        emptyTitle="Danh mục này chưa có sản phẩm"
        emptyHint="Quay lại danh mục để xem nhóm hàng khác."
      />
    </Page>
  );
}
