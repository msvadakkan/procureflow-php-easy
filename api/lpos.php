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

// GET /api/lpos
if ($method === 'GET' && !$id) {
    $claims = require_auth();
    $uid    = $claims['sub'];
    $role   = $claims['role'];
    $filter = in_array($role, ['admin', 'ceo', 'department_head', 'manager']) ? [] : ['created_by' => $uid];
    $rows   = iterator_to_array(db()->lpos->find($filter, ['sort' => ['created_at' => -1]]));
    json_ok(array_map('mongo_doc', $rows));
}

// POST /api/lpos
if ($method === 'POST' && !$id) {
    $claims = require_auth();
    $b      = body();
    if (empty($b['vendor_id']) || empty($b['items'])) json_err('vendor_id and items required');

    $items    = $b['items'];
    $subtotal = array_sum(array_map(fn($i) => floatval($i['qty']) * floatval($i['unit_price']), $items));
    $vat_pct  = floatval($b['vat_pct'] ?? 5);
    $vat_amt  = $subtotal * $vat_pct / 100;
    $total    = $subtotal + $vat_amt;

    $doc = [
        '_id'           => new_id(),
        'lpo_number'    => 'LPO-' . strtoupper(substr(new_id(), 0, 6)),
        'request_id'    => $b['request_id'] ?? null,
        'request_title' => $b['request_title'] ?? null,
        'vendor_id'     => $b['vendor_id'],
        'vendor_name'   => $b['vendor_name'] ?? null,
        'company_id'    => $b['company_id'] ?? null,
        'company_name'  => $b['company_name'] ?? null,
        'items'         => $items,
        'subtotal'      => $subtotal,
        'vat_pct'       => $vat_pct,
        'vat_amount'    => $vat_amt,
        'total'         => $total,
        'currency'      => 'AED',
        'delivery_days' => $b['delivery_days'] ?? null,
        'payment_terms' => $b['payment_terms'] ?? 'Net 30',
        'notes'         => $b['notes'] ?? '',
        'status'        => 'draft',
        'created_by'    => $claims['sub'],
        'created_at'    => now_iso(),
        'updated_at'    => now_iso(),
    ];
    db()->lpos->insertOne($doc);
    json_ok(mongo_doc($doc), 201);
}

// GET /api/lpos/:id
if ($method === 'GET' && $id && !$action) {
    require_auth();
    $doc = db()->lpos->findOne(['_id' => $id]);
    if (!$doc) json_err('Not found', 404);
    json_ok(mongo_doc($doc));
}

// PUT /api/lpos/:id
if ($method === 'PUT' && $id && !$action) {
    require_auth();
    $b      = body();
    $update = ['updated_at' => now_iso()];
    foreach (['status', 'notes', 'payment_terms', 'delivery_days'] as $f) {
        if (isset($b[$f])) $update[$f] = $b[$f];
    }
    db()->lpos->updateOne(['_id' => $id], ['$set' => $update]);
    $doc = db()->lpos->findOne(['_id' => $id]);
    json_ok(mongo_doc($doc));
}

json_err('Not found', 404);
