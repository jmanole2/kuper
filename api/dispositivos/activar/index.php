<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . "/bootstrap.php";

// Canjea un código de activación generado en el admin.
// Entrada: {"codigo": "ABCD-EFGH", "uuid": "...", "equipo": "KIOSCO-01", "version": "1.0.0"}
// Salida:  {"dispositivo_id": 1, "uuid": "...", "token": "..."} (el token solo se entrega aquí)

apiRequirePost();
apiRequireJson();
$payload = apiReadJson();

apiHandle(static function () use ($payload): void {
    $result = (new DispositivoController())->activate($payload, apiClientIp());
    apiRespond($result, 201);
}, "No fue posible activar el dispositivo.");
