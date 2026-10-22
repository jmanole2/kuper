<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . "/bootstrap.php";

apiRequirePost();
apiRequireJson();
$payload = apiReadJson();
$token = (string) ($payload["token"] ?? "");

if ($token === "") {
    apiRespond(["error" => "Falta el token de la interacción."], 422);
}

try {
    $isActive = (new InteraccionController())->heartbeat($token);

    if (!$isActive) {
        apiRespond(["error" => "La interacción no está activa."], 404);
    }

    apiRespond(["activa" => true]);
} catch (Throwable $e) {
    error_log($e->getMessage());
    apiRespond(["error" => "No fue posible actualizar la interacción."], 503);
}
