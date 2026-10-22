<?php

declare(strict_types=1);

$localConfigFile = __DIR__ . "/database.local.php";
$localConfig = is_file($localConfigFile)
    ? require $localConfigFile
    : [];

$readConfig = static function (string $environmentKey, string $localKey, $default = null) use ($localConfig) {
    $environmentValue = getenv($environmentKey);

    if ($environmentValue !== false && $environmentValue !== "") {
        return $environmentValue;
    }

    return $localConfig[$localKey] ?? $default;
};

$config = [
    "host" => (string) $readConfig("KALUZ_DB_HOST", "host"),
    "port" => (int) $readConfig("KALUZ_DB_PORT", "port", 3306),
    "database" => (string) $readConfig("KALUZ_DB_NAME", "database"),
    "username" => (string) $readConfig("KALUZ_DB_USER", "username"),
    "password" => (string) $readConfig("KALUZ_DB_PASSWORD", "password"),
    "charset" => "utf8mb4",
    "timezone" => "+00:00",
];

foreach (["host", "database", "username", "password"] as $requiredKey) {
    if ($config[$requiredKey] === "") {
        throw new RuntimeException(
            "Falta configurar el valor de base de datos: {$requiredKey}."
        );
    }
}

return $config;
