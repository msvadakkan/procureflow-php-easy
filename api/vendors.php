<?php
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id']     ?? null;
$action = $_GET['action'] ?? null;

function mongo_doc($doc): array {
    if (!$doc) return [];
    $arr = (array)$doc;
    $arr['id'] = (string)($arr['_id'] ?? '');
    unset($arr['password']);
    return $arr;
}

// GET /api/vendors
if ($method === 'GET' && !$id) {
    $user = require_auth();
    if ($user['role'] === 'admin') {
        $rows = iterator_to_array(db()->vendors->find([], ['projection' => ['password' => 0], 'sort' => ['created_at' => -1]]));
    } else {
        // Authenticated approvers can see approved vendors (for comparison sheet)
        $rows = iterator_to_array(db()->vendors->find(
            ['status' => 'approved'],
            ['projection' => ['password' => 0, 'bank_name' => 0, 'account_name' => 0, 'account_number' => 0, 'iban' => 0, 'swift_code' => 0, 'branch' => 0],
             'sort' => ['company_name' => 1]]
        ));
    }
    json_ok(array_map('mongo_doc', $rows));
}

// POST /api/vendors (vendor self-registration)
if ($method === 'POST' && !$id) {
    // Vendor registration logic
    $b = !empty($_POST) ? $_POST : body();
    $required = ['company_name', 'email', 'password'];
    foreach ($required as $f) { if (empty($b[$f])) json_err("$f is required"); }

    if (db()->vendors->findOne(['email' => strtolower($b['email'])])) json_err('Email already registered');

    $doc = [
        '_id'           => new_id(),
        'company_name'  => trim($b['company_name']),
        'vat_number'    => trim($b['vat_number'] ?? ''),
        'contact_number'=> trim($b['contact_number'] ?? ''),
        'sales_person'  => trim($b['sales_person'] ?? ''),
        'address'       => trim($b['address'] ?? ''),
        'email'         => strtolower(trim($b['email'])),
        'password'      => hash_password($b['password']),
        'bank_name'     => $b['bank_name'] ?? '',
        'account_name'  => $b['account_name'] ?? '',
        'account_number'=> $b['account_number'] ?? '',
        'iban'          => $b['iban'] ?? '',
        'swift_code'    => $b['swift_code'] ?? '',
        'branch'        => $b['branch'] ?? '',
        'categories'    => $b['categories'] ?? '',
        'status'        => 'pending',
        'created_at'    => now_iso(),
    ];

    // Handle file uploads
    $upload_dir       = UPLOAD_DIR . 'vendors/';
    $allowed_doc_ext  = ['pdf', 'jpg', 'jpeg', 'png'];
    $allowed_doc_mime = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!is_dir($upload_dir)) mkdir($upload_dir, 0755, true);
    foreach (['trade_license', 'vat_certificate', 'bank_document'] as $field) {
        if (!empty($_FILES[$field]['name'])) {
            $ext  = strtolower(pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION));
            $mime = mime_content_type($_FILES[$field]['tmp_name']);
            if (!in_array($ext, $allowed_doc_ext, true) || !in_array($mime, $allowed_doc_mime, true)) {
                json_err("Invalid file type for $field. Only PDF and image files are allowed.");
            }
            if ($_FILES[$field]['size'] > 5 * 1024 * 1024) json_err("$field must be under 5 MB.");
            $name = $doc['_id'] . '_' . $field . '.' . $ext;
            move_uploaded_file($_FILES[$field]['tmp_name'], $upload_dir . $name);
            $doc[$field] = $name;
        }
    }

    db()->vendors->insertOne($doc);
    unset($doc['password']);
    json_ok(mongo_doc($doc), 201);
}

// GET /api/vendors/:id
if ($method === 'GET' && $id && !$action) {
    require_auth();
    $doc = db()->vendors->findOne(['_id' => $id], ['projection' => ['password' => 0]]);
    if (!$doc) json_err('Not found', 404);
    json_ok(mongo_doc($doc));
}

// POST /api/vendors/:id/approve
if ($method === 'POST' && $id && $action === 'approve') {
    require_admin();
    db()->vendors->updateOne(['_id' => $id], ['$set' => ['status' => 'approved']]);
    json_ok(['success' => true]);
}

// POST /api/vendors/:id/reject
if ($method === 'POST' && $id && $action === 'reject') {
    require_admin();
    db()->vendors->updateOne(['_id' => $id], ['$set' => ['status' => 'rejected']]);
    json_ok(['success' => true]);
}

json_err('Not found', 404);
