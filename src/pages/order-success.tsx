import { useSearchParams } from "react-router-dom";
import { Box, Button, Header, Icon, Page, Text, useNavigate } from "zmp-ui";

export default function OrderSuccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get("id");

  return (
    <Page className="page">
      <Header title="Đặt hàng thành công" showBackIcon={false} />

      <Box className="px-6 py-12 text-center">
        <Icon icon="zi-check-circle" size={56} style={{ color: "var(--mnp-primary)" }} />
        <Text.Title size="large" className="mt-4">
          Nhà thuốc đã nhận đơn của bạn
        </Text.Title>
        {orderId && (
          <Text className="mt-1" style={{ color: "var(--mnp-muted)" }}>
            Mã đơn: {orderId}
          </Text>
        )}
        <Text size="small" className="mt-3" style={{ color: "var(--mnp-muted)", lineHeight: 1.6 }}>
          Dược sĩ sẽ gọi xác nhận trong giờ làm việc. Bạn theo dõi trạng thái đơn
          trong mục Tài khoản.
        </Text>

        <Button fullWidth size="large" className="mt-6" onClick={() => navigate("/profile")}>
          Xem đơn hàng của tôi
        </Button>
        <Button
          fullWidth
          size="large"
          variant="secondary"
          className="mt-3"
          onClick={() => navigate("/", { replace: true })}
        >
          Tiếp tục mua sắm
        </Button>
      </Box>
    </Page>
  );
}
