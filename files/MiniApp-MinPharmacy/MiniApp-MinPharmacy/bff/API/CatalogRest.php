<?php

namespace MaxPharmacy\ZaloLogin\API;

use MaxPharmacy\ZaloLogin\Core\Response;
use MaxPharmacy\ZaloLogin\Services\Nhanh;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST API danh mục / thương hiệu / sản phẩm cho Zalo Mini App.
 *
 * Namespace `mnp/v1`, tách khỏi `mzl/v1` (đăng nhập Zalo) để hai phần bật/tắt
 * và giới hạn tần suất độc lập. Toàn bộ endpoint ở đây công khai — khách phải
 * xem được sản phẩm trước khi đăng nhập.
 *
 * Phân trang theo cursor: client gửi lại nguyên vẹn giá trị `next` nhận được
 * từ lần gọi trước. `next` của Nhanh.vn có thể là object (VD {"id":100}) nên
 * ta truyền qua query string dưới dạng JSON đã mã hoá base64, tránh việc
 * PHP/WordPress làm phẳng mảng lồng nhau trong query.
 *
 * @package MaxPharmacy\ZaloLogin\API
 */
final class CatalogRest
{
    private const NAMESPACE = 'mnp/v1';

    private static ?CatalogRest $instance = null;

    private function __construct()
    {
        add_action('rest_api_init', [$this, 'registerRoutes']);
        add_action('rest_api_init', [$this, 'enableMiniAppCors'], 15);
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

    /**
     * Mini App chạy trong WebView với origin do Zalo cấp, nên request là
     * cross-origin. Chỉ mở CORS cho đúng các origin của Zalo.
     */
    public function enableMiniAppCors(): void
    {
        remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');

        add_filter('rest_pre_serve_request', static function ($served) {
            $origin = get_http_origin();

            $allowed = apply_filters('mnp_allowed_origins', [
                'https://h5.zdn.vn',
                'https://zapps.zaloapp.com',
            ]);

            if ($origin && in_array($origin, $allowed, true)) {
                header('Access-Control-Allow-Origin: ' . esc_url_raw($origin));
                header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
                header('Access-Control-Allow-Headers: Authorization, Content-Type');
                header('Vary: Origin');
            }

            return $served;
        });
    }

    public function registerRoutes(): void
    {
        register_rest_route(self::NAMESPACE, '/categories', [
            'methods'             => 'GET',
            'callback'            => [$this, 'categories'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/brands', [
            'methods'             => 'GET',
            'callback'            => [$this, 'brands'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/products', [
            'methods'             => 'GET',
            'callback'            => [$this, 'products'],
            'permission_callback' => '__return_true',
            'args'                => [
                'limit'      => ['type' => 'integer', 'default' => 20],
                'next'       => ['type' => 'string'],
                'categoryId' => ['type' => 'integer'],
                'brandId'    => ['type' => 'integer'],
                'keyword'    => ['type' => 'string'],
                'highlight'  => ['type' => 'string', 'enum' => ['new', 'featured']],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/products/(?P<id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'product'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE, '/locations', [
            'methods'             => 'GET',
            'callback'            => [$this, 'locations'],
            'permission_callback' => '__return_true',
            'args'                => [
                'type' => [
                    'required' => true,
                    'type'     => 'string',
                    'enum'     => ['city', 'district', 'ward'],
                ],
                'parentId' => ['type' => 'integer'],
            ],
        ]);
    }

    public function categories(WP_REST_Request $request): WP_REST_Response
    {
        return Response::success(Nhanh::instance()->categories());
    }

    public function brands(WP_REST_Request $request): WP_REST_Response
    {
        return Response::success(Nhanh::instance()->brands());
    }

    /**
     * Danh sách sản phẩm.
     *
     * `highlight=featured` không phải tính năng của Nhanh.vn — v3 đã bỏ các cờ
     * showHot/showNew/showHome của v2. Ta lấy theo danh sách ID sản phẩm nổi
     * bật do nhà thuốc tự chọn, lưu trong option `mnp_featured_product_ids`.
     */
    public function products(WP_REST_Request $request): WP_REST_Response
    {
        $nhanh = Nhanh::instance();
        $limit = (int) $request->get_param('limit');

        if ($request->get_param('highlight') === 'featured') {
            $ids = array_filter(array_map(
                'intval',
                (array) get_option('mnp_featured_product_ids', [])
            ));

            if (empty($ids)) {
                return Response::success(['products' => [], 'next' => null]);
            }

            $found = $nhanh->productsByIds(array_slice($ids, 0, max(1, $limit)));

            // Giữ đúng thứ tự nhà thuốc đã sắp, không theo thứ tự Nhanh.vn trả về.
            $ordered = [];

            foreach ($ids as $id) {
                if (isset($found[$id])) {
                    $ordered[] = $found[$id];
                }
            }

            return Response::success(['products' => $ordered, 'next' => null]);
        }

        $result = $nhanh->products([
            'limit'      => $limit,
            'next'       => $this->decodeCursor((string) $request->get_param('next')),
            'categoryId' => (int) $request->get_param('categoryId'),
            'brandId'    => (int) $request->get_param('brandId'),
            'keyword'    => sanitize_text_field((string) $request->get_param('keyword')),
        ]);

        return Response::success([
            'products' => $result['products'],
            'next'     => $this->encodeCursor($result['next']),
        ]);
    }

    public function product(WP_REST_Request $request): WP_REST_Response
    {
        $product = Nhanh::instance()->product((int) $request->get_param('id'));

        if ($product === null) {
            return Response::notFound('Không tìm thấy sản phẩm này.');
        }

        return Response::success($product);
    }

    public function locations(WP_REST_Request $request): WP_REST_Response
    {
        $type     = strtoupper((string) $request->get_param('type'));
        $parentId = $request->get_param('parentId');

        if ($type !== 'CITY' && empty($parentId)) {
            return Response::error('Thiếu parentId cho cấp hành chính này.', 400);
        }

        return Response::success(
            Nhanh::instance()->locations($type, $parentId ? (int) $parentId : null)
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cursor
    |--------------------------------------------------------------------------
    */

    /**
     * Đóng gói cursor của Nhanh.vn thành chuỗi an toàn cho URL.
     *
     * Giá trị `next` có thể là string, int hoặc object nhiều field. Bọc JSON
     * rồi base64 để client chỉ việc gửi lại nguyên văn, không phải hiểu nội
     * dung bên trong.
     */
    private function encodeCursor(mixed $next): ?string
    {
        if ($next === null || $next === '' || $next === []) {
            return null;
        }

        return base64_encode((string) wp_json_encode($next));
    }

    private function decodeCursor(string $cursor): mixed
    {
        if ($cursor === '') {
            return null;
        }

        $raw = base64_decode($cursor, true);

        if ($raw === false) {
            return null;
        }

        return json_decode($raw, true);
    }
}
