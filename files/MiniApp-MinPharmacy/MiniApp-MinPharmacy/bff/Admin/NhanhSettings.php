<?php

namespace MaxPharmacy\ZaloLogin\Admin;

use MaxPharmacy\ZaloLogin\Core\NhanhModule;
use MaxPharmacy\ZaloLogin\Services\Nhanh;

defined('ABSPATH') || exit;

/**
 * Trang cấu hình kết nối Nhanh.vn.
 *
 * Dùng chung mô hình option `mzl_{key}` với phần đăng nhập Zalo, nên các giá
 * trị ở đây đọc được bằng `Config::get('nhanh_app_id')` như mọi setting khác.
 *
 * @package MaxPharmacy\ZaloLogin\Admin
 */
final class NhanhSettings
{
    private const MENU_SLUG   = 'mnp-nhanh';
    private const OPTION_GROUP = 'mnp_nhanh_settings';

    private static ?NhanhSettings $instance = null;

    private function __construct()
    {
        add_action('admin_menu', [$this, 'registerMenu']);
        add_action('admin_init', [$this, 'registerSettings']);
        add_action('admin_post_mnp_flush_cache', [$this, 'handleFlushCache']);
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

    public function registerMenu(): void
    {
        add_submenu_page(
            'max-zalo-login',
            __('Kết nối Nhanh.vn', 'max-zalo-login'),
            __('Kết nối Nhanh.vn', 'max-zalo-login'),
            'manage_options',
            self::MENU_SLUG,
            [$this, 'renderPage']
        );
    }

    public function registerSettings(): void
    {
        foreach (NhanhModule::CONFIG_KEYS as $key) {
            register_setting(self::OPTION_GROUP, 'mzl_' . $key, [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => '',
            ]);
        }

        register_setting(self::OPTION_GROUP, 'mnp_carrier_ids', [
            'sanitize_callback' => [$this, 'sanitizeIdList'],
            'default'           => [],
        ]);

        register_setting(self::OPTION_GROUP, 'mnp_featured_product_ids', [
            'sanitize_callback' => [$this, 'sanitizeIdList'],
            'default'           => [],
        ]);
    }

    /** Nhận chuỗi "5, 8, 24" từ ô nhập, lưu thành mảng số nguyên. */
    public function sanitizeIdList(mixed $value): array
    {
        if (is_array($value)) {
            $parts = $value;
        } else {
            $parts = preg_split('/[\s,]+/', (string) $value) ?: [];
        }

        return array_values(array_filter(array_map('intval', $parts)));
    }

    public function handleFlushCache(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die(__('Bạn không có quyền thực hiện thao tác này.', 'max-zalo-login'));
        }

        check_admin_referer('mnp_flush_cache');

        Nhanh::instance()->flushCache();

        wp_safe_redirect(
            add_query_arg('flushed', '1', admin_url('admin.php?page=' . self::MENU_SLUG))
        );
        exit;
    }

