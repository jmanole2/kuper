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
$registros = [];
$pageError = null;

try {
    $registros = (new RegistroController())->index();
} catch (Throwable $e) {
    error_log($e->getMessage());
    $pageError = "No fue posible cargar los registros. Inténtalo nuevamente.";
}

$pageTitle = "Registros";
$currentSection = "registros";

require $_SERVER["DOCUMENT_ROOT"] . "/admin/views/registros/index.php";
