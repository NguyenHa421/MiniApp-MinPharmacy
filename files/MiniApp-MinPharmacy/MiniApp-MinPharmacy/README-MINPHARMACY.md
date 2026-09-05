# Min Pharmacy — Zalo Mini App + Nhanh.vn v3.0

Mini App nhà thuốc: trang chủ, danh mục, thương hiệu, sản phẩm, chi tiết sản
phẩm, giỏ hàng, thanh toán, đăng nhập, đăng ký. Catalog và đơn hàng đồng bộ
với Nhanh.vn Open API **v3.0**.

Xem `HUONG-DAN-CAI-DAT.md` để biết chép file vào đâu.

## Thay đổi so với bản gốc

`src/pages/index.tsx` cũ chỉ gọi `openWebview("https://minpharmacy.com.vn/app")`
— một cái vỏ mở website trong WebView, không phải Mini App. Cách đó không dùng
được `getPhoneNumber()`, `getUserInfo()` hay điều hướng gốc, và chậm vì tải lại
cả website mỗi lần mở. Bản này render giao diện gốc bằng `zmp-ui`.

## Kiến trúc

```
Zalo Mini App (React + zmp-ui)
        │  HTTPS · JSON · Authorization: Bearer <login_token>
        ▼
BFF trên minpharmacy.com.vn   (plugin max-zalo-login, namespace mnp/v1)
        │  POST JSON · Authorization: <accessToken>
        ▼
Nhanh.vn Open API v3.0   (pos.open.nhanh.vn/v3.0)
```

**Mini App không gọi thẳng Nhanh.vn.** Ba lý do:

1. `accessToken` là bí mật cấp doanh nghiệp. Nhúng vào bundle Mini App là công
   khai nó — bundle JS ai cũng tải và đọc được, và người đó sẽ đọc được toàn bộ
   kho hàng, danh sách khách và đơn hàng của nhà thuốc.
2. Open API không trả CORS header cho origin WebView của Zalo.
3. Rate limit 150 request/30 giây tính theo appId + businessId. Cache phải nằm
   ở server; nếu để mỗi máy khách tự gọi, Nhanh.vn sẽ khoá app.

BFF cũng giữ nguồn sự thật của đơn hàng: đơn lưu vào WordPress trước, đẩy sang
Nhanh.vn sau. Nhanh.vn lỗi thì cron thử lại, khách không mất đơn.

## Những chỗ v3.0 khác v2.0

Nếu bạn đọc tài liệu v2 sẽ thấy code không khớp — đây là lý do:

| | v2.0 | v3.0 (đang dùng) |
|---|---|---|
| URL | `/api/{module}/{fn}` | `/v3.0/{module}/{fn}?appId=&businessId=` |
| Xác thực | param `accessToken` trong form-data | header `Authorization: <token>`, **không có** tiền tố `Bearer` |
| Body | form-data, `data` là JSON string | JSON raw `{filters, paginator}` |
| Phân trang | `page` / `totalPages` | cursor `paginator.next` |
| Danh mục | lồng sẵn qua `childs` | phẳng, tự dựng cây từ `parentId` |
| Thương hiệu | **không có API** | có `/product/brand` |
| Địa chỉ | truyền **tên** tỉnh/huyện | truyền **ID** |
| Phí ship | truyền `productIds`, Nhanh tự cộng cân | bắt buộc tự tính `shippingWeight` |
| Tạo đơn | mảng phẳng | lồng: `info`/`channel`/`shippingAddress`/`carrier`/`products`/`payment` |
| Trạng thái đơn | chuỗi `"New"` | số `54` |

Ba hệ quả trực tiếp lên giao diện:

- **Không có thanh sắp xếp theo giá/tên.** v3 chỉ sắp xếp được theo ID sản
  phẩm. Sắp xếp phía client chỉ đúng với phần đã tải, sẽ sai ngay khi bấm
  "Xem thêm" — nên bỏ hẳn thay vì làm nửa vời.
- **Không có "sản phẩm hot".** v3 bỏ cờ `showHot`/`showNew`/`showHome`. Khối
  "Nổi bật" ở trang chủ lấy theo danh sách ID nhà thuốc tự chọn trong
  **Kết nối Nhanh.vn → Sản phẩm nổi bật**. Khối "Hàng mới về" vẫn chạy được
  (sắp ID giảm dần).
