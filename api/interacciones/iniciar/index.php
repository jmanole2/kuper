<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . "/bootstrap.php";

apiRequirePost();
apiRequireJson();

try {
    $interaction = (new InteraccionController())->start();
    apiRespond($interaction, 201);
} catch (Throwable $e) {
    error_log($e->getMessage());
    apiRespond(["error" => "No fue posible iniciar la interacción."], 503);
}
