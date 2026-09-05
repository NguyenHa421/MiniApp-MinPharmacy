<?php

namespace MaxPharmacy\ZaloLogin\API;

use MaxPharmacy\ZaloLogin\Auth\Token;
use MaxPharmacy\ZaloLogin\Auth\User;
use MaxPharmacy\ZaloLogin\Core\Logger;
use MaxPharmacy\ZaloLogin\Core\Response;
use MaxPharmacy\ZaloLogin\Services\Zalo;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST API đăng nhập / đăng ký cho Zalo Mini App.
 *
 * Khác với `mzl/v1` (thiết kế cho WebView WordPress, set cookie đăng nhập),
 * namespace này trả về **token** để Mini App tự đính kèm vào header. Mini App
 * chạy ở origin của Zalo nên cookie SameSite của WordPress không dùng được.
 *
 * Toàn bộ việc xác minh danh tính vẫn diễn ra ở server:
 *  - `access_token` -> gọi Zalo Open API lấy OpenID thật, so khớp với openid
 *    client gửi lên. Không khớp thì từ chối.
 *  - `code` (token SĐT, sống 2 phút, dùng một lần) -> đổi ra số điện thoại
 *    thật bằng secret key. Không bao giờ tin số điện thoại client tự khai.
 *
 * @package MaxPharmacy\ZaloLogin\API
 */
final class AuthRest
{
    use AuthenticatesRequests;

    private const NAMESPACE = 'mnp/v1';

    private static ?AuthRest $instance = null;

    private function __construct()
    {
        add_action('rest_api_init', [$this, 'registerRoutes']);
    }

    public static function instance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __clone()
    {
    }

    public function __wakeup(): void
    {
        throw new \Exception('Cannot unserialize singleton.');
    }

