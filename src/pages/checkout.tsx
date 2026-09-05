import { useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  Box,
  Button,
  Header,
  Input,
  Page,
  Radio,
  Select,
  Text,
  useNavigate,
  useSnackbar,
} from "zmp-ui";
import { openWebview } from "zmp-sdk/apis";
import { CONFIG, type PaymentMethod } from "@/config";
import { addressAtom, cartSubtotalAtom, useCart, useUser } from "@/state";
import { storageSet } from "@/services/storage";
import {
  createOrder,
  fetchCities,
  fetchDistricts,
  fetchShippingFee,
  fetchWards,
} from "@/services/order";
import type { Location, ShippingService } from "@/types";
import { formatPrice, isValidPhone, normalizePhone } from "@/utils/format";
import { Loading } from "@/components/state-views";

const PAYMENTS: Array<{ value: PaymentMethod; label: string; hint: string }> = [
  {
    value: "COD",
    label: "Thanh toán khi nhận hàng",
    hint: "Trả tiền mặt cho nhân viên giao hàng.",
  },
  {
    value: "BANK_TRANSFER",
    label: "Chuyển khoản ngân hàng",
    hint: "Nhà thuốc gửi thông tin tài khoản sau khi bạn đặt hàng.",
  },
  {
    value: "ZALOPAY",
    label: "Thanh toán online",
    hint: "Đơn chuyển sang nhà thuốc ngay khi thanh toán thành công.",
  },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const { lines, clear } = useCart();
  const subtotal = useAtomValue(cartSubtotalAtom);
  const user = useUser();
  const [savedAddress, setSavedAddress] = useAtom(addressAtom);

  /* ---- Người nhận ---- */
  const [name, setName] = useState(savedAddress?.name || user?.name || "");
  const [phone, setPhone] = useState(savedAddress?.phone || user?.phone || "");
  const [street, setStreet] = useState(savedAddress?.address || "");
  const [note, setNote] = useState("");

  /* ---- Địa giới hành chính. v3 làm việc bằng ID. ---- */
  const [cities, setCities] = useState<Location[]>([]);
  const [districts, setDistricts] = useState<Location[]>([]);
  const [wards, setWards] = useState<Location[]>([]);
  const [cityId, setCityId] = useState<number | null>(savedAddress?.cityId ?? null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [wardId, setWardId] = useState<number | null>(null);

  /* ---- Vận chuyển & thanh toán ---- */
  const [services, setServices] = useState<ShippingService[]>([]);
  const [serviceKey, setServiceKey] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("COD");
  const [submitting, setSubmitting] = useState(false);

  const nameOf = (list: Location[], id: number | null) =>
    list.find((l) => l.id === id)?.name ?? "";

  const selectedService = useMemo(
    () => services.find((s) => `${s.carrierId}-${s.serviceId}` === serviceKey),
    [services, serviceKey],
  );

  /* Miễn phí ship khi đạt ngưỡng: nhà thuốc vẫn trả hãng vận chuyển, nhưng
     customerShipFee báo khách bằng 0. */
  const freeShip =
    CONFIG.FREE_SHIP_THRESHOLD > 0 && subtotal >= CONFIG.FREE_SHIP_THRESHOLD;
  const shipFee = freeShip ? 0 : (selectedService?.totalFee ?? 0);
  const total = subtotal + shipFee;

  useEffect(() => {
    fetchCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    setDistrictId(null);
    setWardId(null);
    setDistricts([]);
    setWards([]);
    if (cityId) fetchDistricts(cityId).then(setDistricts).catch(() => {});
  }, [cityId]);

  useEffect(() => {
    setWardId(null);
    setWards([]);
    if (districtId) fetchWards(districtId).then(setWards).catch(() => {});
  }, [districtId]);

  /* Tính lại phí ship khi đổi địa chỉ hoặc đổi hình thức thanh toán — số tiền
     thu hộ thay đổi thì phí thu hộ cũng thay đổi. */
  useEffect(() => {
    if (!cityId || !districtId || lines.length === 0) {
      setServices([]);
      setServiceKey("");
      return;
    }

    let alive = true;
    setCalculating(true);

    fetchShippingFee({
      cityId,
      districtId,
      wardId: wardId ?? undefined,
      address: street,
      subtotal,
      codMoney: payment === "COD" ? total : 0,
      items: lines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
      })),
    })
      .then((list) => {
        if (!alive) return;
        setServices(list);
        setServiceKey(
          list[0] ? `${list[0].carrierId}-${list[0].serviceId}` : "",
        );
      })
      .catch(() => {
        if (alive) {
          setServices([]);
          setServiceKey("");
        }
      })
      .finally(() => {
        if (alive) setCalculating(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, districtId, wardId, payment, subtotal]);

  const validate = (): string | null => {
    if (!name.trim()) return "Nhập tên người nhận hàng.";
    if (!isValidPhone(phone)) return "Số điện thoại chưa đúng định dạng.";
    if (!cityId) return "Chọn tỉnh/thành phố.";
    if (!districtId) return "Chọn quận/huyện.";
    if (!street.trim()) return "Nhập số nhà, tên đường.";
    if (!selectedService) return "Chọn một hình thức vận chuyển.";
    return null;
  };

  const handleSubmit = async () => {
    const problem = validate();
    if (problem) {
      openSnackbar({ text: problem, type: "warning" });
      return;
    }

    const service = selectedService!;

    setSubmitting(true);
    try {
      const address = {
        name: name.trim(),
        phone: normalizePhone(phone),
        address: street.trim(),
        cityId: cityId!,
        districtId: districtId!,
        wardId: wardId ?? 0,
        cityName: nameOf(cities, cityId),
        districtName: nameOf(districts, districtId),
        wardName: nameOf(wards, wardId),
      };

      const result = await createOrder({
        address,
        items: lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
        })),
        paymentMethod: payment,
        carrierId: service.carrierId,
        carrierServiceId: service.serviceId,
        carrierServiceCode: service.serviceCode,
        carrierAccountId: service.accountId,
        carrierShopId: service.shopId,
        customerShipFee: shipFee,
        note,
      });

      setSavedAddress(address);
      await storageSet(CONFIG.STORAGE.ADDRESS, address);

      // Thanh toán online: đơn chỉ được đẩy sang Nhanh.vn sau khi cổng thanh
      // toán gọi webhook xác nhận.
      if (result.paymentUrl) {
        await openWebview({
          url: result.paymentUrl,
          config: { style: "normal" },
        });
      }

      clear();
      navigate(`/order-success?id=${encodeURIComponent(result.id)}`, {
        replace: true,
      });
    } catch (e) {
      openSnackbar({ text: (e as Error).message, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (lines.length === 0) {
    navigate("/cart", { replace: true });
    return null;
  }

  return (
    <Page className="page" style={{ paddingBottom: 130 }}>
      <Header title="Thanh toán" />

      <Box className="bg-white mt-2 p-4">
        <Text.Title size="small" className="mb-3">
          Người nhận hàng
        </Text.Title>
        <Input
          label="Họ tên"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Số điện thoại"
          type="text"
          {...({ inputMode: "tel" } as Record<string, string>)}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-3"
        />
      </Box>

      <Box className="bg-white mt-2 p-4">
        <Text.Title size="small" className="mb-3">
          Địa chỉ giao hàng
        </Text.Title>

        <Select
          label="Tỉnh/Thành phố"
          placeholder="Chọn tỉnh/thành phố"
          value={cityId ?? undefined}
          onChange={(v) => setCityId(Number(v))}
          closeOnSelect
        >
          {cities.map((c) => (
            <Select.Option key={c.id} value={c.id} title={c.name} />
          ))}
        </Select>

        <Select
          label="Quận/Huyện"
          placeholder={cityId ? "Chọn quận/huyện" : "Chọn tỉnh/thành phố trước"}
          value={districtId ?? undefined}
          onChange={(v) => setDistrictId(Number(v))}
          disabled={!cityId}
          closeOnSelect
          className="mt-3"
        >
          {districts.map((d) => (
            <Select.Option key={d.id} value={d.id} title={d.name} />
          ))}
        </Select>

        <Select
          label="Phường/Xã"
          placeholder={districtId ? "Chọn phường/xã" : "Chọn quận/huyện trước"}
          value={wardId ?? undefined}
          onChange={(v) => setWardId(Number(v))}
          disabled={!districtId}
          closeOnSelect
          className="mt-3"
        >
          {wards.map((w) => (
            <Select.Option key={w.id} value={w.id} title={w.name} />
          ))}
        </Select>

        <Input
          label="Số nhà, tên đường"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className="mt-3"
        />
        <Input.TextArea
          label="Ghi chú cho nhà thuốc"
          placeholder="Giờ nhận hàng, hướng dẫn tìm địa chỉ…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-3"
        />
      </Box>

      <Box className="bg-white mt-2 p-4">
        <Text.Title size="small" className="mb-3">
          Hình thức vận chuyển
        </Text.Title>

        {calculating && <Loading label="Đang tính phí vận chuyển" />}

        {!calculating && services.length === 0 && (
          <Text size="xSmall" style={{ color: "var(--mnp-muted)" }}>
            {cityId && districtId
              ? "Chưa có hãng vận chuyển nào phục vụ địa chỉ này. Gọi nhà thuốc để được hỗ trợ."
              : "Chọn tỉnh/thành và quận/huyện để xem phí vận chuyển."}
          </Text>
        )}

        {!calculating &&
          services.map((s) => {
            const key = `${s.carrierId}-${s.serviceId}`;
            return (
              <Box
                key={key}
                flex
                alignItems="center"
                className="py-2"
                onClick={() => setServiceKey(key)}
                role="button"
              >
                <Radio
                  value={key}
                  checked={serviceKey === key}
                  onChange={() => setServiceKey(key)}
                />
                <Box style={{ flex: 1, marginLeft: 8 }}>
                  <Text size="small">
                    {s.carrierName} · {s.serviceName}
                  </Text>
                  {s.description && (
                    <Text size="xxSmall" style={{ color: "var(--mnp-muted)" }}>
                      {s.description}
                    </Text>
                  )}
                </Box>
                <Text size="small" className="mnp-price">
                  {freeShip ? "Miễn phí" : formatPrice(s.totalFee)}
                </Text>
              </Box>
            );
          })}
      </Box>

      <Box className="bg-white mt-2 p-4">
        <Text.Title size="small" className="mb-3">
          Hình thức thanh toán
        </Text.Title>
        {PAYMENTS.map((p) => (
          <Box
            key={p.value}
            flex
            alignItems="flex-start"
            className="py-2"
            onClick={() => setPayment(p.value)}
            role="button"
          >
            <Radio
              value={p.value}
              checked={payment === p.value}
              onChange={() => setPayment(p.value)}
            />
            <Box style={{ marginLeft: 8 }}>
              <Text size="small">{p.label}</Text>
              <Text size="xxSmall" style={{ color: "var(--mnp-muted)" }}>
                {p.hint}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box className="bg-white mt-2 p-4">
        <Box flex justifyContent="space-between" className="py-1">
          <Text size="small" style={{ color: "var(--mnp-muted)" }}>
            Tiền hàng ({lines.length} sản phẩm)
          </Text>
          <Text size="small">{formatPrice(subtotal)}</Text>
        </Box>
        <Box flex justifyContent="space-between" className="py-1">
          <Text size="small" style={{ color: "var(--mnp-muted)" }}>
            Phí vận chuyển
          </Text>
          <Text size="small">
            {shipFee === 0 ? "Miễn phí" : formatPrice(shipFee)}
          </Text>
        </Box>
      </Box>

      <Box className="mnp-actionbar">
        <Box
          flex
          justifyContent="space-between"
          alignItems="center"
          className="mb-2"
        >
          <Text size="small" style={{ color: "var(--mnp-muted)" }}>
            Tổng thanh toán
          </Text>
          <Text.Title size="normal" className="mnp-price">
            {formatPrice(total)}
          </Text.Title>
        </Box>
        <Button
          fullWidth
          size="large"
          loading={submitting}
          onClick={handleSubmit}
        >
          {payment === "COD" ? "Đặt hàng" : "Thanh toán"}
        </Button>
      </Box>
    </Page>
  );
}
