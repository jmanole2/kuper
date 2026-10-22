<?php

declare(strict_types=1);

class Registro
{
    private mysqli $db;

    public function __construct(mysqli $db)
    {
        $this->db = $db;
    }

    public function getAll(): array
    {
        $result = $this->db->query(
            "SELECT id, nombre, correo, created_at
             FROM registros
             ORDER BY created_at DESC, id DESC"
        );

        if (!$result) {
            throw new RuntimeException(
                "No fue posible consultar los registros: " . $this->db->error
            );
        }

        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public function count(): int
    {
        $result = $this->db->query(
            "SELECT COUNT(*) AS total FROM registros"
        );

        if (!$result) {
            throw new RuntimeException(
                "No fue posible contar los registros: " . $this->db->error
            );
        }

        $row = $result->fetch_assoc();

        return (int) ($row["total"] ?? 0);
    }
}
