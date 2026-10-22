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
    $wasFinished = (new InteraccionController())->finish($token);

    if (!$wasFinished) {
        apiRespond(["error" => "La interacción no existe."], 404);
    }

    apiRespond(["finalizada" => true]);
} catch (Throwable $e) {
    error_log($e->getMessage());
    apiRespond(["error" => "No fue posible finalizar la interacción."], 503);
}
