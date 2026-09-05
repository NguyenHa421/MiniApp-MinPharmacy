# Đặt file vào đâu

Bộ code gồm hai phần chạy ở hai nơi khác nhau.

## Phần 1 — Zalo Mini App

Repo `MiniApp-MinPharmacy` hiện tại. Chép đè lên cấu trúc sẵn có:

| File trong bàn giao | Đặt vào repo Mini App | Ghi chú |
|---|---|---|
| `src/config.ts` | `src/config.ts` | **Mới.** Sửa `API_BASE` trước khi chạy |
| `src/types/index.ts` | `src/types/index.ts` | Mới |
| `src/utils/format.ts` | `src/utils/format.ts` | Mới |
| `src/hooks/use-product-list.ts` | `src/hooks/use-product-list.ts` | Mới |
| `src/services/*.ts` (5 file) | `src/services/` | Mới |
| `src/state/index.ts` | `src/state/index.ts` | Mới |
| `src/components/layout.tsx` | `src/components/layout.tsx` | **Ghi đè** file cũ |
| `src/components/*.tsx` (6 file còn lại) | `src/components/` | Mới |
| `src/pages/index.tsx` | `src/pages/index.tsx` | **Ghi đè** — file cũ chỉ mở WebView |
| `src/pages/*.tsx` (12 file còn lại) | `src/pages/` | Mới |
| `src/css/app.scss` | `src/css/app.scss` | **Ghi đè** |
| `package.json` | `package.json` | **Ghi đè** — thêm `react-router-dom`, `typescript` |
| `app-config.json` | `app-config.json` | **Ghi đè** — khai báo CSP |
| `tsconfig.json` | `tsconfig.json` | Ghi đè nếu chưa có alias `@/*` |

Giữ nguyên: `src/app.ts`, `index.html`, `vite.config.ts`, `tailwind.config.js`,
`postcss.config.js`. Có thể xoá `src/components/clock.tsx` — đó là mẫu của template.

```bash
npm install
npm run typecheck   # phải sạch lỗi
zmp start
```

## Phần 2 — BFF trên WordPress

Thư mục `bff/` chép vào plugin `max-zalo-login` sẵn có, theo đúng namespace
PSR-4 đang dùng:

| File trong bàn giao | Đặt vào plugin |
|---|---|
| `bff/Services/Nhanh.php` | `src/Services/Nhanh.php` |
| `bff/API/CatalogRest.php` | `src/API/CatalogRest.php` |
| `bff/API/OrderRest.php` | `src/API/OrderRest.php` |
| `bff/API/AuthRest.php` | `src/API/AuthRest.php` |
| `bff/API/AuthenticatesRequests.php` | `src/API/AuthenticatesRequests.php` |
| `bff/Core/NhanhModule.php` | `src/core/NhanhModule.php` |
| `bff/Admin/NhanhSettings.php` | `src/Admin/NhanhSettings.php` |

> `NhanhModule.php` vào đúng thư mục đang chứa `Config.php` (repo hiện dùng
> `src/core/` chữ thường cho namespace `Core`).

### Bốn chỗ phải sửa trong plugin

**1. `src/core/Loader.php`** — thêm một dòng vào phương thức boot:

```php
use MaxPharmacy\ZaloLogin\Core\NhanhModule;
// ...
NhanhModule::instance();
```

**2. `src/core/Config.php`** — nối thêm vào `Config::keys()`:

```php
...NhanhModule::CONFIG_KEYS,
```

Hoặc chép thẳng 12 key trong `NhanhModule::CONFIG_KEYS` vào mảng đang có.
Thiếu bước này thì `Config::get('nhanh_app_id')` luôn trả `null`.

**3. `min-zalo-login.php`** — nối vào hook activation/deactivation:

```php
register_activation_hook(__FILE__, [NhanhModule::class, 'activate']);
register_deactivation_hook(__FILE__, [NhanhModule::class, 'deactivate']);
```

**4. Vào **Max Zalo Login → Kết nối Nhanh.vn** điền App ID, Business ID,
Access Token, kho hàng và địa chỉ kho gửi, rồi bấm **Lưu**.

### Kiểm tra nhanh sau khi cài

```bash
curl https://minpharmacy.com.vn/wp-json/mnp/v1/categories
curl "https://minpharmacy.com.vn/wp-json/mnp/v1/products?limit=5"
```

Trả về `{"success":true,"data":[...]}` là kết nối Nhanh.vn đã chạy.

## Phụ thuộc vào code sẵn có

`AuthRest` gọi các phương thức sau của plugin. Kiểm tra chúng đã tồn tại và
đúng chữ ký; nếu chưa thì phải bổ sung:

| Class | Phương thức | Kỳ vọng trả về |
|---|---|---|
| `Auth\Token` | `create(int $userId)` | `string` token HMAC |
| `Auth\Token` | `verify(string $token)` | `int` user ID, `0` nếu sai/hết hạn |
| `Auth\User` | `findIdByPhone(string $phone)` | `int`, `0` nếu không có |
| `Auth\User` | `findIdByOpenId(string $openId)` | `int`, `0` nếu không có |
| `Auth\User` | `createCustomer(array $data)` | `int` user ID mới |
| `Auth\User` | `bindOpenId(int $userId, string $openId, array $meta)` | `bool` |
| `Auth\User` | `touchLastLogin(int $userId)` | `void` |
| `Services\Zalo` | `verifyAccessToken(string $token)` | `['success'=>bool,'openid'=>string]` |
| `Services\Zalo` | `resolvePhoneNumber(string $token, string $code)` | `['success'=>bool,'phone'=>string]` |
| `Core\Response` | `success/error/notFound/serverError` | `WP_REST_Response` |

Hai phương thức của `Services\Zalo` và `Core\Response` đã có sẵn theo
`PROJECT_ANALYSIS.md`. Phần `Auth\User` và `Auth\Token` cần đối chiếu lại.
