<?php
/**
 * Single-entry API router
 * Routes: /api/<resource>[/<id>][/<action>]
 *
 * Example .htaccess or nginx config redirects all /api/* here with
 *   ?resource=X&id=Y&action=Z query params set by rewrite rule.
 */
require_once __DIR__ . '/../includes/bootstrap.php';

$resource = $_GET['resource'] ?? '';
$id       = $_GET['id']       ?? null;
$action   = $_GET['action']   ?? null;

// Put id/action back in _GET so individual files can read them
$_GET['id']     = $id;
$_GET['action'] = $action;

$map = [
    'auth'      => __DIR__ . '/auth.php',
    'users'     => __DIR__ . '/users.php',
    'requests'  => __DIR__ . '/requests.php',
    'vendors'   => __DIR__ . '/vendors.php',
    'tenders'   => __DIR__ . '/tenders.php',
    'lpos'      => __DIR__ . '/lpos.php',
    'companies' => __DIR__ . '/companies.php',
    'admin'     => __DIR__ . '/admin.php',
];

if (isset($map[$resource])) {
    require $map[$resource];
} else {
    http_response_code(404);
    echo json_encode(['error' => "Unknown resource: $resource"]);
}
