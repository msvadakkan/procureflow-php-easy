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

// GET /api/tenders
if ($method === 'GET' && !$id) {
    $rows = iterator_to_array(db()->tenders->find([], ['sort' => ['created_at' => -1]]));
    json_ok(array_map('mongo_doc', $rows));
}

// POST /api/tenders
if ($method === 'POST' && !$id) {
    $claims = require_auth();
    $b      = body();
    if (empty($b['title'])) json_err('title is required');

    $doc = [
        '_id'            => new_id(),
        'title'          => $b['title'],
        'description'    => $b['description'] ?? '',
        'specifications' => $b['specifications'] ?? '',
        'category'       => $b['category'] ?? '',
        'budget'         => isset($b['budget']) ? floatval($b['budget']) : null,
        'quantity'       => $b['quantity'] ?? null,
        'unit'           => $b['unit'] ?? null,
        'deadline'       => $b['deadline'] ?? null,
        'company_id'     => $b['company_id'] ?? null,
        'company_name'   => $b['company_name'] ?? null,
        'created_by'     => $claims['sub'],
        'status'         => 'open',
        'created_at'     => now_iso(),
    ];
    db()->tenders->insertOne($doc);
    json_ok(mongo_doc($doc), 201);
}

// GET /api/tenders/:id
if ($method === 'GET' && $id && !$action) {
    $doc = db()->tenders->findOne(['_id' => $id]);
    if (!$doc) json_err('Not found', 404);
    json_ok(mongo_doc($doc));
}

// PUT /api/tenders/:id (close/reopen)
if ($method === 'PUT' && $id && !$action) {
    require_auth();
    $b = body();
    $update = [];
    if (isset($b['status']))  $update['status']  = $b['status'];
    if (isset($b['title']))   $update['title']   = $b['title'];
    db()->tenders->updateOne(['_id' => $id], ['$set' => $update]);
    $doc = db()->tenders->findOne(['_id' => $id]);
    json_ok(mongo_doc($doc));
}

// POST /api/tenders/:id/quote
if ($method === 'POST' && $id && $action === 'quote') {
    $claims = require_auth();
    if (!isset($claims['type']) || $claims['type'] !== 'vendor') json_err('Vendor auth required', 403);
    $b = body();
    if (empty($b['unit_price'])) json_err('unit_price required');

    $tender = db()->tenders->findOne(['_id' => $id]);
    if (!$tender) json_err('Tender not found', 404);
    if ($tender['status'] !== 'open') json_err('Tender is closed');

    $exists = db()->quotes->findOne(['tender_id' => $id, 'vendor_id' => $claims['sub']]);
    if ($exists) json_err('You have already submitted a quote for this tender');

    $doc = [
        '_id'           => new_id(),
        'tender_id'     => $id,
        'vendor_id'     => $claims['sub'],
        'company_name'  => $claims['company_name'],
        'unit_price'    => floatval($b['unit_price']),
        'delivery_days' => isset($b['delivery_days']) ? intval($b['delivery_days']) : null,
        'validity_days' => isset($b['validity_days']) ? intval($b['validity_days']) : 30,
        'notes'         => $b['notes'] ?? '',
        'created_at'    => now_iso(),
    ];
    db()->quotes->insertOne($doc);
    json_ok(mongo_doc($doc), 201);
}

// GET /api/tenders/:id/quotes
if ($method === 'GET' && $id && $action === 'quotes') {
    require_auth();
    $rows = iterator_to_array(db()->quotes->find(['tender_id' => $id], ['sort' => ['unit_price' => 1]]));
    json_ok(array_map('mongo_doc', $rows));
}

// GET /api/tenders/:id/comparison
if ($method === 'GET' && $id && $action === 'comparison') {
    require_auth();
    $tender = db()->tenders->findOne(['_id' => $id]);
    if (!$tender) json_err('Not found', 404);
    $quotes = iterator_to_array(db()->quotes->find(['tender_id' => $id], ['sort' => ['unit_price' => 1]]));
    json_ok([
        'tender' => mongo_doc($tender),
        'quotes' => array_map('mongo_doc', $quotes),
    ]);
}

json_err('Not found', 404);
