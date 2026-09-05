<?php

namespace MaxPharmacy\ZaloLogin\API;

use MaxPharmacy\ZaloLogin\Auth\Token;
use WP_REST_Request;

defined('ABSPATH') || exit;

/**
 * Xác thực request đến từ Zalo Mini App.
 *
 * Mini App gửi `Authorization: Bearer <login_token>` — token HMAC do
 * Auth\Token của plugin cấp. Không dùng cookie: WebView Mini App là
 * cross-origin nên cookie SameSite bị trình duyệt chặn.
 *
 * @package MaxPharmacy\ZaloLogin\API
 */
trait AuthenticatesRequests
{
    public function requireUser(WP_REST_Request $request): bool
    {
        return $this->currentUserId($request) > 0;
    }

    protected function currentUserId(WP_REST_Request $request): int
    {
        $header = (string) $request->get_header('authorization');

        if (stripos($header, 'Bearer ') === 0) {
            $userId = (int) Token::instance()->verify(trim(substr($header, 7)));

            if ($userId > 0) {
                return $userId;
            }
        }

        // Fallback cho trường hợp mở trang trong trình duyệt đã đăng nhập WP.
        return get_current_user_id();
    }
}
