<?php

declare(strict_types=1);

require_once dirname(__DIR__) . "/bootstrap.php";

// Formulario de registro para recorridos.
// Entrada: {"event_uuid": "...", "nombre": "...", "correo": "...",
//           "recorridos": ["centro"], "capturado_at": "2026-10-22T18:00:00Z"}
// Reenviar el mismo event_uuid no duplica el registro (responde 200 con duplicado=true).

apiRequirePost();
apiRequireJson();
$payload = apiReadJson();
$device = apiOptionalDevice();

apiHandle(static function () use ($payload, $device): void {
    $result = (new RegistroController())->create($payload, $device["id"] ?? null);
    apiRespond($result, $result["duplicado"] ? 200 : 201);
}, "No fue posible guardar el registro.");
