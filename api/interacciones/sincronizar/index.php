<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . "/bootstrap.php";

// Interacción medida por el programa local (funciona aunque haya estado sin internet).
// Entrada: {"interaction_uuid": "...", "inicio_at": "...", "ultima_actividad_at": "...",
//           "fin_at": "..." | null, "duracion_segundos": 95}
// Se puede enviar varias veces; la misma interacción se actualiza, no se duplica.

apiRequirePost();
apiRequireJson();
$payload = apiReadJson();
$device = apiRequireDevice();

apiHandle(static function () use ($payload, $device): void {
    if (!(new InteraccionController())->sync($device["id"], $payload)) {
        apiRespond(["error" => "La interacción pertenece a otro dispositivo."], 409);
    }

    apiRespond(["ok" => true]);
}, "No fue posible sincronizar la interacción.");
