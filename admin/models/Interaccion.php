<?php

declare(strict_types=1);

class Interaccion
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
                id,
                inicio_at,
                fin_at,
                duracion_segundos,
                estado
             FROM interacciones
             ORDER BY inicio_at DESC, id DESC"
        );

        if (!$result) {
            throw new RuntimeException(
                "No fue posible consultar las interacciones: " . $this->db->error
            );
        }

        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public function start(string $tokenHash): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO interacciones (
                token_hash,
                inicio_at,
                ultima_actividad_at,
                estado
             ) VALUES (?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), 'activa')"
        );
        $stmt->bind_param("s", $tokenHash);
        $stmt->execute();
        $interactionId = (int) $stmt->insert_id;
        $stmt->close();

        return $interactionId;
    }

    public function heartbeat(string $tokenHash): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE interacciones
             SET ultima_actividad_at = UTC_TIMESTAMP()
             WHERE token_hash = ?
               AND estado = 'activa'"
        );
        $stmt->bind_param("s", $tokenHash);
        $stmt->execute();
        $wasUpdated = $stmt->affected_rows === 1;
        $stmt->close();

        if ($wasUpdated) {
            return true;
        }

        return $this->existsWithStatus($tokenHash, "activa");
    }

    public function finish(string $tokenHash): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE interacciones
             SET
                fin_at = UTC_TIMESTAMP(),
                ultima_actividad_at = UTC_TIMESTAMP(),
                duracion_segundos = TIMESTAMPDIFF(
                    SECOND,
                    inicio_at,
                    UTC_TIMESTAMP()
                ),
                estado = 'finalizada'
             WHERE token_hash = ?
               AND estado = 'activa'"
        );
        $stmt->bind_param("s", $tokenHash);
        $stmt->execute();
        $wasFinished = $stmt->affected_rows === 1;
        $stmt->close();

        if ($wasFinished) {
            return true;
        }

        return $this->existsWithStatus($tokenHash);
    }

    public function finishInactive(int $timeoutSeconds): int
    {
        $expirationOffset = -abs($timeoutSeconds);
        $stmt = $this->db->prepare(
            "UPDATE interacciones
             SET
                fin_at = COALESCE(ultima_actividad_at, inicio_at),
                duracion_segundos = GREATEST(
                    0,
                    TIMESTAMPDIFF(
                        SECOND,
                        inicio_at,
                        COALESCE(ultima_actividad_at, inicio_at)
                    )
                ),
                estado = 'finalizada'
             WHERE estado = 'activa'
               AND COALESCE(ultima_actividad_at, inicio_at) < TIMESTAMPADD(
                   SECOND,
                   ?,
                   UTC_TIMESTAMP()
               )"
        );
        $stmt->bind_param("i", $expirationOffset);
        $stmt->execute();
        $finishedCount = $stmt->affected_rows;
        $stmt->close();

        return $finishedCount;
    }

    public function getSummary(): array
    {
        $result = $this->db->query(
            "SELECT
                COUNT(*) AS total,
                SUM(estado = 'activa') AS activas,
                SUM(estado = 'finalizada') AS finalizadas,
                ROUND(AVG(
                    CASE
                        WHEN estado = 'finalizada' THEN duracion_segundos
                        ELSE NULL
                    END
                )) AS duracion_promedio_segundos
             FROM interacciones"
        );

        if (!$result) {
            throw new RuntimeException(
                "No fue posible obtener el resumen de interacciones: " . $this->db->error
            );
        }

        $row = $result->fetch_assoc() ?: [];

        return [
            "total" => (int) ($row["total"] ?? 0),
            "activas" => (int) ($row["activas"] ?? 0),
            "finalizadas" => (int) ($row["finalizadas"] ?? 0),
            "duracion_promedio_segundos" => isset($row["duracion_promedio_segundos"])
                ? (int) $row["duracion_promedio_segundos"]
                : null,
        ];
    }

    private function existsWithStatus(string $tokenHash, ?string $status = null): bool
    {
        $sql = "SELECT id
                FROM interacciones
                WHERE token_hash = ?";

        if ($status !== null) {
            $sql .= " AND estado = ?";
        }

        $sql .= " LIMIT 1";
        $stmt = $this->db->prepare($sql);

        if ($status === null) {
            $stmt->bind_param("s", $tokenHash);
        } else {
            $stmt->bind_param("ss", $tokenHash, $status);
        }

        $stmt->execute();
        $exists = $stmt->get_result()->num_rows === 1;
        $stmt->close();

        return $exists;
    }
}
