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
import { register } from "@/services/auth";
import { userAtom } from "@/state";
import { isValidPhone } from "@/utils/format";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/profile";
  const { openSnackbar } = useSnackbar();
  const setUser = useSetAtom(userAtom);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = (): string | null => {
    if (form.name.trim().length < 2) return "Nhập họ tên của bạn.";
    if (!isValidPhone(form.phone)) return "Số điện thoại chưa đúng định dạng.";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      return "Email chưa đúng định dạng.";
    if (form.password.length < 6) return "Mật khẩu tối thiểu 6 ký tự.";
    if (form.password !== form.confirm) return "Hai mật khẩu chưa khớp nhau.";
    return null;
  };

  const handleSubmit = async () => {
    const problem = validate();
    if (problem) {
      openSnackbar({ text: problem, type: "warning" });
      return;
    }

    setLoading(true);
    try {
      const user = await register({
        name: form.name.trim(),
        phone: form.phone,
        email: form.email || undefined,
        password: form.password,
      });
      setUser(user);
      openSnackbar({ text: "Tạo tài khoản thành công", type: "success" });
      navigate(redirect, { replace: true });
    } catch (e) {
      openSnackbar({ text: (e as Error).message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="page">
      <Header title="Đăng ký" />

      <Box className="px-6 pt-6">
        <Input label="Họ tên" value={form.name} onChange={set("name")} />
        <Input
          label="Số điện thoại"
          type="text"
          {...({ inputMode: "tel" } as Record<string, string>)}
          value={form.phone}
          onChange={set("phone")}
          className="mt-3"
        />
        <Input
          label="Email (không bắt buộc)"
          type="text"
          value={form.email}
          onChange={set("email")}
          className="mt-3"
        />
        <Input.Password
          label="Mật khẩu"
          value={form.password}
          onChange={set("password")}
          className="mt-3"
        />
        <Input.Password
          label="Nhập lại mật khẩu"
          value={form.confirm}
          onChange={set("confirm")}
          className="mt-3"
        />

        <Button fullWidth size="large" className="mt-6" loading={loading} onClick={handleSubmit}>
          Tạo tài khoản
        </Button>

        <Box flex justifyContent="center" className="mt-6 gap-1">
          <Text size="small" style={{ color: "var(--mnp-muted)" }}>
            Đã có tài khoản?
          </Text>
          <Text
            size="small"
            style={{ color: "var(--mnp-primary)" }}
            onClick={() => navigate(`/login?redirect=${encodeURIComponent(redirect)}`)}
          >
            Đăng nhập
          </Text>
        </Box>
      </Box>
    </Page>
  );
}
