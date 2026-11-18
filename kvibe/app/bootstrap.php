<?php
declare(strict_types=1);

define('APP_ROOT', dirname(__DIR__));
define('APP_DIR', __DIR__);
define('STORAGE', APP_ROOT . '/storage');

require APP_DIR . '/lib.php';

$GLOBALS['__config'] = config_merge(
    require APP_DIR . '/config.php',
    is_file(APP_DIR . '/config.local.php') ? require APP_DIR . '/config.local.php' : []
);

date_default_timezone_set(cfg('timezone'));
mb_internal_encoding('UTF-8');
error_reporting(E_ALL);
ini_set('display_errors', cfg('debug') ? '1' : '0');
ini_set('log_errors', '1');
ini_set('error_log', STORAGE . '/logs/php-error.log');

if (PHP_SAPI !== 'cli') {
    force_https();
    send_security_headers();
    start_session();
}
