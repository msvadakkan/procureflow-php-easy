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

// GET /api/users
if ($method === 'GET' && !$id) {
    require_admin();
    $users = iterator_to_array(db()->users->find([], ['projection' => ['password' => 0]]));
    json_ok(array_map('mongo_doc', $users));
}

// POST /api/users
if ($method === 'POST' && !$id) {
    require_admin();
    $b = body();
    $required = ['name', 'email', 'password', 'role'];
    foreach ($required as $f) { if (empty($b[$f])) json_err("$f is required"); }

    if (db()->users->findOne(['email' => strtolower($b['email'])])) json_err('Email already exists');

    $doc = [
        '_id'        => new_id(),
        'name'       => trim($b['name']),
        'email'      => strtolower(trim($b['email'])),
        'password'   => hash_password($b['password']),
        'role'       => $b['role'],
        'department' => $b['department'] ?? null,
        'is_active'  => 1,
        'created_at' => now_iso(),
    ];
    db()->users->insertOne($doc);
    unset($doc['password']);
    json_ok(mongo_doc($doc), 201);
}

// PUT /api/users/:id
if ($method === 'PUT' && $id) {
    require_admin();
    $b     = body();
    $update = [];
    foreach (['name', 'email', 'role', 'department', 'is_active'] as $f) {
        if (isset($b[$f])) $update[$f] = $b[$f];
    }
    if (!empty($b['password'])) $update['password'] = hash_password($b['password']);
    db()->users->updateOne(['_id' => $id], ['$set' => $update]);
    $user = db()->users->findOne(['_id' => $id], ['projection' => ['password' => 0]]);
    json_ok(mongo_doc($user));
}

// DELETE /api/users/:id
if ($method === 'DELETE' && $id) {
    require_admin();
    db()->users->deleteOne(['_id' => $id]);
    json_ok(['success' => true]);
}

json_err('Not found', 404);
