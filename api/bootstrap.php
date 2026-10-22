<?php

declare(strict_types=1);

date_default_timezone_set("UTC");

require_once dirname(__DIR__) . "/admin/includes/autoload.php";

header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store");
header("X-Content-Type-Options: nosniff");

function apiRespond(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function apiRequirePost(): void
{
    if (($_SERVER["REQUEST_METHOD"] ?? "GET") === "POST") {
        return;
    }

    header("Allow: POST");
    apiRespond(["error" => "Método no permitido."], 405);
}

function apiRequireJson(): void
{
    $contentType = strtolower(trim(explode(
        ";",
        (string) ($_SERVER["CONTENT_TYPE"] ?? "")
    )[0]));

    if ($contentType === "application/json") {
        return;
    }

    apiRespond(["error" => "El contenido debe enviarse como JSON."], 415);
}

function apiReadJson(): array
{
    $body = file_get_contents("php://input");

    if ($body === false || trim($body) === "") {
        return [];
    }

    try {
        $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        apiRespond(["error" => "El cuerpo de la solicitud no es JSON válido."], 400);
    }

    if (!is_array($payload)) {
        apiRespond(["error" => "El cuerpo de la solicitud debe ser un objeto JSON."], 400);
    }

    return $payload;
}
