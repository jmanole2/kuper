<?php

declare(strict_types=1);

session_start();

require_once dirname(__DIR__) . "/includes/bootstrap.php";

Auth::check();

if (!Auth::isAdmin()) {
    header("Location: /admin/login/");
    exit;
}

$controller = new DispositivoController();

if (($_SERVER["REQUEST_METHOD"] ?? "GET") === "POST") {
    Auth::validateCSRF($_POST["csrf_token"] ?? "");
    $action = (string) ($_POST["action"] ?? "");
    $deviceId = (int) ($_POST["id"] ?? 0);
    $flash = ["type" => "success", "message" => "", "codigo" => null, "nombre" => null];

    try {
        if ($action === "crear") {
            $nombre = (string) ($_POST["nombre"] ?? "");
            $result = $controller->create($nombre, (string) ($_POST["ubicacion"] ?? ""));
            $flash["message"] = "Dispositivo creado. Captura este código en el programa de la computadora.";
            $flash["codigo"] = $result["codigo"];
            $flash["nombre"] = trim($nombre);
        } elseif ($action === "regenerar" && $deviceId > 0) {
            $code = $controller->regenerateCode($deviceId);
            $flash["message"] = $code !== null
                ? "Nuevo código generado. El anterior dejó de funcionar."
                : "No fue posible generar el código para este dispositivo.";
            $flash["type"] = $code !== null ? "success" : "warning";
            $flash["codigo"] = $code;
            $flash["nombre"] = (string) ($_POST["nombre"] ?? "");
        } elseif ($action === "revocar" && $deviceId > 0) {
            $controller->revoke($deviceId);
            $flash["message"] = "Dispositivo revocado. Ya no podrá enviar información.";
        }
    } catch (ValidationException $e) {
        $flash = ["type" => "warning", "message" => $e->getMessage(), "codigo" => null, "nombre" => null];
    } catch (Throwable $e) {
        error_log($e->getMessage());
        $flash = ["type" => "warning", "message" => "No fue posible completar la acción.", "codigo" => null, "nombre" => null];
    }

    // El código se muestra una sola vez, después de redirigir.
    $_SESSION["dispositivos_flash"] = $flash;
    header("Location: /admin/dispositivos/");
    exit;
}

$flash = $_SESSION["dispositivos_flash"] ?? null;
unset($_SESSION["dispositivos_flash"]);

$userInfo = getUserInfo((int) $_SESSION["idUser"], $mysqli);
$dispositivos = [];
$summary = ["activos" => 0, "conectados" => 0];
$pageError = null;

try {
    $dispositivos = $controller->index();
    $summary = $controller->summary();
} catch (Throwable $e) {
    error_log($e->getMessage());
    $pageError = "No fue posible cargar los dispositivos. Revisa que la migración de la base de datos esté aplicada.";
}

$onlineSeconds = DispositivoService::ONLINE_SECONDS;
$pageTitle = "Dispositivos";
$currentSection = "dispositivos";

require $_SERVER["DOCUMENT_ROOT"] . "/admin/views/dispositivos/index.php";
