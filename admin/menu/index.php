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
$metrics = [
    "registros" => 0,
    "interacciones" => [
        "total" => 0,
        "activas" => 0,
        "finalizadas" => 0,
        "duracion_promedio_segundos" => null,
    ],
];
$pageError = null;

try {
    $metrics = (new DashboardController())->index();
} catch (Throwable $e) {
    error_log($e->getMessage());
    $pageError = "No fue posible cargar las métricas del dashboard.";
}

$pageTitle = "Dashboard";
$currentSection = "dashboard";

require $_SERVER["DOCUMENT_ROOT"] . "/admin/views/dashboard/index.php";
