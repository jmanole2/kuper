<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . "/bootstrap.php";

// Señal periódica del programa local: indica que la computadora está encendida
// y conectada, aunque nadie esté usando el interactivo.
// Entrada opcional: {"equipo": "KIOSCO-01", "version": "1.0.0"}

apiRequirePost();
apiRequireJson();
$payload = apiReadJson();
$device = apiRequireDevice();

apiHandle(static function () use ($device, $payload): void {
    (new DispositivoController())->heartbeat($device, $payload, apiClientIp());
    apiRespond([
        "ok" => true,
        "dispositivo_id" => $device["id"],
        "nombre" => $device["nombre"],
        "server_time" => gmdate("Y-m-d\\TH:i:s\\Z"),
    ]);
}, "No fue posible registrar la conexión.");
