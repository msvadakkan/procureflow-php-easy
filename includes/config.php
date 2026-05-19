<?php
// ─── MongoDB Connection Config ───────────────────────────────────────────────
define('MONGO_URI',  getenv('MONGO_URI')  ?: 'mongodb://localhost:27017');
define('MONGO_DB',   getenv('MONGO_DB')   ?: 'purchase_approval');
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'change-this-secret-in-production');
define('UPLOAD_DIR', __DIR__ . '/../uploads/');

// Allow CORS for local dev
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json');

function db(): MongoDB\Database {
    static $db = null;
    if ($db === null) {
        $client = new MongoDB\Client(MONGO_URI);
        $db     = $client->selectDatabase(MONGO_DB);
    }
    return $db;
}

function json_ok(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_err(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function new_id(): string {
    return bin2hex(random_bytes(12));
}

function now_iso(): string {
    return (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);
}
