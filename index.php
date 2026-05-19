<?php
// Setup guard: redirect to installer if no admin account exists yet.
require_once __DIR__ . '/includes/bootstrap.php';

// config.php sets Content-Type: application/json — override for HTML response
header('Content-Type: text/html; charset=UTF-8');

try {
    $admin = db()->users->findOne(['role' => 'admin'], ['projection' => ['_id' => 1]]);
    if (!$admin) {
        header('Location: install.php');
        exit;
    }
} catch (Throwable $e) {
    // DB unreachable — send to installer so the user can configure the connection
    header('Location: install.php');
    exit;
}

readfile(__DIR__ . '/index.html');
