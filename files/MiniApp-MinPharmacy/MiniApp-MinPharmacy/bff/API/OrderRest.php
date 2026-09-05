<?php

namespace MaxPharmacy\ZaloLogin\API;

use MaxPharmacy\ZaloLogin\Core\Config;
use MaxPharmacy\ZaloLogin\Core\Logger;
use MaxPharmacy\ZaloLogin\Core\Response;
use MaxPharmacy\ZaloLogin\Services\Nhanh;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST API tính phí vận chuyển và đặt hàng (Nhanh.vn v3.0).
 *
 * Nguyên tắc: đơn hàng lưu ở hệ thống mình TRƯỚC, đẩy sang Nhanh.vn SAU. Nếu
 * Nhanh.vn lỗi hoặc đang bị rate limit, đơn vẫn tồn tại và được cron thử lại —
 * khách không mất đơn vì API bên thứ ba trục trặc.
 *
 * Thanh toán online: đơn chỉ được đẩy sang Nhanh.vn sau khi cổng thanh toán
 * xác nhận. Đẩy trước sẽ sinh đơn rác khi khách bỏ dở màn thanh toán.
 *
 * @package MaxPharmacy\ZaloLogin\API
 */
final class OrderRest
{
    use AuthenticatesRequests;

    private const NAMESPACE = 'mnp/v1';

    /** Custom post type lưu đơn. Đăng ký trong Core\NhanhModule. */
    public const POST_TYPE = 'mnp_order';

    private static ?OrderRest $instance = null;

