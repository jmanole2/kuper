<?php

// Servidor local del kiosco. Se ejecuta con:
//   php -S 127.0.0.1:17406 -t <carpeta del proyecto> kiosco/router.php
//
// - Sirve el interactivo (index.html, pages, scripts, styles, assets, data).
// - Recibe las mismas rutas /api/... que el servidor, pero las guarda en la
//   computadora. El proceso worker.php las envía cuando hay internet.

declare(strict_types=1);

// Solo funciona con el servidor integrado de PHP en la computadora del kiosco.
if (PHP_SAPI !== "cli-server") {
    http_response_code(404);
    exit;
}

require_once __DIR__ . "/lib/bootstrap.php";

$projectRoot = dirname(__DIR__);
$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$path = rawurldecode(parse_url($_SERVER["REQUEST_URI"] ?? "/", PHP_URL_PATH) ?: "/");

// Solo se aceptan conexiones desde la misma computadora.
if (!in_array($_SERVER["REMOTE_ADDR"] ?? "", ["127.0.0.1", "::1"], true)) {
    http_response_code(403);
    exit("Solo disponible desde esta computadora.");
}

try {
    $store = kioscoStore();
} catch (Throwable $e) {
    kioscoLog("No se pudo abrir la base local: " . $e->getMessage());
    http_response_code(500);
    exit("No se pudo abrir la base local del kiosco. Revisa kiosco.log.");
}

// ---------- API local (mismas rutas que el servidor) ----------

if (str_starts_with($path, "/api/")) {
    if ($method !== "POST") {
        jsonResponse(["error" => "Método no permitido."], 405);
    }

    $payload = readJson();
    $route = rtrim($path, "/") . "/";

    switch ($route) {
        case "/api/interacciones/iniciar/":
            $token = bin2hex(random_bytes(32));
            $store->startInteraction(hash("sha256", $token));
            jsonResponse(["token" => $token], 201);

        case "/api/interacciones/actividad/":
            $ok = $store->touchInteraction(hash("sha256", (string) ($payload["token"] ?? "")));
            $ok
                ? jsonResponse(["activa" => true])
                : jsonResponse(["error" => "La interacción no está activa."], 404);

        case "/api/interacciones/finalizar/":
            $ok = $store->finishInteraction(hash("sha256", (string) ($payload["token"] ?? "")));
            $ok
                ? jsonResponse(["finalizada" => true])
                : jsonResponse(["error" => "La interacción no existe."], 404);

        case "/api/registros/":
        case "/api/opiniones/":
            try {
                // Misma validación que el servidor: si aquí pasa, allá también.
                $data = $route === "/api/registros/"
                    ? RegistroService::validate($payload)
                    : OpinionService::validate($payload);
            } catch (ValidationException $e) {
                jsonResponse(["error" => $e->getMessage()], 422);
            }

            $data["capturado_at"] = $data["capturado_at"] !== null
                ? gmdate("Y-m-d\\TH:i:s\\Z", strtotime($data["capturado_at"] . " UTC"))
                : utcNow();
            $store->enqueue($data["event_uuid"], $route, $data);
            jsonResponse(["queued" => true], 201);

        default:
            jsonResponse(["error" => "Ruta no encontrada."], 404);
    }
}

// ---------- Páginas del programa ----------

if ($path === "/local-api/health") {
    jsonResponse([
        "ok" => true,
        "version" => KIOSCO_VERSION,
        "activado" => $store->isActivated(),
        "uuid" => $store->deviceUuid(),
        "dispositivo" => $store->get("nombre"),
        "ultima_conexion" => $store->get("ultima_conexion"),
        "ultimo_error" => $store->get("ultimo_error"),
        "pendientes" => $store->pendingCounts(),
    ]);
}

if ($path === "/activar") {
    $message = null;

    if ($method === "POST") {
        $message = activate($store, (string) ($_POST["codigo"] ?? ""));

        if ($message === null) {
            header("Location: /");
            exit;
        }
    }

    require __DIR__ . "/views/activar.php";
    exit;
}

if ($path === "/estado") {
    require __DIR__ . "/views/estado.php";
    exit;
}

// ---------- Interactivo (archivos estáticos) ----------

if ($path === "/" || $path === "/index.html") {
    if (!$store->isActivated()) {
        header("Location: /activar");
        exit;
    }

    serveFile($projectRoot . "/index.html");
}

