<?php

declare(strict_types=1);

require_once dirname(__DIR__) . "/bootstrap.php";

// Formulario de opinión (felicitación, solicitud o queja).
// Entrada: {"event_uuid": "...", "tipo": "queja", "nombre": "...", "apellido_paterno": "...",
//           "apellido_materno": "", "pais": "México", "correo": "...", "edad": 30,
//           "genero": "otro", "comentario": "...", "privacidad": true, "capturado_at": "..."}

apiRequirePost();
apiRequireJson();
$payload = apiReadJson();
$device = apiOptionalDevice();

apiHandle(static function () use ($payload, $device): void {
    $result = (new OpinionController())->create($payload, $device["id"] ?? null);
    apiRespond($result, $result["duplicado"] ? 200 : 201);
}, "No fue posible guardar la opinión.");
