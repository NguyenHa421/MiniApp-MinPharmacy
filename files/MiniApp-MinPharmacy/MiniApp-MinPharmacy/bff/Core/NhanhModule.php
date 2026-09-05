<?php

namespace MaxPharmacy\ZaloLogin\Core;

use MaxPharmacy\ZaloLogin\Admin\NhanhSettings;
use MaxPharmacy\ZaloLogin\API\AuthRest;
use MaxPharmacy\ZaloLogin\API\CatalogRest;
use MaxPharmacy\ZaloLogin\API\OrderRest;
use MaxPharmacy\ZaloLogin\Services\Nhanh;

defined('ABSPATH') || exit;

/**
 * Module Min Pharmacy — điểm khởi động duy nhất cho phần Nhanh.vn + Mini App.
 *
 * Gọi `NhanhModule::instance()` một lần trong `Core\Loader` là đủ; module tự
 * đăng ký post type, REST route, cron và trang cấu hình.
 *
 * @package MaxPharmacy\ZaloLogin\Core
 */
final class NhanhModule
{
    private static ?NhanhModule $instance = null;

    /** Các option riêng của module, đọc qua Config::get(). */
    public const CONFIG_KEYS = [
        'nhanh_app_id',
        'nhanh_business_id',
        'nhanh_access_token',
        'nhanh_depot_id',
        // 1 = dùng bảng giá sẵn có của Nhanh.vn, 2 = tài khoản riêng của shop.
        'nhanh_carrier_type',
        'nhanh_transfer_account_id',
        'ship_from_city_id',
        'ship_from_district_id',
        'ship_from_ward_id',
        'ship_from_address',
        'default_item_weight',
        'order_source_name',
    ];

    private function __construct()
    {
        add_action('init', [$this, 'registerOrderPostType']);
        add_action('mnp_refresh_catalog_cache', [$this, 'refreshCatalogCache']);

        Nhanh::instance();
        CatalogRest::instance();
        OrderRest::instance();
        AuthRest::instance();

        if (is_admin()) {
            NhanhSettings::instance();
        }
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
     * Post type lưu đơn đặt từ Mini App.
     *
     * Không public: đơn hàng không được xuất hiện ở front-end hay sitemap.
     * Nhân viên xem qua trang quản trị; nguồn xử lý chính vẫn là Nhanh.vn.
     */
    public function registerOrderPostType(): void
    {
        register_post_type(OrderRest::POST_TYPE, [
            'labels'          => [
                'name'          => __('Đơn Mini App', 'max-zalo-login'),
                'singular_name' => __('Đơn Mini App', 'max-zalo-login'),
                'menu_name'     => __('Đơn Mini App', 'max-zalo-login'),
            ],
            'public'          => false,
            'show_ui'         => true,
            'show_in_menu'    => true,
            'show_in_rest'    => false,
            'menu_icon'       => 'dashicons-cart',
            'capability_type' => 'post',
            'map_meta_cap'    => true,
            'supports'        => ['title', 'author'],
            'has_archive'     => false,
            'rewrite'         => false,
            'query_var'       => false,
        ]);
    }

    /**
     * Làm mới cache danh mục + thương hiệu.
     *
     * Chạy nền lúc 3h sáng để khách đầu tiên trong ngày không phải chờ. Nếu
     * chỉ dựa vào cache hết hạn, người mở app đầu tiên sẽ gánh toàn bộ thời
     * gian gọi API.
     */
    public function refreshCatalogCache(): void
    {
        $nhanh = Nhanh::instance();

        $nhanh->categories(true);
        $nhanh->brands(true);
    }

    /**
     * Gọi từ hook activation của plugin.
     */
    public static function activate(): void
    {
        if (!wp_next_scheduled('mnp_refresh_catalog_cache')) {
            // 3h sáng giờ Việt Nam.
            wp_schedule_event(
                strtotime('tomorrow 03:00', current_time('timestamp')),
                'daily',
                'mnp_refresh_catalog_cache'
            );
        }

        $defaults = [
            'nhanh_carrier_type'  => 1,
            'default_item_weight' => 200,
            'order_source_name'   => 'Zalo Mini App',
        ];

        foreach ($defaults as $key => $value) {
            add_option('mzl_' . $key, $value);
        }
    }

    /**
     * Gọi từ hook deactivation của plugin.
     */
    public static function deactivate(): void
    {
        wp_clear_scheduled_hook('mnp_refresh_catalog_cache');
    }
}
