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
            "SELECT
                r.id,
                r.nombre,
                r.correo,
                r.recorridos,
                r.created_at,
                d.nombre AS dispositivo
             FROM registros r
             LEFT JOIN dispositivos d ON d.id = r.dispositivo_id
             ORDER BY r.created_at DESC, r.id DESC"
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

    /**
     * Inserta un registro. Si el event_uuid ya existe devuelve el id existente
     * y marca el resultado como duplicado (reintento del mismo envío).
     */
    public function create(
        string $eventUuid,
        ?int $dispositivoId,
        string $nombre,
        string $correo,
        string $recorridos,
        ?string $capturadoAt
    ): array {
        $stmt = $this->db->prepare(
            "INSERT INTO registros (event_uuid, dispositivo_id, nombre, correo, recorridos, capturado_at)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("sissss", $eventUuid, $dispositivoId, $nombre, $correo, $recorridos, $capturadoAt);

        try {
            $stmt->execute();
            $id = (int) $stmt->insert_id;
            $stmt->close();

            return ["id" => $id, "duplicado" => false];
        } catch (mysqli_sql_exception $e) {
            $stmt->close();

            if (!DuplicateKey::matches($e)) {
                throw $e;
            }
        }

        return ["id" => $this->findIdByEventUuid($eventUuid), "duplicado" => true];
    }

    private function findIdByEventUuid(string $eventUuid): int
    {
        $stmt = $this->db->prepare("SELECT id FROM registros WHERE event_uuid = ? LIMIT 1");
        $stmt->bind_param("s", $eventUuid);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        return (int) ($row["id"] ?? 0);
    }
}