$allowed = ["/pages/", "/scripts/", "/styles/", "/assets/", "/data/"];
$isAllowed = false;

foreach ($allowed as $prefix) {
    if (str_starts_with($path, $prefix)) {
        $isAllowed = true;
        break;
    }
}

// Nunca se sirven admin/, api/, kiosco/ ni archivos .php.
if (!$isAllowed || str_ends_with(strtolower($path), ".php")) {
    http_response_code(404);
    exit("No encontrado.");
}

$file = realpath($projectRoot . $path);

if ($file === false || !is_file($file) || !str_starts_with($file, realpath($projectRoot) . DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    exit("No encontrado.");
}

serveFile($file);

// ---------- Funciones ----------

function jsonResponse(array $payload, int $status = 200): never
{
    http_response_code($status);
    header("Content-Type: application/json; charset=UTF-8");
    header("Cache-Control: no-store");
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readJson(): array
{
    $body = file_get_contents("php://input");
    $data = json_decode($body === false ? "" : $body, true);

    return is_array($data) ? $data : [];
}

/** Canjea el código de activación. Devuelve null si salió bien o el mensaje de error. */
function activate(Store $store, string $code): ?string
{
    $result = kioscoRemote()->post("api/dispositivos/activar/", [
        "codigo" => $code,
        "uuid" => $store->deviceUuid(),
        "equipo" => gethostname() ?: null,
        "version" => KIOSCO_VERSION,
    ]);

    if ($result["status"] === 0) {
        return "No hay conexión con el servidor. Revisa el internet e inténtalo de nuevo.";
    }

    if ($result["status"] !== 201 || empty($result["body"]["token"])) {
        return (string) ($result["body"]["error"] ?? "No fue posible activar el dispositivo.");
    }

    $store->set("token", (string) $result["body"]["token"]);
    $store->set("dispositivo_id", (string) $result["body"]["dispositivo_id"]);
    $store->set("activado_at", utcNow());
    $store->set("ultimo_error", null);
    $store->set("revocado", null);
    kioscoLog("Dispositivo activado (id " . $result["body"]["dispositivo_id"] . ").");

    return null;
}

/** Envía un archivo. Soporta "Range" para que los videos se puedan adelantar. */
function serveFile(string $file): never
{
    static $types = [
        "html" => "text/html; charset=UTF-8",
        "css" => "text/css; charset=UTF-8",
        "js" => "text/javascript; charset=UTF-8",
        "json" => "application/json; charset=UTF-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" => "image/jpeg",
        "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "mp3" => "audio/mpeg",
        "vtt" => "text/vtt; charset=UTF-8",
        "txt" => "text/plain; charset=UTF-8",
    ];

    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $size = filesize($file);
    $start = 0;
    $end = $size - 1;

    header("Content-Type: " . ($types[$extension] ?? "application/octet-stream"));
    header("Accept-Ranges: bytes");
    header("Cache-Control: no-cache");

    $range = $_SERVER["HTTP_RANGE"] ?? "";

    if ($size > 0 && preg_match('/^bytes=(\d*)-(\d*)$/', $range, $matches) === 1) {
        if ($matches[1] === "" && $matches[2] !== "") {
            $start = max(0, $size - (int) $matches[2]);
        } else {
            $start = (int) $matches[1];
            $end = $matches[2] !== "" ? min((int) $matches[2], $size - 1) : $size - 1;
        }

        if ($start > $end || $start >= $size) {
            http_response_code(416);
            header("Content-Range: bytes */{$size}");
            exit;
        }

        http_response_code(206);
        header("Content-Range: bytes {$start}-{$end}/{$size}");
    }

    $length = $size === 0 ? 0 : $end - $start + 1;
    header("Content-Length: " . $length);

    if (($_SERVER["REQUEST_METHOD"] ?? "GET") === "HEAD" || $length === 0) {
        exit;
    }

    $handle = fopen($file, "rb");
    fseek($handle, $start);
    $remaining = $length;

    while ($remaining > 0 && !feof($handle)) {
        $chunk = fread($handle, min(1024 * 256, $remaining));

        if ($chunk === false) {
            break;
        }

        echo $chunk;
        $remaining -= strlen($chunk);
        flush();
    }

    fclose($handle);
    exit;
}
