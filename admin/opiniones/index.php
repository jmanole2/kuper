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
$opiniones = [];
$summary = ["total" => 0, "felicitaciones" => 0, "solicitudes" => 0, "quejas" => 0];
$pageError = null;

try {
    $controller = new OpinionController();
    $opiniones = $controller->index();
    $summary = $controller->summary();
} catch (Throwable $e) {
    error_log($e->getMessage());
    $pageError = "No fue posible cargar las opiniones. Inténtalo nuevamente.";
}

$pageTitle = "Opiniones";
$currentSection = "opiniones";

require $_SERVER["DOCUMENT_ROOT"] . "/admin/views/opiniones/index.php";
