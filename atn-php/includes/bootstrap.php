<?php
/**
 * Arranque común del sitio y del administrador.
 */
declare(strict_types=1);

define('ROOT', dirname(__DIR__));
$GLOBALS['config'] = require ROOT . '/config.php';

date_default_timezone_set(cfg('timezone') ?: 'America/Mexico_City');
mb_internal_encoding('UTF-8');

if (cfg('debug')) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
}

require ROOT . '/includes/helpers.php';
require ROOT . '/includes/db.php';
require ROOT . '/includes/media.php';
require ROOT . '/includes/content.php';
require ROOT . '/includes/seo.php';
require ROOT . '/includes/icons.php';

function cfg(string $key, $default = null)
{
    return $GLOBALS['config'][$key] ?? $default;
}

// Primera ejecución: crea tablas y carga el contenido del diseño.
db_migrate();
if (!doc_exists('settings')) {
    require_once ROOT . '/includes/seed.php';
    seed_content();
}
