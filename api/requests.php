<?php
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']     ?? null;
$action = $_GET['action'] ?? null;

function mongo_doc($doc): array {
    if (!$doc) return [];
    $arr = (array)$doc;
    $arr['id'] = (string)($arr['_id'] ?? '');
    return $arr;
}

function get_approver_role($amount) {
    $levels = iterator_to_array(db()->approval_levels->find([], ['sort' => ['max_amount' => 1]]));
    foreach ($levels as $lvl) {
        if ($amount <= $lvl['max_amount']) return $lvl['role'];
    }
    return !empty($levels) ? end($levels)['role'] : 'ceo';
}

// GET /api/requests
if ($method === 'GET' && !$id) {
    $user = require_auth();
    $filter = [];
    if ($user['role'] !== 'admin') {
        $filter['$or'] = [
            ['requester_id' => $user['sub']],
            ['current_approver_role' => $user['role']],
            ['history.approver_id' => $user['sub']]
        ];
    }
    if (!empty($_GET['pending'])) {
        $filter['status'] = 'pending';
        if ($user['role'] !== 'admin') {
            $filter['current_approver_role'] = $user['role'];
            unset($filter['$or']);
        }
    }
    $rows = iterator_to_array(db()->requests->find($filter, ['sort' => ['created_at' => -1]]));
    json_ok(array_map('mongo_doc', $rows));
}

// POST /api/requests
if ($method === 'POST' && !$id) {
    $user = require_auth();
    $b = body();
    if (empty($b['title'])) json_err('title is required');
    if (empty($b['items']) || !is_array($b['items'])) json_err('at least one item is required');

    $items = array_map(fn($i) => [
        'name'     => trim($i['name']     ?? ''),
        'quantity' => max(1, intval($i['quantity'] ?? 1)),
        'brand'    => trim($i['brand']    ?? ''),
        'model'    => trim($i['model']    ?? ''),
    ], $b['items']);
    $items = array_values(array_filter($items, fn($i) => $i['name'] !== ''));
    if (empty($items)) json_err('at least one item with a name is required');

    $doc = [
        '_id'            => new_id(),
        'title'          => trim($b['title']),
        'description'    => $b['description'] ?? '',
        'items'          => $items,
        'category'       => $b['category'] ?? 'General',
        'requester_id'   => $user['sub'],
        'requester_name' => $user['name'],
        'department'     => $user['department'] ?? '',
        'status'         => 'pending',
        'current_approver_role' => get_approver_role(0),
        'history'        => [],
        'created_at'     => now_iso(),
        'updated_at'     => now_iso(),
    ];

    db()->requests->insertOne($doc);
    json_ok(mongo_doc($doc), 201);
}

// GET /api/requests/:id
if ($method === 'GET' && $id) {
    require_auth();
    $doc = db()->requests->findOne(['_id' => $id]);
    if (!$doc) json_err('Not found', 404);
    json_ok(mongo_doc($doc));
}

// POST /api/requests/:id/:action (approve/reject/cancel)
if ($method === 'POST' && $id && $action) {
    $user = require_auth();
    $doc = db()->requests->findOne(['_id' => $id]);
    if (!$doc) json_err('Not found', 404);

    if ($action === 'approve' || $action === 'reject') {
        if ($doc['status'] !== 'pending') json_err('Request is not pending');
        if ($user['role'] !== 'admin' && $doc['current_approver_role'] !== $user['role']) {
            json_err('Not authorized to act on this request', 403);
        }

        $b = body();
        $status = ($action === 'approve') ? 'approved' : 'rejected';
        $history_item = [
            'id'            => new_id(),
            'approver_id'   => $user['sub'],
            'approver_name' => $user['name'],
            'approver_role' => $user['role'],
            'action'        => $status,
            'comments'      => $b['comments'] ?? $b['comment'] ?? '',
            'created_at'    => now_iso(),
        ];
        db()->requests->updateOne(['_id' => $id], ['$set' => ['status' => $status, 'current_approver_role' => null, 'updated_at' => now_iso()], '$push' => ['history' => $history_item]]);
        json_ok(['success' => true]);
    }

    if ($action === 'cancel') {
        if ($doc['requester_id'] !== $user['sub'] && $user['role'] !== 'admin') json_err('Forbidden', 403);
        db()->requests->updateOne(['_id' => $id], ['$set' => ['status' => 'cancelled', 'updated_at' => now_iso()]]);
        json_ok(['success' => true]);
    }

    if ($action === 'comparison') {
        if (!in_array($user['role'], ['admin','ceo','department_head','manager'])) json_err('Forbidden', 403);
        if ($doc['status'] !== 'pending') json_err('Request is not pending');

        $b = body();
        if (empty($b['vendors']) || !is_array($b['vendors'])) json_err('vendors array is required');

        $vendors = array_slice(array_map(fn($v) => [
            'id'   => trim((string)($v['id']   ?? '')),
            'name' => trim((string)($v['name'] ?? '')),
        ], $b['vendors']), 0, 3);
        $vendors = array_values(array_filter($vendors, fn($v) => $v['id'] !== '' && $v['name'] !== ''));
        if (empty($vendors)) json_err('at least one vendor is required');

        $prices_raw = $b['prices'] ?? [];
        $items = (array)($doc['items'] ?? []);
        $vendor_count = count($vendors);

        $line_items = [];
        $totals = array_fill(0, $vendor_count, 0.0);

        foreach ($items as $item_idx => $item) {
            $vendor_prices = [];
            foreach ($vendors as $v_idx => $v) {
                $price = max(0.0, floatval($prices_raw[$item_idx][$v_idx] ?? 0));
                $vendor_prices[] = $price;
                $totals[$v_idx] += $price * intval($item['quantity'] ?? 1);
            }
            $line_items[] = [
                'name'          => $item['name'],
                'quantity'      => intval($item['quantity'] ?? 1),
                'vendor_prices' => $vendor_prices,
            ];
        }

        $cheapest_idx = 0;
        $min_total = INF;
        foreach ($totals as $i => $t) {
            if ($t > 0 && $t < $min_total) { $min_total = $t; $cheapest_idx = $i; }
        }

        $comparison = [
            'vendors'               => $vendors,
            'line_items'            => $line_items,
            'totals'                => $totals,
            'cheapest_vendor_index' => $cheapest_idx,
            'saved_by'              => $user['name'],
            'saved_at'              => now_iso(),
        ];

        db()->requests->updateOne(['_id' => $id], ['$set' => ['comparison' => $comparison, 'updated_at' => now_iso()]]);
        json_ok(['success' => true, 'comparison' => $comparison]);
    }
}

json_err('Not found', 404);