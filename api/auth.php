<?php
require_once __DIR__ . '/../includes/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$path   = trim($_GET['path'] ?? '', '/');

// POST /api/auth/login
if ($method === 'POST' && $path === 'login') {
    $b     = body();
    $email = trim($b['email'] ?? '');
    $pw    = $b['password'] ?? '';
    if (!$email || !$pw) json_err('Email and password required');

    $user = db()->users->findOne(['email' => strtolower($email)]);
    if (!$user || !verify_password($pw, (string)($user['password'] ?? ''))) {
        json_err('Invalid credentials', 401);
    }
    if (!($user['is_active'] ?? true)) json_err('Account disabled', 403);

    $token = jwt_encode([
        'sub'        => (string)$user['_id'],
        'role'       => $user['role'],
        'name'       => $user['name'],
        'department' => $user['department'] ?? null,
        'exp'        => time() + 86400 * 7,
    ]);
    json_ok(['token' => $token, 'user' => [
        'id'         => (string)$user['_id'],
        'name'       => $user['name'],
        'email'      => $user['email'],
        'role'       => $user['role'],
        'department' => $user['department'] ?? null,
    ]]);
}

// POST /api/auth/vendor-login
if ($method === 'POST' && $path === 'vendor-login') {
    $b     = body();
    $email = trim($b['email'] ?? '');
    $pw    = $b['password'] ?? '';
    if (!$email || !$pw) json_err('Email and password required');

    $vendor = db()->vendors->findOne(['email' => strtolower($email)]);
    if (!$vendor || !verify_password($pw, (string)($vendor['password'] ?? ''))) {
        json_err('Invalid credentials', 401);
    }
    if (($vendor['status'] ?? '') !== 'approved') json_err('Account not approved yet', 403);

    $token = jwt_encode([
        'sub'          => (string)$vendor['_id'],
        'type'         => 'vendor',
        'company_name' => $vendor['company_name'],
        'exp'          => time() + 86400 * 7,
    ]);
    json_ok(['token' => $token, 'vendor' => [
        'id'           => (string)$vendor['_id'],
        'company_name' => $vendor['company_name'],
        'email'        => $vendor['email'],
        'contact_number' => $vendor['contact_number'] ?? null,
    ]]);
}

json_err('Not found', 404);
