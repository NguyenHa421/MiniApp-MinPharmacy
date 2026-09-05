import { useEffect, useState } from "react";
import { Box, Header, Page, Text, useNavigate } from "zmp-ui";
import { fetchBrands, fetchCategories, fetchProducts } from "@/services/catalog";
import type { Brand, Category, Product } from "@/types";
import { ProductGrid } from "@/components/product-card";
import { SearchEntry } from "@/components/search-bar";
import { ErrorView, Loading } from "@/components/state-views";

/** Tiêu đề khối: nhãn trái, lối tắt phải. */
const SectionHead = ({
  title,
  onMore,
}: {
  title: string;
  onMore?: () => void;
}) => (
  <Box flex justifyContent="space-between" alignItems="center" className="mb-2.5">
    <Text.Title size="small">{title}</Text.Title>
    {onMore && (
      <Text
        size="xSmall"
        onClick={onMore}
        style={{ color: "var(--mnp-primary)" }}
      >
        Xem tất cả
      </Text>
    )}
  </Box>
);

export default function HomePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [fresh, setFresh] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, brs, featuredRes, newRes] = await Promise.all([
        fetchCategories(),
        fetchBrands(),
        fetchProducts({ highlight: "featured", limit: 8 }),
        fetchProducts({ highlight: "new", limit: 8 }),
      ]);
      setCategories(cats);
      setBrands(brs.slice(0, 8));
      setFeatured(featuredRes.products);
      setFresh(newRes.products);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Page className="page">
      <Header title="Min Pharmacy" showBackIcon={false} />

      <Box className="px-4 pt-3">
        <SearchEntry />
      </Box>

      {loading && <Loading label="Đang tải trang chủ" />}
      {error && !loading && <ErrorView message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {/* Danh mục — lưới biểu tượng, đưa khách đi tiếp trong 1 chạm */}
          <Box className="px-4 pt-5">
            <SectionHead
              title="Danh mục"
              onMore={() => navigate("/categories")}
            />
            <div className="grid grid-cols-4 gap-3">
              {categories.slice(0, 8).map((c) => (
                <Box
                  key={c.id}
                  className="text-center"
                  onClick={() => navigate(`/category/${c.id}`)}
                  role="button"
                >
                  <Box
                    className="mnp-card flex items-center justify-center"
                    style={{ aspectRatio: "1", padding: 8 }}
                  >
                    <img
                      src={c.image || "/static/category-placeholder.png"}
                      alt=""
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </Box>
                  <Text size="xxSmall" className="mnp-clamp-2 mt-1">
                    {c.name}
                  </Text>
                </Box>
              ))}
            </div>
          </Box>

          {/* Thương hiệu — cuộn ngang, tên thay logo khi chưa map ảnh */}
          <Box className="pt-6">
            <Box className="px-4">
              <SectionHead
                title="Thương hiệu"
                onMore={() => navigate("/brands")}
              />
            </Box>
            <div className="flex gap-3 overflow-x-auto px-4 pb-1">
              {brands.map((b) => (
                <Box
                  key={b.id}
                  className="mnp-card flex-shrink-0 flex items-center justify-center px-4"
                  style={{ width: 104, height: 64 }}
                  onClick={() => navigate(`/brand/${b.id}`)}
                  role="button"
                >
                  {b.logo ? (
                    <img
                      src={b.logo}
                      alt={b.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Text size="xSmall" className="text-center mnp-clamp-2">
                      {b.name}
                    </Text>
                  )}
                </Box>
              ))}
            </div>
          </Box>

          {featured.length > 0 && (
            <Box className="px-4 pt-6">
              <SectionHead
                title="Nổi bật"
                onMore={() => navigate("/search?highlight=featured")}
              />
              <ProductGrid products={featured} />
            </Box>
          )}

          {fresh.length > 0 && (
            <Box className="px-4 pt-6">
              <SectionHead
                title="Hàng mới về"
                onMore={() => navigate("/search?highlight=new")}
              />
              <ProductGrid products={fresh} />
            </Box>
          )}
        </>
      )}
    </Page>
  );
}
