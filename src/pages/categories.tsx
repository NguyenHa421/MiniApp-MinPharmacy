import { useEffect, useState } from "react";
import { Box, Header, Page, Text, useNavigate } from "zmp-ui";
import { fetchCategories } from "@/services/catalog";
import type { Category } from "@/types";
import { ErrorView, Loading } from "@/components/state-views";

/**
 * Danh mục 2 cấp: cột trái là danh mục gốc, cột phải là danh mục con.
 * Cấu trúc này bám đúng dữ liệu `childs` lồng nhau của Nhanh.vn.
 */
export default function CategoriesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCategories();
      setCategories(data);
      setActiveId(data[0]?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const active = categories.find((c) => c.id === activeId);

  return (
    <Page className="page">
      <Header title="Danh mục" showBackIcon={false} />

      {loading && <Loading />}
      {error && !loading && <ErrorView message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="flex" style={{ minHeight: "calc(100vh - 140px)" }}>
          <div
            className="w-1/3 overflow-y-auto"
            style={{ borderRight: "1px solid var(--mnp-line)" }}
          >
            {categories.map((c) => {
              const on = c.id === activeId;
              return (
                <Box
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className="px-3 py-3.5"
                  style={{
                    background: on ? "#fff" : "transparent",
                    borderLeft: `3px solid ${on ? "var(--mnp-primary)" : "transparent"}`,
                  }}
                  role="button"
                >
                  <Text size="xSmall" style={{ fontWeight: on ? 600 : 400 }}>
                    {c.name}
                  </Text>
                </Box>
              );
            })}
          </div>

          <div className="w-2/3 p-3 bg-white">
            {active && (
              <>
                <Box
                  className="mb-3"
                  onClick={() => navigate(`/category/${active.id}`)}
                  role="button"
                >
                  <Text
                    size="small"
                    style={{ color: "var(--mnp-primary)", fontWeight: 600 }}
                  >
                    Xem tất cả {active.name}
                  </Text>
                </Box>

                <div className="grid grid-cols-3 gap-3">
                  {active.children.map((child) => (
                    <Box
                      key={child.id}
                      className="text-center"
                      onClick={() => navigate(`/category/${child.id}`)}
                      role="button"
                    >
                      <Box
                        className="mnp-card flex items-center justify-center"
                        style={{ aspectRatio: "1", padding: 6 }}
                      >
                        <img
                          src={child.image || "/static/category-placeholder.png"}
                          alt=""
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </Box>
                      <Text size="xxSmall" className="mnp-clamp-2 mt-1">
                        {child.name}
                      </Text>
                    </Box>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
