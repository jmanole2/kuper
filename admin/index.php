<?php

declare(strict_types=1);

session_start();

if (($_SESSION["logged_in"] ?? false) !== true) {
    header("Location: /admin/login/");
    exit;
}

$routesByRole = [
    "administrador" => "/admin/menu/",
    "reclutador" => "/menu-r/",
    "cliente" => "/menu-c/",
    "clienteusuario" => "/menu-c/",
];

$role = (string) ($_SESSION["accesslevel"] ?? "");
$destination = $routesByRole[$role] ?? "/admin/login/";

header("Location: {$destination}");
exit;
