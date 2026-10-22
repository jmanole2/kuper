<?php

declare(strict_types=1);

class Dispositivo
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
                d.id,
                d.uuid,
                d.nombre,
                d.ubicacion,
                d.estado,
                d.equipo,
                d.version_app,
                d.ultima_ip,
                d.ultima_conexion_at,
                d.activado_at,
                d.codigo_expira_at,
                d.created_at,
                (d.codigo_hash IS NOT NULL AND d.codigo_expira_at > UTC_TIMESTAMP()) AS codigo_vigente,
                (SELECT COUNT(*) FROM interacciones i WHERE i.dispositivo_id = d.id) AS interacciones
             FROM dispositivos d
             ORDER BY d.nombre ASC, d.id ASC"
        );

        if (!$result) {
            throw new RuntimeException(
                "No fue posible consultar los dispositivos: " . $this->db->error
            );
        }

        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public function create(string $nombre, ?string $ubicacion, string $codigoHash, string $expiraAt): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO dispositivos (nombre, ubicacion, estado, codigo_hash, codigo_expira_at)
             VALUES (?, ?, 'pendiente', ?, ?)"
        );
        $stmt->bind_param("ssss", $nombre, $ubicacion, $codigoHash, $expiraAt);
        $stmt->execute();
        $id = (int) $stmt->insert_id;
        $stmt->close();

        return $id;
    }

    public function setActivationCode(int $id, string $codigoHash, string $expiraAt): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE dispositivos
             SET codigo_hash = ?, codigo_expira_at = ?
             WHERE id = ? AND estado <> 'revocado'"
        );
        $stmt->bind_param("ssi", $codigoHash, $expiraAt, $id);
        $stmt->execute();
        $updated = $stmt->affected_rows === 1;
        $stmt->close();

        return $updated;
    }

    /**
     * Canjea un código vigente: guarda el UUID y el token del equipo
     * y elimina el código para que no pueda reutilizarse.
     */
    public function activate(
        string $codigoHash,
        string $uuid,
        string $tokenHash,
        ?string $equipo,
        ?string $version,
        ?string $ip
    ): ?int {
        $this->db->begin_transaction();

        try {
            $stmt = $this->db->prepare(
                "SELECT id
                 FROM dispositivos
                 WHERE codigo_hash = ?
                   AND codigo_expira_at > UTC_TIMESTAMP()
                   AND estado <> 'revocado'
                 LIMIT 1
                 FOR UPDATE"
            );
            $stmt->bind_param("s", $codigoHash);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$row) {
                $this->db->rollback();
                return null;
            }

            $id = (int) $row["id"];

            // Si el UUID estaba en otro registro (reinstalación), se libera.
            $stmt = $this->db->prepare(
                "UPDATE dispositivos
                 SET uuid = NULL, token_hash = NULL, estado = 'revocado'
                 WHERE uuid = ? AND id <> ?"
            );
            $stmt->bind_param("si", $uuid, $id);
            $stmt->execute();
            $stmt->close();

            $stmt = $this->db->prepare(
                "UPDATE dispositivos
                 SET
                    uuid = ?,
                    token_hash = ?,
                    estado = 'activo',
                    codigo_hash = NULL,
                    codigo_expira_at = NULL,
                    equipo = ?,
                    version_app = ?,
                    ultima_ip = ?,
                    ultima_conexion_at = UTC_TIMESTAMP(),
                    activado_at = UTC_TIMESTAMP()
                 WHERE id = ?"
            );
            $stmt->bind_param("sssssi", $uuid, $tokenHash, $equipo, $version, $ip, $id);
            $stmt->execute();
            $stmt->close();

            $this->db->commit();

            return $id;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    public function findActiveByTokenHash(string $tokenHash): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, uuid, nombre, ubicacion
             FROM dispositivos
             WHERE token_hash = ? AND estado = 'activo'
             LIMIT 1"
        );
        $stmt->bind_param("s", $tokenHash);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        return $row ?: null;
    }

    public function touch(int $id, ?string $equipo, ?string $version, ?string $ip): void
    {
        $stmt = $this->db->prepare(
            "UPDATE dispositivos
             SET
                ultima_conexion_at = UTC_TIMESTAMP(),
                equipo = COALESCE(?, equipo),
                version_app = COALESCE(?, version_app),
                ultima_ip = COALESCE(?, ultima_ip)
             WHERE id = ?"
        );
        $stmt->bind_param("sssi", $equipo, $version, $ip, $id);
        $stmt->execute();
        $stmt->close();
    }

    public function revoke(int $id): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE dispositivos
             SET estado = 'revocado', token_hash = NULL, codigo_hash = NULL, codigo_expira_at = NULL
             WHERE id = ?"
        );
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $updated = $stmt->affected_rows === 1;
        $stmt->close();

        return $updated;
    }

    public function getSummary(int $onlineSeconds): array
    {
        $offset = -abs($onlineSeconds);
        $stmt = $this->db->prepare(
            "SELECT
                SUM(estado = 'activo') AS activos,
                SUM(estado = 'activo' AND ultima_conexion_at >= TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP())) AS conectados
             FROM dispositivos"
        );
        $stmt->bind_param("i", $offset);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc() ?: [];
        $stmt->close();

        return [
            "activos" => (int) ($row["activos"] ?? 0),
            "conectados" => (int) ($row["conectados"] ?? 0),
        ];
    }
}
