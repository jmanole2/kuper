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

/**
 * Token del programa local. Se acepta en "Authorization: Bearer ..." o en
 * "X-Kaluz-Token" (algunos hostings con PHP-FPM eliminan Authorization).
 */
function apiDeviceToken(): string
{
    $custom = trim((string) ($_SERVER["HTTP_X_KALUZ_TOKEN"] ?? ""));

    if ($custom !== "") {
        return $custom;
    }

    $authorization = (string) (
        $_SERVER["HTTP_AUTHORIZATION"]
        ?? $_SERVER["REDIRECT_HTTP_AUTHORIZATION"]
        ?? ""
    );

    if (preg_match('/^Bearer\s+(\S+)$/i', trim($authorization), $matches) === 1) {
        return $matches[1];
    }

    return "";
}

/**
 * Devuelve el dispositivo autenticado. Sin token devuelve null (solicitud desde
 * el sitio web); con un token inválido o revocado responde 401.
 */
function apiOptionalDevice(): ?array
{
    $token = apiDeviceToken();

    if ($token === "") {
        return null;
    }

    try {
        $device = (new DispositivoController())->authenticate($token);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        apiRespond(["error" => "No fue posible validar el dispositivo."], 503);
    }

    if ($device === null) {
        apiRespond(["error" => "Dispositivo no autorizado."], 401);
    }

    return $device;
}

function apiRequireDevice(): array
{
    $device = apiOptionalDevice();

    if ($device === null) {
        apiRespond(["error" => "Falta el token del dispositivo."], 401);
    }

    return $device;
}

function apiClientIp(): ?string
{
    $ip = (string) ($_SERVER["REMOTE_ADDR"] ?? "");

    return filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : null;
}

/**
 * Ejecuta la acción y convierte los errores en respuestas JSON.
 */
function apiHandle(callable $action, string $failureMessage): void
{
    try {
        $action();
    } catch (ValidationException $e) {
        apiRespond(["error" => $e->getMessage()], 422);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        apiRespond(["error" => $failureMessage], 503);
    }
}
