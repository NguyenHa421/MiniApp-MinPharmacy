import { Box, Icon, Input } from "zmp-ui";
import { useNavigate } from "zmp-ui";

/** Ô tìm kiếm ở trang chủ — bấm vào là sang trang tìm kiếm, không gõ tại chỗ. */
export const SearchEntry = () => {
  const navigate = useNavigate();
  return (
    <Box
      className="mnp-card flex items-center gap-2 px-3 py-2.5"
      onClick={() => navigate("/search")}
      role="button"
    >
      <Icon icon="zi-search" style={{ color: "var(--mnp-muted)" }} />
      <span style={{ color: "var(--mnp-muted)", fontSize: 14 }}>
        Tìm thuốc, thực phẩm chức năng, thương hiệu…
      </span>
    </Box>
  );
};

export const SearchField = ({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) => (
  <Input.Search
    value={value}
    autoFocus
    placeholder="Nhập tên thuốc hoặc mã sản phẩm"
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") onSubmit();
    }}
  />
);
