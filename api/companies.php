<?php
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

function mongo_doc($doc): array {
    if (!$doc) return [];
    $arr = (array)$doc;
    $arr['id'] = (string)($arr['_id'] ?? '');
    return $arr;
}

// GET /api/companies
if ($method === 'GET' && !$id) {
    require_auth();
    $rows = iterator_to_array(db()->companies->find([], ['sort' => ['name' => 1]]));
    json_ok(array_map('mongo_doc', $rows));
}

// POST /api/companies
if ($method === 'POST' && !$id) {
    require_admin();
    $b = !empty($_POST) ? $_POST : body();
    if (empty($b['name'])) json_err('name is required');

    $doc = [
        '_id'        => new_id(),
        'name'       => trim($b['name']),
        'trade_name' => $b['trade_name'] ?? '',
        'vat_number' => $b['vat_number'] ?? '',
        'address'    => $b['address']    ?? '',
        'phone'      => $b['phone']      ?? '',
        'email'      => $b['email']      ?? '',
        'website'    => $b['website']    ?? '',
        'bank_name'  => $b['bank_name']  ?? '',
        'iban'       => $b['iban']       ?? '',
        'swift_code' => $b['swift_code'] ?? '',
        'logo'       => null,
        'is_active'  => true,
        'created_at' => now_iso(),
    ];

    // Logo upload
    if (!empty($_FILES['logo']['name'])) {
        $upload_dir = UPLOAD_DIR . 'logos/';
        if (!is_dir($upload_dir)) mkdir($upload_dir, 0755, true);
        $ext  = pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION);
        $name = $doc['_id'] . '_logo.' . $ext;
        move_uploaded_file($_FILES['logo']['tmp_name'], $upload_dir . $name);
        $doc['logo'] = 'logos/' . $name;
    }

    db()->companies->insertOne($doc);
    json_ok(mongo_doc($doc), 201);
}

// GET /api/companies/:id
if ($method === 'GET' && $id) {
    require_auth();
    $doc = db()->companies->findOne(['_id' => $id]);
    if (!$doc) json_err('Not found', 404);
    json_ok(mongo_doc($doc));
}

// PUT /api/companies/:id
if ($method === 'PUT' && $id) {
    require_admin();
    $b = body();
    $update = [];
    foreach (['name', 'trade_name', 'vat_number', 'address', 'phone', 'email', 'website', 'bank_name', 'iban', 'swift_code', 'is_active'] as $f) {
        if (isset($b[$f])) $update[$f] = $b[$f];
    }
    db()->companies->updateOne(['_id' => $id], ['$set' => $update]);
    $doc = db()->companies->findOne(['_id' => $id]);
    json_ok(mongo_doc($doc));
}

// DELETE /api/companies/:id
if ($method === 'DELETE' && $id) {
    require_admin();
    db()->companies->deleteOne(['_id' => $id]);
    json_ok(['success' => true]);
}

json_err('Not found', 404);
