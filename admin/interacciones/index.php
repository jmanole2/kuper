<?php

declare(strict_types=1);

session_start();

require_once dirname(__DIR__) . "/includes/bootstrap.php";

Auth::check();

if (!Auth::isAdmin()) {
    header("Location: /admin/login/");
    exit;
}

$userInfo = getUserInfo((int) $_SESSION["idUser"], $mysqli);
$interacciones = [];
$summary = [
    "total" => 0,
    "activas" => 0,
    "finalizadas" => 0,
    "duracion_promedio_segundos" => null,
];
$pageError = null;

try {
    $controller = new InteraccionController();
    $interacciones = $controller->index();
    $summary = $controller->summary();
} catch (Throwable $e) {
    error_log($e->getMessage());
    $pageError = "No fue posible cargar las interacciones. Inténtalo nuevamente.";
}

$pageTitle = "Interacciones";
$currentSection = "interacciones";

require $_SERVER["DOCUMENT_ROOT"] . "/admin/views/interacciones/index.php";