    private function __construct()
    {
        add_action('rest_api_init', [$this, 'registerRoutes']);
        add_action('mnp_retry_push_order', [$this, 'retryPushOrder']);
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
        register_rest_route(self::NAMESPACE, '/shipping/fee', [
            'methods'             => 'POST',
            'callback'            => [$this, 'shippingFee'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/orders', [
            [
                'methods'             => 'POST',
                'callback'            => [$this, 'createOrder'],
                'permission_callback' => [$this, 'requireUser'],
            ],
            [
                'methods'             => 'GET',
                'callback'            => [$this, 'myOrders'],
                'permission_callback' => [$this, 'requireUser'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/orders/(?P<id>[A-Za-z0-9]+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'orderDetail'],
            'permission_callback' => [$this, 'requireUser'],
        ]);

        // Webhook cổng thanh toán. Xác thực bằng chữ ký, không bằng token.
        register_rest_route(self::NAMESPACE, '/payments/callback', [
            'methods'             => 'POST',
            'callback'            => [$this, 'paymentCallback'],
            'permission_callback' => '__return_true',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Vận chuyển
    |--------------------------------------------------------------------------
    */

    /**
     * Tính phí vận chuyển.
     *
     * v3 nhận ID địa giới (cityId/districtId/wardId), không nhận tên như v2.
     */
    public function shippingFee(WP_REST_Request $request): WP_REST_Response
    {
        $cityId     = (int) $request->get_param('cityId');
        $districtId = (int) $request->get_param('districtId');
        $wardId     = (int) $request->get_param('wardId');
        $items      = (array) $request->get_param('items');

        if ($cityId <= 0 || $districtId <= 0) {
            return Response::error('Cần chọn tỉnh/thành phố và quận/huyện.', 400);
        }

        if (empty($items)) {
            return Response::error('Giỏ hàng đang trống.', 400);
        }

        $services = Nhanh::instance()->shippingFee(
            [
                'cityId'     => $cityId,
                'districtId' => $districtId,
                'wardId'     => $wardId,
                'address'    => sanitize_text_field((string) $request->get_param('address')),
            ],
            (int) $request->get_param('subtotal'),
            (int) $request->get_param('codMoney'),
            $items
        );

        return Response::success($services);
    }

    /*
    |--------------------------------------------------------------------------
    | Đặt hàng
    |--------------------------------------------------------------------------
    */

    /**
     * Tạo đơn hàng.
     *
     * Giá và tồn kho luôn đọc lại từ Nhanh.vn, không tin số client gửi lên —
     * nếu tin, ai cũng đặt được thuốc giá 1.000đ.
     */
    public function createOrder(WP_REST_Request $request): WP_REST_Response
    {
        $userId  = $this->currentUserId($request);
        $address = (array) $request->get_param('address');
        $items   = (array) $request->get_param('items');

        foreach (['name', 'phone', 'address', 'cityId', 'districtId'] as $field) {
            if (empty($address[$field])) {
                return Response::error('Thiếu thông tin địa chỉ giao hàng.', 400);
            }
        }

        if (empty($items)) {
            return Response::error('Giỏ hàng đang trống.', 400);
        }

        $nhanh = Nhanh::instance();

        // Một request lấy hết sản phẩm trong giỏ, thay vì N request.
        $catalog = $nhanh->productsByIds(array_column($items, 'productId'));

        $lines    = [];
        $subtotal = 0;

        foreach ($items as $item) {
            $productId = (int) ($item['productId'] ?? 0);
            $quantity  = (int) ($item['quantity'] ?? 0);

            if ($productId <= 0 || $quantity <= 0) {
                return Response::error('Sản phẩm trong giỏ không hợp lệ.', 400);
            }

            $product = $catalog[$productId] ?? null;

            if ($product === null) {
                return Response::error('Một sản phẩm trong giỏ đã ngừng bán.', 409);
            }

            if ($product['available'] < $quantity) {
                return Response::error(
                    sprintf(
                        '"%s" chỉ còn %d sản phẩm.',
                        $product['name'],
                        max(0, $product['available'])
                    ),
                    409
                );
            }

            $lines[] = [
                'productId' => $productId,
                'name'      => $product['name'],
                'code'      => $product['code'],
                'quantity'  => $quantity,
                'price'     => $product['price'],
            ];

            $subtotal += $product['price'] * $quantity;
        }

        $shipFee       = max(0, (int) $request->get_param('customerShipFee'));
        $paymentMethod = (string) $request->get_param('paymentMethod');
        $total         = $subtotal + $shipFee;
        $orderId       = $this->generateOrderId();

        $order = [
            'id'                 => $orderId,
            'userId'             => $userId,
            'address'            => [
                'name'       => sanitize_text_field((string) $address['name']),
                'phone'      => sanitize_text_field((string) $address['phone']),
                'email'      => sanitize_email((string) ($address['email'] ?? '')),
                'address'    => sanitize_text_field((string) $address['address']),
                'cityId'     => (int) $address['cityId'],
                'districtId' => (int) $address['districtId'],
                'wardId'     => (int) ($address['wardId'] ?? 0),
                'cityName'   => sanitize_text_field((string) ($address['cityName'] ?? '')),
                'districtName' => sanitize_text_field((string) ($address['districtName'] ?? '')),
                'wardName'   => sanitize_text_field((string) ($address['wardName'] ?? '')),
            ],
            'items'              => $lines,
            'subtotal'           => $subtotal,
            'customerShipFee'    => $shipFee,
            'total'              => $total,
            'paymentMethod'      => $paymentMethod,
            'carrierId'          => (int) $request->get_param('carrierId'),
            'carrierServiceId'   => (int) $request->get_param('carrierServiceId'),
            'carrierServiceCode' => sanitize_text_field((string) $request->get_param('carrierServiceCode')),
            'carrierAccountId'   => (int) $request->get_param('carrierAccountId'),
            'carrierShopId'      => sanitize_text_field((string) $request->get_param('carrierShopId')),
            'note'               => sanitize_textarea_field((string) $request->get_param('note')),
            'paid'               => false,
            'nhanhOrderId'       => null,
            'trackingUrl'        => '',
            'status'             => 'New',
            'createdAt'          => time(),
        ];

        $this->saveOrder($order);

        // COD và chuyển khoản: đẩy ngay để dược sĩ gọi xác nhận.
        if ($paymentMethod !== 'ZALOPAY') {
            $this->pushToNhanh($orderId);

            $saved = $this->getOrder($orderId);

            return Response::success([
                'id'            => $orderId,
                'nhanhOrderId'  => $saved['nhanhOrderId'] ?? null,
                'total'         => $total,
                'paymentMethod' => $paymentMethod,
            ], 'Đã nhận đơn hàng.');
        }

        // Thanh toán online: trả link cổng thanh toán, chờ webhook rồi mới đẩy.
        $paymentUrl = apply_filters('mnp_create_payment_url', '', $order);

        if (!is_string($paymentUrl) || $paymentUrl === '') {
            return Response::serverError('Chưa cấu hình cổng thanh toán online.');
        }

        return Response::success([
            'id'            => $orderId,
            'nhanhOrderId'  => null,
            'total'         => $total,
            'paymentMethod' => $paymentMethod,
            'paymentUrl'    => $paymentUrl,
        ], 'Chuyển sang cổng thanh toán.');
    }

    public function myOrders(WP_REST_Request $request): WP_REST_Response
    {
        $userId = $this->currentUserId($request);

        $posts = get_posts([
            'post_type'      => self::POST_TYPE,
            'posts_per_page' => 50,
            'author'         => $userId,
            'post_status'    => 'any',
        ]);

        $orders = [];

        foreach ($posts as $post) {
            $data = json_decode((string) $post->post_content, true);

            if (!is_array($data)) {
                continue;
            }

            $orders[] = [
                'id'        => (string) ($data['id'] ?? $post->post_title),
                'total'     => (int) ($data['total'] ?? 0),
                'status'    => (string) get_post_meta($post->ID, 'mnp_status', true) ?: 'New',
                'itemCount' => count((array) ($data['items'] ?? [])),
                'createdAt' => get_the_date('d/m/Y H:i', $post),
            ];
        }

        return Response::success($orders);
    }

    public function orderDetail(WP_REST_Request $request): WP_REST_Response
    {
        $userId = $this->currentUserId($request);
        $order  = $this->getOrder((string) $request->get_param('id'));

        if ($order === null || (int) ($order['userId'] ?? 0) !== $userId) {
            return Response::notFound('Không tìm thấy đơn hàng.');
        }

        return Response::success($order);
    }

    /**
     * Webhook từ cổng thanh toán.
     *
     * Endpoint công khai nên KHÔNG được tin payload khi chưa kiểm chữ ký.
     */
    public function paymentCallback(WP_REST_Request $request): WP_REST_Response
    {
        $payload = $request->get_json_params() ?: [];
        $valid   = apply_filters('mnp_verify_payment_signature', false, $payload, $request);

        if ($valid !== true) {
            Logger::warning('Payment callback rejected: invalid signature.');

            return Response::error('Chữ ký không hợp lệ.', 403);
        }

        $orderId = sanitize_text_field((string) ($payload['orderId'] ?? ''));
        $order   = $this->getOrder($orderId);

        if ($order === null) {
            return Response::notFound('Không tìm thấy đơn hàng.');
        }

        // Cổng thanh toán gọi lại nhiều lần là bình thường — xử lý idempotent.
        if (!empty($order['paid'])) {
            return Response::success([], 'Đơn đã được ghi nhận trước đó.');
        }

        $order['paid']           = true;
        $order['paymentCode']    = sanitize_text_field((string) ($payload['transactionId'] ?? ''));
        $order['paymentGateway'] = sanitize_text_field((string) ($payload['gateway'] ?? ''));

        $this->saveOrder($order);
        $this->pushToNhanh($orderId);

        return Response::success([], 'Đã ghi nhận thanh toán.');
    }

    /*
    |--------------------------------------------------------------------------
    | Đẩy sang Nhanh.vn
    |--------------------------------------------------------------------------
    */

    /**
     * Thất bại thì hẹn cron thử lại, không ném lỗi ra cho khách — đơn đã lưu
     * ở hệ thống mình rồi.
     */
    private function pushToNhanh(string $orderId): void
    {
        $order = $this->getOrder($orderId);

        if ($order === null || !empty($order['nhanhOrderId'])) {
            return;
        }

        $result = Nhanh::instance()->createOrder($order);

        if ($result['success']) {
            $order['nhanhOrderId'] = $result['orderId'];
            $order['trackingUrl']  = $result['trackingUrl'] ?? '';
            $order['status']       = 'Confirming';

            $this->saveOrder($order);

            Logger::info('Order pushed to Nhanh.vn.', [
                'order_id' => $orderId,
                'nhanh_id' => $result['orderId'],
            ]);

            return;
        }

        $attempts              = (int) ($order['pushAttempts'] ?? 0) + 1;
        $order['pushAttempts'] = $attempts;
        $order['pushError']    = $result['message'] ?? '';

        $this->saveOrder($order);

        if ($attempts <= 5) {
            // Giãn dần: 5, 10, 20, 40, 80 phút — đủ để qua cửa sổ rate limit.
            wp_schedule_single_event(
                time() + (300 * (2 ** ($attempts - 1))),
                'mnp_retry_push_order',
                [$orderId]
            );
        } else {
            Logger::error('Order push to Nhanh.vn gave up after 5 attempts.', [
                'order_id' => $orderId,
                'error'    => $order['pushError'],
            ]);

            do_action('mnp_order_push_failed', $order);
        }
    }

    /** Cron callback. */
    public function retryPushOrder(string $orderId): void
    {
        $this->pushToNhanh($orderId);
    }

    /*
    |--------------------------------------------------------------------------
    | Lưu trữ
    |--------------------------------------------------------------------------
    */

    private function generateOrderId(): string
    {
        // Chỉ chữ và số: Nhanh.vn dùng appOrderId làm khoá chống trùng.
        return 'MNP' . gmdate('ymd') . strtoupper(wp_generate_password(6, false, false));
    }

    private function saveOrder(array $order): void
    {
        $postId = $this->findPostId($order['id']);

        $payload = [
            'post_type'    => self::POST_TYPE,
            'post_title'   => $order['id'],
            'post_name'    => strtolower($order['id']),
            'post_content' => wp_json_encode($order, JSON_UNESCAPED_UNICODE),
            'post_status'  => 'publish',
            'post_author'  => (int) ($order['userId'] ?? 0),
        ];

        if ($postId > 0) {
            $payload['ID'] = $postId;
        }

        $result = wp_insert_post($payload, true);

        if (is_wp_error($result)) {
            Logger::error('Unable to save order.', [
                'order_id' => $order['id'],
                'error'    => $result->get_error_message(),
            ]);

            return;
        }

        update_post_meta($result, 'mnp_status', (string) ($order['status'] ?? 'New'));
        update_post_meta($result, 'mnp_total', (int) $order['total']);
        update_post_meta($result, 'mnp_nhanh_id', (int) ($order['nhanhOrderId'] ?? 0));
    }

    private function findPostId(string $orderId): int
    {
        $posts = get_posts([
            'post_type'      => self::POST_TYPE,
            'name'           => strtolower($orderId),
            'posts_per_page' => 1,
            'post_status'    => 'any',
            'fields'         => 'ids',
        ]);

        return $posts ? (int) $posts[0] : 0;
    }

    private function getOrder(string $orderId): ?array
    {
        $postId = $this->findPostId($orderId);

        if ($postId <= 0) {
            return null;
        }

        $data = json_decode((string) get_post_field('post_content', $postId), true);

        return is_array($data) ? $data : null;
    }
}
