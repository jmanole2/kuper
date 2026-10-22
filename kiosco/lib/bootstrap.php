<?php

declare(strict_types=1);

const KIOSCO_VERSION = "0.1.0";

date_default_timezone_set("UTC");

// El kiosco reutiliza la validación del servidor (misma carpeta del proyecto).
$projectRoot = dirname(__DIR__, 2);
require_once $projectRoot . "/admin/core/ValidationException.php";
require_once $projectRoot . "/admin/core/Input.php";
require_once $projectRoot . "/admin/services/RegistroService.php";
require_once $projectRoot . "/admin/services/OpinionService.php";
require_once __DIR__ . "/Store.php";
require_once __DIR__ . "/RemoteApi.php";

function kioscoConfig(): array
{
    static $config = null;

    if ($config === null) {
        $config = require dirname(__DIR__) . "/config.php";
    }

    return $config;
}

function kioscoStore(): Store
{
    static $store = null;

    if ($store === null) {
        $store = new Store(kioscoConfig()["data_dir"]);
    }

    return $store;
}

function kioscoRemote(): RemoteApi
{
    return new RemoteApi(kioscoConfig()["server_url"], dirname(__DIR__) . "/cacert.pem");
}

function utcNow(): string
{
    return gmdate("Y-m-d\\TH:i:s\\Z");
}

function uuidV4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);

    return sprintf(
        "%s-%s-%s-%s-%s",
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20)
    );
}

function kioscoLog(string $message): void
{
    $dir = kioscoConfig()["data_dir"];
    $file = $dir . DIRECTORY_SEPARATOR . "kiosco.log";

    // Rotación simple: el log no pasa de ~1 MB.
    if (is_file($file) && filesize($file) > 1024 * 1024) {
        @rename($file, $file . ".1");
    }

    @file_put_contents($file, "[" . utcNow() . "] " . $message . PHP_EOL, FILE_APPEND);
}
