<?php

namespace MaxPharmacy\ZaloLogin\Services;

use MaxPharmacy\ZaloLogin\Core\Config;
use MaxPharmacy\ZaloLogin\Core\Logger;

defined('ABSPATH') || exit;

/**
 * Nhanh.vn Open API Client — version 3.0
 *
 * Khác biệt so với v2.0 (đừng nhầm khi đọc tài liệu cũ):
 *
 *  - URL:     https://pos.open.nhanh.vn/v3.0/{module}/{function}?appId=..&businessId=..
 *  - Header:  Authorization: {accessToken}   (KHÔNG có tiền tố "Bearer")
 *  - Body:    JSON raw {"filters":{...},"paginator":{...}}, không còn form-data.
 *  - Phân trang: cursor `paginator.next`, không còn page/totalPages.
 *  - Địa chỉ: dùng cityId/districtId/wardId, không còn truyền tên.
 *  - Có endpoint thương hiệu riêng (/product/brand) — v2 không có.
 *
 * Client này KHÔNG được gọi từ Mini App. `accessToken` là bí mật cấp doanh
 * nghiệp; lộ ra là lộ toàn bộ kho hàng, khách hàng và đơn hàng.
 *
 * @see https://apidocs.nhanh.vn/v3
 *
 * @package MaxPharmacy\ZaloLogin\Services
 */
final class Nhanh
{
    private static ?Nhanh $instance = null;

    private const BASE_URL     = 'https://pos.open.nhanh.vn/v3.0';
    private const CACHE_PREFIX = 'mnp_n3_';

    /** Transient đánh dấu đang bị rate limit (ERR_429). */
    private const RATE_LIMIT_KEY = 'mnp_n3_ratelimited';

    /** Trạng thái sản phẩm: 2 = Đang bán (hiện trên website). */
    private const STATUS_SELLING = 2;

    /** Địa chỉ 3 cấp. Nhanh.vn khuyến cáo dùng v1 cho tới khi có thông báo mới. */
    private const LOCATION_VERSION = 'v1';

    private function __construct()
    {
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

    /*
    |--------------------------------------------------------------------------
    | Danh mục
    |--------------------------------------------------------------------------
    */

    /**
     * Cây danh mục sản phẩm.
     *
     * v3 trả danh mục PHẲNG (chỉ có parentId), khác v2 lồng sẵn qua `childs`.
     * Ta phải tự dựng cây. Cache 24h theo khuyến cáo của Nhanh.vn.
     *
     * @return array Danh sách danh mục gốc, mỗi phần tử có key `children`.
     */
    public function categories(bool $force = false): array
    {
        if (!$force) {
            $cached = $this->cacheGet('categories');

            if (is_array($cached)) {
                return $cached;
            }
        }

        $rows = $this->collectAll('product', 'category', ['status' => 1], 100);

        $flat = [];

        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);

            if ($id <= 0) {
                continue;
            }

            $flat[$id] = [
                'id'       => $id,
                'parentId' => (int) ($row['parentId'] ?? 0),
                'code'     => (string) ($row['code'] ?? ''),
                'name'     => (string) ($row['name'] ?? ''),
                'image'    => (string) ($row['image'] ?? ''),
                'order'    => (int) ($row['order'] ?? 0),
                'children' => [],
            ];
        }

        $tree = $this->buildTree($flat);

        $this->cacheSet('categories', $tree, DAY_IN_SECONDS);

