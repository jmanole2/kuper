<?php

declare(strict_types=1);

date_default_timezone_set("America/Mexico_City");

require_once __DIR__ . "/autoload.php";
require_once __DIR__ . "/functions.php";
require_once __DIR__ . "/view_helpers.php";

try {
    $mysqli = Database::getInstance()->getConnection();
} catch (Throwable $e) {
    error_log($e->getMessage());

    if (!headers_sent()) {
        http_response_code(503);
        header("Content-Type: text/html; charset=UTF-8");
    }

    exit("El servicio no está disponible temporalmente.");
}