    public function registerRoutes(): void
    {
        register_rest_route(self::NAMESPACE, '/auth/zalo', [
            'methods'             => 'POST',
            'callback'            => [$this, 'loginWithZalo'],
            'permission_callback' => '__return_true',
            'args'                => [
                'openid'       => ['required' => true, 'type' => 'string'],
                'access_token' => ['required' => true, 'type' => 'string'],
                'code'         => ['required' => true, 'type' => 'string'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/auth/login', [
            'methods'             => 'POST',
            'callback'            => [$this, 'loginWithPassword'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/auth/register', [
            'methods'             => 'POST',
            'callback'            => [$this, 'register'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/auth/me', [
            'methods'             => 'GET',
            'callback'            => [$this, 'me'],
            'permission_callback' => [$this, 'requireUser'],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Endpoints
    |--------------------------------------------------------------------------
    */

    /**
     * Đăng nhập một chạm bằng Zalo.
     *
     * Tài khoản được nhận diện theo số điện thoại đã xác minh: đã có khách với
     * số đó thì gắn thêm zalo_id, không tạo tài khoản trùng.
     */
    public function loginWithZalo(WP_REST_Request $request): WP_REST_Response
    {
        $openId      = sanitize_text_field((string) $request->get_param('openid'));
        $accessToken = (string) $request->get_param('access_token');
        $code        = (string) $request->get_param('code');
        $name        = sanitize_text_field((string) $request->get_param('name'));
        $avatar      = esc_url_raw((string) $request->get_param('avatar'));

        $zalo = Zalo::instance();

        // Bước 1: OpenID thật, chống client giả mạo openid của người khác.
        $verified = $zalo->verifyAccessToken($accessToken);

        if (!$verified['success']) {
            return Response::error('Phiên Zalo đã hết hạn. Hãy thử đăng nhập lại.', 401);
        }

        if (!hash_equals((string) $verified['openid'], $openId)) {
            Logger::warning('OpenID mismatch on Mini App login.', [
                'claimed' => $openId,
                'actual'  => $verified['openid'],
            ]);

            return Response::error('Thông tin tài khoản Zalo không khớp.', 403);
        }

        // Bước 2: số điện thoại thật.
        $resolved = $zalo->resolvePhoneNumber($accessToken, $code);

        if (!$resolved['success']) {
            return Response::error(
                'Chưa lấy được số điện thoại từ Zalo. Hãy cấp quyền rồi thử lại.',
                422
            );
        }

        $phone       = (string) $resolved['phone'];
        $userService = User::instance();

        $userId = $userService->findIdByOpenId($openId);

        if ($userId <= 0) {
            $userId = $userService->findIdByPhone($phone);
        }

        if ($userId <= 0) {
            $userId = $userService->createCustomer([
                'phone'  => $phone,
                'name'   => $name,
                'avatar' => $avatar,
            ]);
        }

        if ($userId <= 0) {
            Logger::error('Unable to create customer from Zalo login.', ['phone' => $phone]);

            return Response::serverError('Không tạo được tài khoản. Vui lòng thử lại.');
        }

        $userService->bindOpenId($userId, $openId, [
            'name'   => $name,
            'phone'  => $phone,
            'avatar' => $avatar,
        ]);

        return $this->issueToken($userId);
    }

    /** Đăng nhập bằng SĐT + mật khẩu, dành cho khách đã có tài khoản trên web. */
    public function loginWithPassword(WP_REST_Request $request): WP_REST_Response
    {
        $phone    = $this->normalizePhone((string) $request->get_param('phone'));
        $password = (string) $request->get_param('password');

        if (!$this->isValidPhone($phone) || $password === '') {
            return Response::error('Số điện thoại hoặc mật khẩu chưa đúng.', 400);
        }

        $userId = User::instance()->findIdByPhone($phone);

        if ($userId <= 0) {
            // Không tiết lộ số nào đã đăng ký — tránh dò danh sách khách hàng.
            return Response::error('Số điện thoại hoặc mật khẩu chưa đúng.', 401);
        }

        $user = get_userdata($userId);

        if (!$user || !wp_check_password($password, $user->user_pass, $userId)) {
            return Response::error('Số điện thoại hoặc mật khẩu chưa đúng.', 401);
        }

        return $this->issueToken($userId);
    }

    public function register(WP_REST_Request $request): WP_REST_Response
    {
        $name     = sanitize_text_field((string) $request->get_param('name'));
        $phone    = $this->normalizePhone((string) $request->get_param('phone'));
        $email    = sanitize_email((string) $request->get_param('email'));
        $password = (string) $request->get_param('password');

        if (mb_strlen($name) < 2) {
            return Response::error('Nhập họ tên của bạn.', 400);
        }

        if (!$this->isValidPhone($phone)) {
            return Response::error('Số điện thoại chưa đúng định dạng.', 400);
        }

        if (strlen($password) < 6) {
            return Response::error('Mật khẩu tối thiểu 6 ký tự.', 400);
        }

        $userService = User::instance();

        if ($userService->findIdByPhone($phone) > 0) {
            return Response::error(
                'Số điện thoại này đã có tài khoản. Bạn hãy đăng nhập.',
                409
            );
        }

        $userId = $userService->createCustomer([
            'phone'    => $phone,
            'name'     => $name,
            'email'    => $email,
            'password' => $password,
        ]);

        if ($userId <= 0) {
            return Response::serverError('Không tạo được tài khoản. Vui lòng thử lại.');
        }

        return $this->issueToken($userId, 'Tạo tài khoản thành công.');
    }

    public function me(WP_REST_Request $request): WP_REST_Response
    {
        $userId = $this->currentUserId($request);
        $user   = $this->presentUser($userId);

        if ($user === null) {
            return Response::notFound('Không tìm thấy tài khoản.');
        }

        return Response::success($user);
    }

    /*
    |--------------------------------------------------------------------------
    | Helper
    |--------------------------------------------------------------------------
    */

    private function issueToken(int $userId, string $message = 'Đăng nhập thành công.'): WP_REST_Response
    {
        $token = Token::instance()->create($userId);
        $user  = $this->presentUser($userId);

        if ($token === '' || $user === null) {
            return Response::serverError('Không tạo được phiên đăng nhập.');
        }

        User::instance()->touchLastLogin($userId);

        return Response::success(['token' => $token, 'user' => $user], $message);
    }

    /** Chỉ trả ra field Mini App cần. Không lộ email nội bộ, role, meta khác. */
    private function presentUser(int $userId): ?array
    {
        $user = get_userdata($userId);

        if (!$user) {
            return null;
        }

        return [
            'id'           => $userId,
            'name'         => (string) $user->display_name,
            'phone'        => (string) get_user_meta($userId, 'zalo_phone', true)
                ?: (string) get_user_meta($userId, 'billing_phone', true),
            'email'        => (string) $user->user_email,
            'avatar'       => (string) get_user_meta($userId, 'zalo_avatar', true),
            'zaloVerified' => (bool) get_user_meta($userId, 'zalo_verified', true),
        ];
    }

    private function normalizePhone(string $raw): string
    {
        $phone = preg_replace('/[\s\-.()]/', '', trim($raw)) ?? '';

        if (str_starts_with($phone, '+84')) {
            return '0' . substr($phone, 3);
        }

        if (str_starts_with($phone, '84') && strlen($phone) === 11) {
            return '0' . substr($phone, 2);
        }

        return $phone;
    }

    private function isValidPhone(string $phone): bool
    {
        return (bool) preg_match('/^(03|05|07|08|09)\d{8}$/', $phone);
    }
}
