import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Header, Page } from "zmp-ui";
import { SearchField } from "@/components/search-bar";
import { ProductListView } from "@/components/product-list-view";
import { Empty } from "@/components/state-views";
import type { ProductQuery } from "@/services/catalog";

export default function SearchPage() {
  const [params] = useSearchParams();
  const highlight = params.get("highlight") as ProductQuery["highlight"] | null;

  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");

  const query = useMemo<ProductQuery>(
    () => ({
      keyword: keyword || undefined,
      highlight: highlight || undefined,
    }),
    [keyword, highlight],
  );

  const title =
    highlight === "featured"
      ? "Nổi bật"
      : highlight === "new"
        ? "Hàng mới về"
        : "Tìm kiếm";

  return (
    <Page className="page">
      <Header title={title} />

      {!highlight && (
        <Box className="px-4 py-3">
          <SearchField
            value={draft}
            onChange={setDraft}
            onSubmit={() => setKeyword(draft.trim())}
          />
        </Box>
      )}

      {!highlight && !keyword ? (
        <Empty
          title="Bạn cần tìm thuốc gì?"
          hint="Gõ tên thuốc, hoạt chất, mã sản phẩm hoặc mã vạch rồi nhấn Enter."
        />
      ) : (
        <ProductListView
          query={query}
          emptyTitle={keyword ? `Không tìm thấy "${keyword}"` : "Chưa có sản phẩm"}
          emptyHint="Thử từ khoá ngắn hơn hoặc kiểm tra chính tả."
        />
      )}
    </Page>
  );
}
