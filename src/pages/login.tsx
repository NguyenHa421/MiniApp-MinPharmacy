import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetAtom } from "jotai";
import {
  Box,
  Button,
  Header,
  Input,
  Page,
  Text,
  useNavigate,
  useSnackbar,
} from "zmp-ui";
import { loginWithPassword, loginWithZalo } from "@/services/auth";
import { userAtom } from "@/state";
import { isValidPhone } from "@/utils/format";

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/profile";
  const { openSnackbar } = useSnackbar();
  const setUser = useSetAtom(userAtom);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState<"zalo" | "password" | null>(null);

  const done = (name: string) => {
    openSnackbar({ text: `Xin chào ${name}`, type: "success" });
    navigate(redirect, { replace: true });
  };

  const handleZalo = async () => {
    setLoading("zalo");
    try {
      const user = await loginWithZalo();
      setUser(user);
      done(user.name);
    } catch (e) {
      openSnackbar({
        text:
          (e as Error).message ||
          "Chưa lấy được số điện thoại từ Zalo. Cấp quyền rồi thử lại.",
        type: "error",
      });
    } finally {
      setLoading(null);
    }
  };

  const handlePassword = async () => {
    if (!isValidPhone(phone)) {
      openSnackbar({ text: "Số điện thoại chưa đúng định dạng.", type: "warning" });
      return;
    }
    if (password.length < 6) {
      openSnackbar({ text: "Mật khẩu tối thiểu 6 ký tự.", type: "warning" });
      return;
    }

    setLoading("password");
    try {
      const user = await loginWithPassword(phone, password);
      setUser(user);
      done(user.name);
    } catch (e) {
      openSnackbar({ text: (e as Error).message, type: "error" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Page className="page">
      <Header title="Đăng nhập" />

      <Box className="px-6 pt-10 text-center">
        <Text.Title size="large">Min Pharmacy</Text.Title>
        <Text size="small" className="mt-2" style={{ color: "var(--mnp-muted)", lineHeight: 1.6 }}>
          Đăng nhập để lưu địa chỉ giao hàng và theo dõi đơn thuốc của bạn.
        </Text>
      </Box>

      <Box className="px-6 pt-8">
        <Button
          fullWidth
          size="large"
          loading={loading === "zalo"}
          onClick={handleZalo}
        >
          Tiếp tục với Zalo
        </Button>
        <Text
          size="xxSmall"
          className="mt-2 text-center"
          style={{ color: "var(--mnp-muted)", lineHeight: 1.5 }}
        >
          Zalo chỉ chia sẻ tên, ảnh đại diện và số điện thoại của bạn cho nhà thuốc.
        </Text>

        {!showPasswordForm ? (
          <Text
            size="small"
            className="mt-6 text-center"
            style={{ color: "var(--mnp-primary)" }}
            onClick={() => setShowPasswordForm(true)}
          >
            Đăng nhập bằng số điện thoại và mật khẩu
          </Text>
        ) : (
          <Box className="mt-6">
            <Input
              label="Số điện thoại"
              type="text"
              {...({ inputMode: "tel" } as Record<string, string>)}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input.Password
              label="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-3"
            />
            <Button
              fullWidth
              size="large"
              variant="secondary"
              className="mt-4"
              loading={loading === "password"}
              onClick={handlePassword}
            >
              Đăng nhập
            </Button>
          </Box>
        )}

        <Box flex justifyContent="center" className="mt-8 gap-1">
          <Text size="small" style={{ color: "var(--mnp-muted)" }}>
            Chưa có tài khoản?
          </Text>
          <Text
            size="small"
            style={{ color: "var(--mnp-primary)" }}
            onClick={() => navigate(`/register?redirect=${encodeURIComponent(redirect)}`)}
          >
            Đăng ký
          </Text>
        </Box>
      </Box>
    </Page>
  );
}