    public function renderPage(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $fields = [
            'nhanh_app_id'              => ['App ID', 'Lấy ở open.nhanh.vn → Danh sách app.'],
            'nhanh_business_id'         => ['Business ID', 'Nhanh.vn trả về cùng lúc với accessToken.'],
            'nhanh_access_token'        => ['Access Token', 'Hạn dùng 1 năm, Nhanh.vn chưa hỗ trợ refresh. Đặt lịch nhắc gia hạn.'],
            'nhanh_depot_id'            => ['Kho hàng (depotId)', 'Bắt buộc khi dùng bảng giá vận chuyển của Nhanh.vn.'],
            'nhanh_carrier_type'        => ['Hình thức vận chuyển', '1 = bảng giá của Nhanh.vn, 2 = tài khoản riêng của nhà thuốc.'],
            'nhanh_transfer_account_id' => ['Tài khoản nhận chuyển khoản', 'ID tài khoản kế toán, dùng khi khách trả trước.'],
            'ship_from_city_id'         => ['Kho gửi — Tỉnh/TP (ID)', 'ID lấy từ API địa chỉ của Nhanh.vn.'],
            'ship_from_district_id'     => ['Kho gửi — Quận/Huyện (ID)', ''],
            'ship_from_ward_id'         => ['Kho gửi — Phường/Xã (ID)', 'Bắt buộc với Giao hàng nhanh, J&T, SPX.'],
            'ship_from_address'         => ['Kho gửi — Địa chỉ', 'Số nhà, tên đường.'],
            'default_item_weight'       => ['Cân nặng mặc định (gram)', 'Áp dụng cho sản phẩm chưa khai cân nặng trên Nhanh.vn.'],
            'order_source_name'         => ['Tên nguồn đơn hàng', 'Hiện trong báo cáo nguồn đơn của Nhanh.vn.'],
        ];

        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Kết nối Nhanh.vn', 'max-zalo-login'); ?></h1>

            <?php if (isset($_GET['flushed'])) : ?>
                <div class="notice notice-success is-dismissible">
                    <p><?php esc_html_e('Đã xoá cache. Lần gọi tiếp theo sẽ lấy dữ liệu mới từ Nhanh.vn.', 'max-zalo-login'); ?></p>
                </div>
            <?php endif; ?>

            <form method="post" action="options.php">
                <?php settings_fields(self::OPTION_GROUP); ?>

                <table class="form-table" role="presentation">
                    <?php foreach ($fields as $key => [$label, $hint]) : ?>
                        <tr>
                            <th scope="row">
                                <label for="mzl_<?php echo esc_attr($key); ?>">
                                    <?php echo esc_html($label); ?>
                                </label>
                            </th>
                            <td>
                                <input
                                    type="<?php echo $key === 'nhanh_access_token' ? 'password' : 'text'; ?>"
                                    id="mzl_<?php echo esc_attr($key); ?>"
                                    name="mzl_<?php echo esc_attr($key); ?>"
                                    value="<?php echo esc_attr((string) get_option('mzl_' . $key, '')); ?>"
                                    class="regular-text"
                                    autocomplete="off"
                                />
                                <?php if ($hint !== '') : ?>
                                    <p class="description"><?php echo esc_html($hint); ?></p>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>

                    <tr>
                        <th scope="row">
                            <label for="mnp_carrier_ids"><?php esc_html_e('Giới hạn hãng vận chuyển', 'max-zalo-login'); ?></label>
                        </th>
                        <td>
                            <input
                                type="text"
                                id="mnp_carrier_ids"
                                name="mnp_carrier_ids"
                                value="<?php echo esc_attr(implode(', ', (array) get_option('mnp_carrier_ids', []))); ?>"
                                class="regular-text"
                            />
                            <p class="description">
                                <?php esc_html_e('Danh sách ID cách nhau bởi dấu phẩy. Để trống nếu dùng tất cả. VD: 5 = Giao hàng nhanh, 8 = Giao hàng tiết kiệm, 24 = J&T.', 'max-zalo-login'); ?>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="mnp_featured_product_ids"><?php esc_html_e('Sản phẩm nổi bật', 'max-zalo-login'); ?></label>
                        </th>
                        <td>
                            <input
                                type="text"
                                id="mnp_featured_product_ids"
                                name="mnp_featured_product_ids"
                                value="<?php echo esc_attr(implode(', ', (array) get_option('mnp_featured_product_ids', []))); ?>"
                                class="large-text"
                            />
                            <p class="description">
                                <?php esc_html_e('ID sản phẩm trên Nhanh.vn, cách nhau bởi dấu phẩy, theo đúng thứ tự muốn hiện ở trang chủ. API v3.0 đã bỏ cờ "sản phẩm hot" nên phải chọn thủ công.', 'max-zalo-login'); ?>
                            </p>
                        </td>
                    </tr>
                </table>

                <?php submit_button(); ?>
            </form>

            <hr />

            <h2><?php esc_html_e('Cache', 'max-zalo-login'); ?></h2>
            <p>
                <?php esc_html_e('Danh mục, thương hiệu và địa chỉ được cache để tránh vượt giới hạn 150 request/30 giây của Nhanh.vn. Xoá cache khi vừa đổi danh mục hoặc thêm thương hiệu mới.', 'max-zalo-login'); ?>
            </p>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="mnp_flush_cache" />
                <?php wp_nonce_field('mnp_flush_cache'); ?>
                <?php submit_button(__('Xoá cache ngay', 'max-zalo-login'), 'secondary', 'submit', false); ?>
            </form>
        </div>
        <?php
    }
}
