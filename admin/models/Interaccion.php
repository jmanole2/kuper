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
                i.id,
                i.inicio_at,
                i.fin_at,
                i.duracion_segundos,
                i.estado,
                d.nombre AS dispositivo
             FROM interacciones i
             LEFT JOIN dispositivos d ON d.id = i.dispositivo_id
             ORDER BY i.inicio_at DESC, i.id DESC"
        );

        if (!$result) {
            throw new RuntimeException(
                "No fue posible consultar las interacciones: " . $this->db->error
            );
        }

        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public function start(string $tokenHash, ?int $dispositivoId = null): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO interacciones (
                token_hash,
                dispositivo_id,
                inicio_at,
                ultima_actividad_at,
                estado
             ) VALUES (?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), 'activa')"
        );
        $stmt->bind_param("si", $tokenHash, $dispositivoId);
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

    /**
     * Crea o actualiza una interacción registrada por el programa local.
     * Devuelve false si el UUID pertenece a otro dispositivo.
     */
    public function upsertFromDevice(
        string $uuid,
        int $dispositivoId,
        string $inicioAt,
        string $ultimaActividadAt,
        ?string $finAt,
        ?int $duracionSegundos,
        string $estado
    ): bool {
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $stmt = $this->db->prepare(
                "SELECT id, dispositivo_id FROM interacciones WHERE interaction_uuid = ? LIMIT 1"
            );
            $stmt->bind_param("s", $uuid);
            $stmt->execute();
            $existing = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if ($existing) {
                if ((int) $existing["dispositivo_id"] !== $dispositivoId) {
                    return false;
                }

                // Una interacción finalizada no vuelve a quedar activa.
                $stmt = $this->db->prepare(
                    "UPDATE interacciones
                     SET
                        ultima_actividad_at = GREATEST(ultima_actividad_at, ?),
                        fin_at = IF(estado = 'finalizada', fin_at, ?),
                        duracion_segundos = IF(estado = 'finalizada', duracion_segundos, ?),
                        estado = IF(estado = 'finalizada', 'finalizada', ?)
                     WHERE id = ?"
                );
                $id = (int) $existing["id"];
                $stmt->bind_param("ssisi", $ultimaActividadAt, $finAt, $duracionSegundos, $estado, $id);
                $stmt->execute();
                $stmt->close();

                return true;
            }

            $stmt = $this->db->prepare(
                "INSERT INTO interacciones (
                    interaction_uuid, dispositivo_id, inicio_at, ultima_actividad_at,
                    fin_at, duracion_segundos, estado
                 ) VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->bind_param(
                "sisssis",
                $uuid,
                $dispositivoId,
                $inicioAt,
                $ultimaActividadAt,
                $finAt,
                $duracionSegundos,
                $estado
            );

            try {
                $stmt->execute();
                $stmt->close();

                return true;
            } catch (mysqli_sql_exception $e) {
                $stmt->close();

                // Otro envío simultáneo la creó primero: se actualiza en la siguiente vuelta.
                if (!DuplicateKey::matches($e)) {
                    throw $e;
                }
            }
        }

        return false;
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
