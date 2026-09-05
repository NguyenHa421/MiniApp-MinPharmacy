import { useEffect, useMemo, useState } from "react";
import { Box, Header, Input, Page, Text, useNavigate } from "zmp-ui";
import { fetchBrands } from "@/services/catalog";
import type { Brand } from "@/types";
import { ErrorView, Loading } from "@/components/state-views";

export default function BrandsPage() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setBrands(await fetchBrands());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return k ? brands.filter((b) => b.name.toLowerCase().includes(k)) : brands;
  }, [brands, keyword]);

  return (
    <Page className="page">
      <Header title="Thương hiệu" showBackIcon={false} />

      <Box className="px-4 py-3">
        <Input.Search
          value={keyword}
          placeholder="Tìm thương hiệu"
          onChange={(e) => setKeyword(e.target.value)}
        />
      </Box>

      {loading && <Loading />}
      {error && !loading && <ErrorView message={error} onRetry={load} />}

      {!loading && !error && (
        <Box className="px-4">
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((b) => (
              <Box
                key={b.id}
                className="mnp-card p-2 text-center"
                onClick={() => navigate(`/brand/${b.id}`)}
                role="button"
              >
                <Box
                  className="flex items-center justify-center"
                  style={{ height: 56 }}
                >
                  {b.logo ? (
                    <img
                      src={b.logo}
                      alt={b.name}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Text size="xSmall" className="mnp-clamp-2">
                      {b.name}
                    </Text>
                  )}
                </Box>
                {b.logo && (
                  <Text size="xxSmall" className="mnp-clamp-2 mt-1">
                    {b.name}
                  </Text>
                )}
              </Box>
            ))}
          </div>
        </Box>
      )}
    </Page>
  );
}
