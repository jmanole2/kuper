<?php

// Configuración del programa local del kiosco.
// Para cambiar algo en una computadora, crea config.local.php con solo las claves a cambiar:
//   <?php return ["server_url" => "https://otro-servidor.mx"];

declare(strict_types=1);

$defaultDataDir = getenv("ProgramData")
    ? rtrim((string) getenv("ProgramData"), "\\/") . DIRECTORY_SEPARATOR . "KaluzKiosco"
    : __DIR__ . DIRECTORY_SEPARATOR . "data";

$config = [
    // Servidor con la API y el admin.
    "server_url" => "https://kaluz.kuper.mx",

    // Puerto local donde se abre el interactivo: http://127.0.0.1:17406
    "port" => 17406,

    // Carpeta para la base local (identidad del equipo y pendientes).
    // Vive fuera de la carpeta del programa para que una actualización no la borre.
    "data_dir" => $defaultDataDir,

    // Cada cuánto avisa al servidor que la computadora está encendida.
    "heartbeat_seconds" => 60,

    // Minutos sin actividad para dar por terminada una interacción (igual que el servidor).
    "interaction_timeout_seconds" => 180,
];

$localFile = __DIR__ . "/config.local.php";

if (is_file($localFile)) {
    $config = array_replace($config, (array) require $localFile);
}

return $config;