- **Không có mô tả sản phẩm** trong `/product/list`. Trang chi tiết hiển thị
  thuộc tính (`attributes`) thay cho mô tả dài.

## Luồng đặt hàng

1. Khách chọn tỉnh/thành + quận/huyện + phường/xã. Mini App gửi **ID**.
2. `POST /shipping/fee` → BFF cộng trọng lượng từ `shipping.weight` của từng
   sản phẩm (sản phẩm chưa khai cân nặng dùng mức mặc định, mặc định 200g — để
   phí không bị tính bằng 0 và bị hãng vận chuyển từ chối), rồi gọi Nhanh.vn.
3. Danh sách dịch vụ hiện ra, rẻ nhất lên đầu. Đổi hình thức thanh toán sẽ tính
   lại vì `totalCod` thay đổi kéo theo phí thu hộ.
4. `POST /orders`:
   - BFF **đọc lại giá và tồn kho từ Nhanh.vn**. Client không gửi giá lên.
   - Lưu đơn vào WordPress, sinh mã `MNPyymmddXXXXXX`.
5. COD / chuyển khoản → đẩy `/v3.0/order/add` ngay, `status = 54` (Đơn mới).
   Thanh toán online → trả `paymentUrl`, chỉ đẩy sang Nhanh.vn khi webhook
   thanh toán xác nhận. Đẩy trước sẽ sinh đơn rác khi khách bỏ dở.
6. `channel.appOrderId` là khoá chống trùng phía Nhanh.vn — gọi lại cùng một
   đơn bị từ chối chứ không tạo đơn thứ hai.

## Chống lỗi đã cài sẵn

- **Rate limit**: gặp `ERR_429`, client ghi nhớ mốc `unlockedAt` và ngừng gọi
  tới lúc đó. Gọi tiếp chỉ làm Nhanh.vn kéo dài thời gian khoá.
- **Đẩy đơn thất bại**: thử lại qua cron sau 5, 10, 20, 40, 80 phút. Quá 5 lần
  thì bắn action `mnp_order_push_failed` để bạn gắn cảnh báo.
- **Cache**: danh mục và thương hiệu cache 24h, làm mới nền lúc 3h sáng bằng
  cron `mnp_refresh_catalog_cache` — khách đầu tiên trong ngày không phải chờ.
  Địa giới hành chính cache 7 ngày.
- **Giá đã gồm VAT**: `priceVatMode = 2` nghĩa là giá chưa gồm VAT. BFF cộng
  `prices.retailVat` vào trước khi trả về, nếu không tổng tiền ở giỏ sẽ lệch
  với đơn thật.

## Còn thiếu

- **Cổng thanh toán online.** Hai filter để trống: `mnp_create_payment_url` và
  `mnp_verify_payment_signature`. Chưa gắn cổng thì chọn thanh toán online sẽ
  báo lỗi rõ ràng; COD và chuyển khoản chạy bình thường.
- **Webhook Nhanh.vn.** Nên đăng ký webhook tồn kho + trạng thái đơn, trỏ về
  một endpoint mới gọi `Nhanh::instance()->flushCache()` và cập nhật
  `mnp_status`. Chưa có thì sản phẩm hết hàng vẫn hiện tới 24h, và trạng thái
  đơn trong app không tự đổi theo Nhanh.vn.
- **Sổ địa chỉ nhiều địa chỉ** (hiện chỉ nhớ địa chỉ gần nhất).
- **Mã giảm giá.** BFF đã truyền `payment.couponCode` và `discountAmount`, nhưng
  chưa có màn nhập mã. Lưu ý: Nhanh.vn **không** tự tính tiền giảm từ coupon —
  app phải tự tính rồi truyền số tiền vào `discountAmount`.
- **Chi tiết đơn và huỷ đơn** trong Mini App.

## Hai rủi ro vận hành

- **Access token hết hạn sau 1 năm** và Nhanh.vn chưa hỗ trợ refresh token.
  Đặt lịch nhắc gia hạn, nếu không app sẽ chết đúng vào ngày hết hạn.
- **Quyền của token là cố định tại thời điểm cấp.** Nhân viên cấp quyền phải
  chọn đủ: danh sách sản phẩm, danh mục, thương hiệu, đơn hàng, vận chuyển và
  **tất cả kho hàng** — thiếu kho nào thì tồn kho trả về sẽ hụt so với thực tế.
