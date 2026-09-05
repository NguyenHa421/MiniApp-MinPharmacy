import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Header, Page } from "zmp-ui";
import { ProductListView } from "@/components/product-list-view";

export default function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useMemo(() => ({ brandId: Number(id) }), [id]);

  return (
    <Page className="page">
      <Header title="Thương hiệu" />
      <ProductListView
        query={query}
        emptyTitle="Thương hiệu này chưa có sản phẩm"
        emptyHint="Xem các thương hiệu khác trong danh sách."
      />
    </Page>
  );
}
