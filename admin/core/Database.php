<?php

declare(strict_types=1);

final class Database
{
    private static ?self $instance = null;
    private mysqli $connection;

    private function __construct()
    {
        $config = require dirname(__DIR__) . "/config/database.php";

        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

        try {
            $this->connection = new mysqli(
                $config["host"],
                $config["username"],
                $config["password"],
                $config["database"],
                $config["port"]
            );

            $this->connection->set_charset($config["charset"]);

            $timezone = $this->connection->real_escape_string($config["timezone"]);
            $this->connection->query("SET time_zone = '{$timezone}'");
        } catch (mysqli_sql_exception $e) {
            throw new RuntimeException(
                "No fue posible conectar con la base de datos.",
                0,
                $e
            );
        }
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    public function getConnection(): mysqli
    {
        return $this->connection;
    }

    private function __clone()
    {
    }

    public function __wakeup(): void
    {
        throw new LogicException("La conexión no se puede deserializar.");
    }
}