        return $tree;
    }

    /**
     * Dựng cây từ danh sách phẳng.
     *
     * Danh mục có parentId trỏ tới một id không tồn tại (đã bị ẩn hoặc xoá)
     * được coi là danh mục gốc, thay vì bị mất khỏi kết quả.
     */
    private function buildTree(array $flat): array
    {
        $roots = [];

        foreach ($flat as $id => $node) {
            $parentId = $node['parentId'];

            if ($parentId > 0 && isset($flat[$parentId])) {
                $flat[$parentId]['children'][] = &$flat[$id];
            } else {
                $roots[] = &$flat[$id];
            }
        }
        unset($node);

        $sort = static function (array &$nodes) use (&$sort): void {
            usort($nodes, static fn ($a, $b) => [$a['order'], $a['name']] <=> [$b['order'], $b['name']]);

            foreach ($nodes as &$child) {
                if (!empty($child['children'])) {
                    $sort($child['children']);
                }
            }
        };

        $sort($roots);

        // json_encode/decode để cắt toàn bộ reference còn sót lại từ vòng lặp trên.
        return json_decode((string) wp_json_encode($roots), true) ?: [];
    }

    /*
    |--------------------------------------------------------------------------
    | Thương hiệu
    |--------------------------------------------------------------------------
    */

    /**
     * Danh sách thương hiệu.
     *
     * v3 có endpoint riêng nên không phải quét toàn bộ sản phẩm như v2 nữa.
     * Nhanh.vn không lưu logo thương hiệu — nhà thuốc tự map qua option
     * `mnp_brand_logos` dạng [brandId => url].
     *
     * @return array<int,array{id:int,name:string,logo:string}>
     */
    public function brands(bool $force = false): array
    {
        if (!$force) {
            $cached = $this->cacheGet('brands');

            if (is_array($cached)) {
                return $cached;
            }
        }

        $rows  = $this->collectAll('product', 'brand', ['status' => 1], 100);
        $logos = (array) get_option('mnp_brand_logos', []);

        $brands = [];

        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);

            if ($id <= 0) {
                continue;
            }

            $brands[] = [
                'id'       => $id,
                'parentId' => (int) ($row['parentId'] ?? 0),
                'code'     => (string) ($row['code'] ?? ''),
                'name'     => (string) ($row['name'] ?? ''),
                'logo'     => (string) ($logos[$id] ?? ''),
            ];
        }

        usort($brands, static fn ($a, $b) => strcasecmp($a['name'], $b['name']));

        $this->cacheSet('brands', $brands, DAY_IN_SECONDS);

        return $brands;
    }

    /** Bảng tra brandId => tên, để gắn tên thương hiệu vào sản phẩm. */
    private function brandNames(): array
    {
        static $map = null;

        if ($map === null) {
            $map = [];

            foreach ($this->brands() as $brand) {
                $map[$brand['id']] = $brand['name'];
            }
        }

        return $map;
    }

    /*
    |--------------------------------------------------------------------------
    | Sản phẩm
    |--------------------------------------------------------------------------
    */

    /**
     * Danh sách sản phẩm.
     *
     * CHÚ Ý về phân trang: v3 dùng cursor. Client gửi `next` nhận được từ lần
     * gọi trước; không có khái niệm "trang số 5". Response trả `next = null`
     * nghĩa là hết dữ liệu.
     *
     * CHÚ Ý về sắp xếp: v3 chỉ hỗ trợ sort theo `id`. Không sắp xếp được theo
     * giá hay tên ở phía Nhanh.vn.
     *
     * @param array $args limit, next, categoryId, brandId, keyword, ids, priceFrom, priceTo
     *
     * @return array{products:array,next:mixed}
     */
    public function products(array $args = []): array
    {
        $limit = min(100, max(1, (int) ($args['limit'] ?? 20)));

        $filters = ['status' => [self::STATUS_SELLING]];

        if (!empty($args['ids'])) {
            $filters['ids'] = array_map('intval', array_slice((array) $args['ids'], 0, 100));
        }

        if (!empty($args['categoryId'])) {
            $filters['categoryIds'] = [(int) $args['categoryId']];
        }

        if (!empty($args['brandId'])) {
            $filters['brandIds'] = [(int) $args['brandId']];
        }

        if (!empty($args['keyword'])) {
            $filters['name'] = (string) $args['keyword'];
        }

        if (!empty($args['priceFrom']) || !empty($args['priceTo'])) {
            $filters['price'] = [
                'from' => (int) ($args['priceFrom'] ?? 0),
                'to'   => (int) ($args['priceTo'] ?? 0),
            ];
        }

        $paginator = [
            'size' => $limit,
            'sort' => ['id' => ($args['sort'] ?? 'newest') === 'oldest' ? 'asc' : 'desc'],
        ];

        if (!empty($args['next'])) {
            $paginator['next'] = $args['next'];
        }

        $res = $this->call('product', 'list', $filters, $paginator);

        if (!$res['success']) {
            return ['products' => [], 'next' => null];
        }

        return [
            'products' => array_values(array_map(
                [$this, 'mapProduct'],
                (array) $res['data']
            )),
            'next'     => $res['next'],
        ];
    }

    /**
     * Chi tiết một sản phẩm.
     *
     * Dùng /product/list với filter `ids` thay vì /product/detail: cùng một
     * cấu trúc dữ liệu nên chỉ phải bảo trì một hàm map duy nhất.
     */
    public function product(int $productId): ?array
    {
        $res = $this->products(['ids' => [$productId], 'limit' => 1]);

        return $res['products'][0] ?? null;
    }

    /**
     * Lấy nhiều sản phẩm theo ID (tối đa 100). Dùng khi kiểm tra giỏ hàng —
     * một request thay vì N request.
     *
     * @return array<int,array> Khoá là ID sản phẩm.
     */
    public function productsByIds(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));

        if (empty($ids)) {
            return [];
        }

        $found = [];

        foreach (array_chunk($ids, 100) as $chunk) {
            $res = $this->products(['ids' => $chunk, 'limit' => 100]);

            foreach ($res['products'] as $product) {
                $found[$product['id']] = $product;
            }
        }

        return $found;
    }

    /*
    |--------------------------------------------------------------------------
    | Địa chỉ & vận chuyển
    |--------------------------------------------------------------------------
    */

    /**
     * Tỉnh/thành, quận/huyện, phường/xã.
     *
     * @param string   $type     CITY|DISTRICT|WARD
     * @param int|null $parentId Bắt buộc với DISTRICT và WARD.
     */
    public function locations(string $type, ?int $parentId = null): array
    {
        $type     = strtoupper($type);
        $cacheKey = "loc_{$type}_" . ($parentId ?? 0);
        $cached   = $this->cacheGet($cacheKey);

        if (is_array($cached)) {
            return $cached;
        }

        $filters = [
            'locationVersion' => self::LOCATION_VERSION,
            'type'            => $type,
        ];

        if ($parentId !== null) {
            $filters['parentId'] = $parentId;
        }

        $res = $this->call('shipping', 'location', $filters);

        if (!$res['success']) {
            return [];
        }

        $list = array_values(array_map(
            static fn ($l) => [
                'id'   => (int) ($l['id'] ?? 0),
                'name' => (string) ($l['name'] ?? ''),
            ],
            (array) $res['data']
        ));

        $this->cacheSet($cacheKey, $list, WEEK_IN_SECONDS);

        return $list;
    }

    /**
     * Tính phí vận chuyển.
     *
     * v3 nhận ID địa giới và BẮT BUỘC `shippingWeight` — không còn tuỳ chọn
     * truyền productIds để Nhanh.vn tự cộng cân nặng như v2. Ta phải tự tính
     * từ `shipping.weight` khai báo trên từng sản phẩm.
     *
     * @param array $to    ['cityId'=>int,'districtId'=>int,'wardId'=>int,'address'=>string]
     * @param array $items [['productId'=>int,'quantity'=>int], ...]
     *
     * @return array Danh sách dịch vụ vận chuyển đã chuẩn hoá.
     */
    public function shippingFee(array $to, int $subtotal, int $codMoney, array $items): array
    {
        $weight = $this->totalWeight($items);

        $filters = [
            // 1 = dùng bảng giá sẵn có của Nhanh.vn.
            'type'           => (int) Config::get('nhanh_carrier_type', 1),
            'shippingWeight' => $weight,
            'price'          => max(0, $subtotal),
            'totalCod'       => max(0, $codMoney),
            'shippingFrom'   => [
                'cityId'          => (int) Config::get('ship_from_city_id', 0),
                'districtId'      => (int) Config::get('ship_from_district_id', 0),
                'wardId'          => (int) Config::get('ship_from_ward_id', 0),
                'address'         => (string) Config::get('ship_from_address', ''),
                'locationVersion' => self::LOCATION_VERSION,
            ],
            'shippingTo'     => [
                'cityId'          => (int) ($to['cityId'] ?? 0),
                'districtId'      => (int) ($to['districtId'] ?? 0),
                'wardId'          => (int) ($to['wardId'] ?? 0),
                'address'         => (string) ($to['address'] ?? ''),
                'locationVersion' => self::LOCATION_VERSION,
            ],
        ];

        $depotId = (int) Config::get('nhanh_depot_id', 0);

        if ($depotId > 0) {
            $filters['depotId'] = $depotId;
        }

        $carrierIds = array_filter(array_map('intval', (array) get_option('mnp_carrier_ids', [])));

        if (!empty($carrierIds)) {
            $filters['carrier'] = ['ids' => array_values($carrierIds)];
        }

        $res = $this->call('shipping', 'fee', $filters);

        if (!$res['success']) {
            Logger::warning('Nhanh v3 shippingFee failed.', $res);

            return [];
        }

        $services = [];

        foreach ((array) $res['data'] as $s) {
            $shipFee     = (int) round((float) ($s['shipFee'] ?? 0));
            $codFee      = (int) round((float) ($s['codFee'] ?? 0));
            $declaredFee = (int) round((float) ($s['declaredFee'] ?? 0));

            // customerShipFee do Nhanh.vn gợi ý; nếu trống thì tự cộng.
            $customerFee = (int) round((float) ($s['customerShipFee'] ?? 0));

            $services[] = [
                'carrierId'   => (int) ($s['carrier']['id'] ?? 0),
                'carrierName' => (string) ($s['carrier']['name'] ?? ($s['carrierName'] ?? '')),
                'accountId'   => (int) ($s['carrier']['accountId'] ?? 0),
                'shopId'      => (string) ($s['carrier']['shopId'] ?? ''),
                'logo'        => (string) ($s['logo'] ?? ''),
                'serviceId'   => (int) ($s['service']['id'] ?? 0),
                'serviceCode' => (string) ($s['service']['code'] ?? ''),
                'serviceName' => (string) ($s['service']['name'] ?? ''),
                'description' => (string) ($s['service']['description'] ?? ''),
                'shipFee'     => $shipFee,
                'codFee'      => $codFee,
                'declaredFee' => $declaredFee,
                'totalFee'    => $customerFee > 0 ? $customerFee : $shipFee + $codFee + $declaredFee,
            ];
        }

        // Rẻ nhất lên đầu — khách gần như luôn chọn theo giá.
        usort($services, static fn ($a, $b) => $a['totalFee'] <=> $b['totalFee']);

        return $services;
    }

    /**
     * Tổng trọng lượng đơn hàng (gram).
     *
     * Sản phẩm chưa khai báo cân nặng sẽ dùng mức mặc định để phí ship không
     * bị tính bằng 0 — hãng vận chuyển sẽ từ chối đơn nặng 0 gram.
     */
    private function totalWeight(array $items): int
    {
        $fallback = (int) Config::get('default_item_weight', 200);

        $products = $this->productsByIds(array_column($items, 'productId'));

        $total = 0;

        foreach ($items as $item) {
            $id       = (int) ($item['productId'] ?? 0);
            $quantity = max(0, (int) ($item['quantity'] ?? 0));
            $weight   = (int) ($products[$id]['shippingWeight'] ?? 0);

            $total += ($weight > 0 ? $weight : $fallback) * $quantity;
        }

        // Nhanh.vn giới hạn 100kg / đơn.
        return min(100000, max($fallback, $total));
    }

    /*
    |--------------------------------------------------------------------------
    | Đơn hàng
    |--------------------------------------------------------------------------
    */

    /**
     * Đẩy đơn hàng sang Nhanh.vn (/v3.0/order/add).
     *
     * v3 dùng cấu trúc lồng nhau: info / channel / shippingAddress / carrier /
     * products / payment. `channel.appOrderId` là khoá chống trùng — Nhanh.vn
     * chặn theo appId + appOrderId, nên gọi lại cùng một đơn sẽ bị từ chối
     * thay vì tạo đơn thứ hai.
     *
     * @return array{success:bool,orderId?:int,trackingUrl?:string,message?:string}
     */
    public function createOrder(array $order): array
    {
        $products = [];

        foreach ($order['items'] as $item) {
            $products[] = [
                'id'       => (int) $item['productId'],
                'price'    => (int) $item['price'],
                'quantity' => (int) $item['quantity'],
            ];
        }

        $carrierType = (int) Config::get('nhanh_carrier_type', 1);

        $carrier = [
            'sendCarrierType' => $carrierType,
            'id'              => (int) $order['carrierId'],
            'customerShipFee' => (int) $order['customerShipFee'],
        ];

        if ($carrierType === 1) {
            $carrier['serviceId'] = (int) $order['carrierServiceId'];
        } else {
            $carrier['serviceCode'] = (string) ($order['carrierServiceCode'] ?? '');
            $carrier['accountId']   = (int) ($order['carrierAccountId'] ?? 0);

            if (!empty($order['carrierShopId'])) {
                $carrier['shopId'] = (int) $order['carrierShopId'];
            }
        }

        $info = [
            // 1 = Giao hàng tận nhà.
            'type'        => 1,
            // 54 = Đơn mới.
            'status'      => 54,
            'description' => (string) ($order['note'] ?? ''),
        ];

        $depotId = (int) Config::get('nhanh_depot_id', 0);

        if ($depotId > 0) {
            $info['depotId'] = $depotId;
        }

        $address = $order['address'];

        $payload = [
            'info'            => $info,
            'channel'         => [
                'appOrderId' => (string) $order['id'],
                'sourceName' => (string) Config::get('order_source_name', 'Zalo Mini App'),
            ],
            'shippingAddress' => [
                'name'            => (string) $address['name'],
                'mobile'          => (string) $address['phone'],
                'email'           => (string) ($address['email'] ?? ''),
                'address'         => (string) $address['address'],
                'cityId'          => (int) $address['cityId'],
                'districtId'      => (int) $address['districtId'],
                'wardId'          => (int) ($address['wardId'] ?? 0),
                'locationVersion' => self::LOCATION_VERSION,
            ],
            'carrier'         => $carrier,
            'products'        => $products,
            'payment'         => [],
        ];

        // Khách đã trả trước: ghi nhận tiền chuyển khoản để shipper không thu lại.
        if (!empty($order['paid'])) {
            $payload['payment']['transferAmount'] = (int) $order['total'];

            $accountId = (int) Config::get('nhanh_transfer_account_id', 0);

            if ($accountId > 0) {
                $payload['payment']['transferAccountId'] = $accountId;
            }
        }

        if (!empty($order['couponCode'])) {
            $payload['payment']['couponCode'] = (string) $order['couponCode'];
        }

        // Nhanh.vn KHÔNG tự tính tiền giảm từ couponCode — phải tự truyền số tiền.
        if (!empty($order['discount'])) {
            $payload['payment']['discountAmount'] = (int) $order['discount'];
            $payload['payment']['discountType']   = 'cash';
        }

        $res = $this->call('order', 'add', null, null, $payload);

        if (!$res['success']) {
            Logger::error('Nhanh v3 createOrder failed.', [
                'order_id'  => $order['id'],
                'errorCode' => $res['errorCode'] ?? '',
                'messages'  => $res['messages'] ?? [],
            ]);

            return ['success' => false, 'message' => $res['message']];
        }

        return [
            'success'     => true,
            'orderId'     => (int) ($res['data']['id'] ?? 0),
            'trackingUrl' => (string) ($res['data']['trackingUrl'] ?? ''),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Chuẩn hoá dữ liệu
    |--------------------------------------------------------------------------
    */

    /**
     * Chuẩn hoá sản phẩm v3 về cấu trúc phẳng cho Mini App.
     *
     * Cắt bỏ prices.import, prices.avgCost, prices.wholesale và tồn từng kho —
     * đó là dữ liệu nội bộ, tuyệt đối không để lọt ra client.
     */
    private function mapProduct(array $p): array
    {
        $prices = (array) ($p['prices'] ?? []);
        $retail = (float) ($prices['retail'] ?? 0);
        $vat    = (float) ($prices['retailVat'] ?? 0);

        // priceVatMode 2 = giá chưa gồm VAT. Giá hiển thị cho khách phải là
        // giá cuối cùng phải trả, nếu không tổng tiền ở giỏ sẽ lệch với đơn.
        $priceVatMode = (int) ($p['priceVatMode'] ?? 2);
        $price        = $priceVatMode === 2 ? $retail + $vat : $retail;

        $images = (array) ($p['images'] ?? []);
        $avatar = (string) ($images['avatar'] ?? '');
        $others = array_values(array_filter(array_map('strval', (array) ($images['others'] ?? []))));

        if ($avatar !== '' && !in_array($avatar, $others, true)) {
            array_unshift($others, $avatar);
        }

        $brandId = (int) ($p['brandId'] ?? 0);

        return [
            'id'             => (int) ($p['id'] ?? 0),
            'code'           => (string) ($p['code'] ?? ''),
            'barcode'        => (string) ($p['barcode'] ?? ''),
            'name'           => (string) ($p['name'] ?? ''),
            'price'          => (int) round($price),
            'oldPrice'       => (int) round((float) ($prices['old'] ?? 0)),
            'priceVatMode'   => $priceVatMode,
            'unit'           => (string) ($p['units']['name'] ?? ''),
            'image'          => $avatar,
            'images'         => $others,
            'categoryId'     => (int) ($p['categoryId'] ?? 0),
            'brandId'        => $brandId,
            'brandName'      => (string) ($this->brandNames()[$brandId] ?? ''),
            'countryName'    => (string) ($p['countryName'] ?? ''),
            'shippingWeight' => (int) round((float) ($p['shipping']['weight'] ?? 0)),
            'available'      => (int) floor((float) ($p['inventory']['available'] ?? 0)),
            'warrantyMonth'  => (int) ($p['warranty']['month'] ?? 0),
            'attributes'     => array_values(array_map(
                static fn ($a) => [
                    'name'  => (string) ($a['name'] ?? ''),
                    'value' => (string) ($a['value'] ?? ''),
                ],
                (array) ($p['attributes'] ?? [])
            )),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | HTTP
    |--------------------------------------------------------------------------
    */

    /**
     * Gọi hết mọi trang của một endpoint dạng danh sách.
     *
     * Chỉ dùng cho dữ liệu nhỏ và ít đổi (danh mục, thương hiệu). Tuyệt đối
     * không dùng cho sản phẩm — rate limit là 150 request/30 giây và Nhanh.vn
     * khoá app nếu quét liên tục.
     */
    private function collectAll(
        string $module,
        string $function,
        array $filters,
        int $size,
        int $maxPages = 50
    ): array {
        $rows = [];
        $next = null;
        $page = 0;

        do {
            $paginator = ['size' => $size];

            if ($next !== null && $next !== '') {
                $paginator['next'] = $next;
            }

            $res = $this->call($module, $function, $filters, $paginator);

            if (!$res['success']) {
                break;
            }

            $rows = array_merge($rows, (array) $res['data']);
            $next = $res['next'];
            $page++;
        } while (!empty($next) && $page < $maxPages);

        return $rows;
    }

    /**
     * Gọi Nhanh.vn Open API v3.0.
     *
     * @param string     $module    product|order|shipping|customer|business
     * @param string     $function  list|category|brand|add|fee|location...
     * @param array|null $filters   Nội dung `filters`.
     * @param array|null $paginator Nội dung `paginator`.
     * @param array|null $rawBody   Nếu có, dùng thẳng làm body (order/add).
     *
     * @return array{success:bool,data?:mixed,next?:mixed,message:string,errorCode?:string,messages?:mixed}
     */
    private function call(
        string $module,
        string $function,
        ?array $filters = null,
        ?array $paginator = null,
        ?array $rawBody = null
    ): array {
        $appId       = (string) Config::get('nhanh_app_id', '');
        $businessId  = (string) Config::get('nhanh_business_id', '');
        $accessToken = (string) Config::get('nhanh_access_token', '');

        if ($appId === '' || $businessId === '' || $accessToken === '') {
            Logger::error('Nhanh.vn credentials are not configured.');

            return ['success' => false, 'message' => 'Chưa cấu hình kết nối Nhanh.vn.'];
        }

        // Đang bị khoá rate limit thì dừng luôn, gọi tiếp chỉ kéo dài thời gian khoá.
        $lockedUntil = (int) get_transient(self::RATE_LIMIT_KEY);

        if ($lockedUntil > time()) {
            return [
                'success' => false,
                'message' => 'Hệ thống đang bận, vui lòng thử lại sau ít phút.',
            ];
        }

        $url = sprintf(
            '%s/%s/%s?appId=%s&businessId=%s',
            self::BASE_URL,
            rawurlencode($module),
            rawurlencode($function),
            rawurlencode($appId),
            rawurlencode($businessId)
        );

        if ($rawBody !== null) {
            $body = $rawBody;
        } else {
            $body = ['filters' => (object) ($filters ?? [])];

            if ($paginator !== null) {
                $body['paginator'] = $paginator;
            }
        }

        Logger::debug('Nhanh v3 request.', ['url' => $url, 'body' => $body]);

        $response = wp_remote_post($url, [
            'timeout' => 30,
            'headers' => [
                // Không có tiền tố "Bearer" — đây là yêu cầu của Nhanh.vn v3.
                'Authorization' => $accessToken,
                'Content-Type'  => 'application/json',
                'Accept'        => 'application/json',
            ],
            'body'    => wp_json_encode($body, JSON_UNESCAPED_UNICODE),
        ]);

        if (is_wp_error($response)) {
            Logger::error('Nhanh v3 transport error.', [
                'url'     => $url,
                'message' => $response->get_error_message(),
            ]);

            return [
                'success' => false,
                'message' => 'Không kết nối được Nhanh.vn.',
            ];
        }

        $json = json_decode((string) wp_remote_retrieve_body($response), true);

        if (!is_array($json)) {
            Logger::error('Nhanh v3 returned invalid JSON.', ['url' => $url]);

            return [
                'success' => false,
                'message' => 'Nhanh.vn trả dữ liệu không hợp lệ.',
            ];
        }

        if ((int) ($json['code'] ?? 0) !== 1) {
            return $this->handleError($json, $url);
        }

        return [
            'success' => true,
            'data'    => $json['data'] ?? [],
            'next'    => $json['paginator']['next'] ?? null,
            'message' => '',
        ];
    }

    /**
     * Xử lý response lỗi. Riêng ERR_429 thì ghi nhớ mốc mở khoá và ngừng gọi
     * cho tới lúc đó — Nhanh.vn tăng thời gian khoá nếu vẫn tiếp tục gọi.
     */
    private function handleError(array $json, string $url): array
    {
        $errorCode = (string) ($json['errorCode'] ?? '');

        if ($errorCode === 'ERR_429' || $errorCode === 'ERR_EXCEEDED_RATE_LIMIT') {
            $unlockedAt = (int) ($json['data']['unlockedAt'] ?? (time() + 60));

            set_transient(
                self::RATE_LIMIT_KEY,
                $unlockedAt,
                max(10, $unlockedAt - time())
            );

            Logger::error('Nhanh v3 rate limited.', [
                'url'        => $url,
                'unlockedAt' => $unlockedAt,
            ]);

            return [
                'success' => false,
                'message' => 'Hệ thống đang bận, vui lòng thử lại sau ít phút.',
            ];
        }

        Logger::warning('Nhanh v3 business error.', [
            'url'       => $url,
            'errorCode' => $errorCode,
            'messages'  => $json['messages'] ?? ($json['message'] ?? ''),
        ]);

        return [
            'success'   => false,
            'errorCode' => $errorCode,
            'messages'  => $json['messages'] ?? [],
            'message'   => $this->readableMessage($json),
        ];
    }

    /**
     * `messages` của v3 có thể là string hoặc map field => lỗi. Gộp lại thành
     * một câu đọc được, vì thông báo này hiển thị cho khách hàng.
     */
    private function readableMessage(array $json): string
    {
        $messages = $json['messages'] ?? ($json['message'] ?? null);

        if (is_string($messages) && $messages !== '') {
            return $messages;
        }

        if (is_array($messages) && !empty($messages)) {
            $parts = [];

            foreach ($messages as $key => $value) {
                $parts[] = is_string($key) ? "{$key}: {$value}" : (string) $value;
            }

            return implode('; ', $parts);
        }

        return 'Nhanh.vn từ chối yêu cầu.';
    }

    /*
    |--------------------------------------------------------------------------
    | Cache
    |--------------------------------------------------------------------------
    */

    private function cacheGet(string $key): mixed
    {
        return get_transient(self::CACHE_PREFIX . $key);
    }

    private function cacheSet(string $key, mixed $data, int $expire): bool
    {
        return set_transient(self::CACHE_PREFIX . $key, $data, $expire);
    }

    /** Xoá toàn bộ cache. Gọi khi nhận webhook sản phẩm/tồn kho từ Nhanh.vn. */
    public function flushCache(): void
    {
        global $wpdb;

        $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
                '_transient_' . self::CACHE_PREFIX . '%',
                '_transient_timeout_' . self::CACHE_PREFIX . '%'
            )
        );
    }
}
