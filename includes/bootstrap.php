<?php
/**
 * Bootstrap — load .env file if present, then require config.
 * Include this instead of config.php when env is loaded from a file.
 */
if (file_exists(__DIR__ . '/../.env')) {
    foreach (file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        [$key, $val] = explode('=', $line, 2);
        putenv(trim($key) . '=' . trim($val));
    }
}
require_once __DIR__ . '/config.php';
