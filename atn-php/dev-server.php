<?php
/**
 * Solo para probar en tu computadora (no se usa en DreamHost):
 *   php -S localhost:8000 dev-server.php
 */
if (PHP_SAPI !== 'cli-server') {
    http_response_code(404);
    exit;
}
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/(data|includes|templates)(/|$)#', $path)) {
    http_response_code(403);
    exit('Prohibido');
}
$file = __DIR__ . $path;
if ($path !== '/' && is_file($file) && substr($file, -4) !== '.php') {
    return false;
}
if (preg_match('#^/admin/?$#', $path) || $path === '/admin/index.php') {
    $_SERVER['SCRIPT_NAME'] = '/admin/index.php';
    require __DIR__ . '/admin/index.php';
    return true;
}
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/index.php';
