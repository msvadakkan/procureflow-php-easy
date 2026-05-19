<?php
require_once __DIR__ . '/bootstrap.php';

// Simple HS256 JWT (no external library needed)
function jwt_encode(array $payload): string {
    $header  = base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64url(json_encode($payload));
    $sig     = base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function jwt_decode(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
    if (!$data || (isset($data['exp']) && $data['exp'] < time())) return null;
    return $data;
}

function base64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function require_auth(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $token  = str_starts_with($header, 'Bearer ') ? substr($header, 7) : '';
    $claims = $token ? jwt_decode($token) : null;
    if (!$claims) json_err('Unauthorized', 401);
    return $claims;
}

function require_admin(): array {
    $claims = require_auth();
    if ($claims['role'] !== 'admin') json_err('Forbidden', 403);
    return $claims;
}

function hash_password(string $pw): string {
    return password_hash($pw, PASSWORD_BCRYPT, ['cost' => 10]);
}

function verify_password(string $pw, string $hash): bool {
    return password_verify($pw, $hash);
}
