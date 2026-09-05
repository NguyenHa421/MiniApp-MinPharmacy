import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Avatar, Box, Button, Header, List, Page, Text, useNavigate } from "zmp-ui";
import { authLoadingAtom, userAtom } from "@/state";
import { logout } from "@/services/auth";
import { fetchMyOrders } from "@/services/order";
import { formatPrice } from "@/utils/format";
import { Empty, Loading } from "@/components/state-views";

const STATUS_LABEL: Record<string, string> = {
  New: "Mới đặt",
  Confirming: "Đang xác nhận",
  Confirmed: "Đã xác nhận",
  Packing: "Đang đóng gói",
  Shipping: "Đang giao",
  Success: "Đã giao",
  Canceled: "Đã huỷ",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAtomValue(userAtom);
  const authLoading = useAtomValue(authLoadingAtom);
  const setUser = useSetAtom(userAtom);

  const [orders, setOrders] = useState<
    Array<{ id: string; total: number; status: string; createdAt: string }>
  >([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingOrders(true);
    fetchMyOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [user]);

  if (authLoading) {
    return (
      <Page className="page">
        <Header title="Tài khoản" showBackIcon={false} />
        <Loading />
      </Page>
    );
  }

  if (!user) {
    return (
      <Page className="page">
        <Header title="Tài khoản" showBackIcon={false} />
        <Empty
          title="Bạn chưa đăng nhập"
          hint="Đăng nhập để lưu địa chỉ và theo dõi đơn hàng."
          actionLabel="Đăng nhập"
          onAction={() => navigate("/login")}
        />
      </Page>
    );
  }

  return (
    <Page className="page">
      <Header title="Tài khoản" showBackIcon={false} />

      <Box className="bg-white p-4" flex alignItems="center" style={{ gap: 12 }}>
        <Avatar src={user.avatar} size={56} />
        <Box>
          <Text.Title size="normal">{user.name}</Text.Title>
          <Text size="xSmall" style={{ color: "var(--mnp-muted)" }}>
            {user.phone}
          </Text>
        </Box>
      </Box>

      <Box className="bg-white mt-2 p-4">
        <Text.Title size="small" className="mb-2">
          Đơn hàng của tôi
        </Text.Title>

        {loadingOrders && <Loading label="Đang tải đơn hàng" />}

        {!loadingOrders && orders.length === 0 && (
          <Text size="small" style={{ color: "var(--mnp-muted)" }}>
            Bạn chưa có đơn hàng nào.
          </Text>
        )}

        {!loadingOrders &&
          orders.map((o) => (
            <Box
              key={o.id}
              flex
              justifyContent="space-between"
              className="py-2.5"
              style={{ borderTop: "1px solid var(--mnp-line)" }}
            >
              <Box>
                <Text size="small">Đơn {o.id}</Text>
                <Text size="xxSmall" style={{ color: "var(--mnp-muted)" }}>
                  {o.createdAt}
                </Text>
              </Box>
              <Box className="text-right">
                <Text size="small" className="mnp-price">
                  {formatPrice(o.total)}
                </Text>
                <Text size="xxSmall" style={{ color: "var(--mnp-muted)" }}>
                  {STATUS_LABEL[o.status] || o.status}
                </Text>
              </Box>
            </Box>
          ))}
      </Box>

      <Box className="mt-2">
        <List>
          <List.Item title="Sổ địa chỉ" onClick={() => navigate("/checkout")} />
          <List.Item title="Liên hệ nhà thuốc" onClick={() => navigate("/")} />
        </List>
      </Box>

      <Box className="px-4 mt-4">
        <Button
          fullWidth
          variant="secondary"
          onClick={async () => {
            await logout();
            setUser(null);
            navigate("/", { replace: true });
          }}
        >
          Đăng xuất
        </Button>
      </Box>
    </Page>
  );
}
