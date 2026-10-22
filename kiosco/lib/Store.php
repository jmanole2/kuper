<?php

declare(strict_types=1);

/**
 * Base local SQLite: identidad del equipo, formularios pendientes de enviar
 * e interacciones medidas en esta computadora.
 */
final class Store
{
    private PDO $db;

    public function __construct(string $dataDir)
    {
        if (!is_dir($dataDir) && !mkdir($dataDir, 0770, true) && !is_dir($dataDir)) {
            throw new RuntimeException("No se pudo crear la carpeta de datos: {$dataDir}");
        }

        $this->db = new PDO("sqlite:" . $dataDir . DIRECTORY_SEPARATOR . "kiosco.sqlite", null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        // El servidor web local y el proceso de sincronización usan la base al mismo tiempo.
        $this->db->exec("PRAGMA journal_mode = WAL");
        $this->db->exec("PRAGMA busy_timeout = 5000");
        $this->migrate();
    }

    private function migrate(): void
    {
        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS ajustes (
                clave TEXT PRIMARY KEY,
                valor TEXT
            );

            CREATE TABLE IF NOT EXISTS pendientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_uuid TEXT NOT NULL UNIQUE,
                ruta TEXT NOT NULL,
                payload TEXT NOT NULL,
                intentos INTEGER NOT NULL DEFAULT 0,
                siguiente_intento_at TEXT NOT NULL,
                ultimo_error TEXT,
                estado TEXT NOT NULL DEFAULT 'pendiente',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS interacciones (
                uuid TEXT PRIMARY KEY,
                token_hash TEXT NOT NULL UNIQUE,
                inicio_at TEXT NOT NULL,
                ultima_actividad_at TEXT NOT NULL,
                fin_at TEXT,
                duracion_segundos INTEGER,
                estado TEXT NOT NULL DEFAULT 'activa',
                version INTEGER NOT NULL DEFAULT 1,
                version_enviada INTEGER NOT NULL DEFAULT 0,
                enviado_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_pendientes_estado ON pendientes (estado, siguiente_intento_at);
            CREATE INDEX IF NOT EXISTS idx_interacciones_sync ON interacciones (version_enviada, version);"
        );
    }

    // ---------- Ajustes (identidad del equipo) ----------

    public function get(string $key, ?string $default = null): ?string
    {
        $stmt = $this->db->prepare("SELECT valor FROM ajustes WHERE clave = ?");
        $stmt->execute([$key]);
        $value = $stmt->fetchColumn();

        return $value === false ? $default : $value;
    }

    public function set(string $key, ?string $value): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO ajustes (clave, valor) VALUES (?, ?)
             ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor"
        );
        $stmt->execute([$key, $value]);
    }

    /** UUID de esta computadora; se crea una sola vez. */
    public function deviceUuid(): string
    {
        $uuid = $this->get("uuid");

        if ($uuid === null) {
            $uuid = uuidV4();
            $this->set("uuid", $uuid);
        }

        return $uuid;
    }

    public function isActivated(): bool
    {
        return $this->get("token") !== null;
    }

    // ---------- Formularios pendientes ----------

    public function enqueue(string $eventUuid, string $route, array $payload): void
    {
        // INSERT OR IGNORE: si el kiosco reintenta el mismo envío no se guarda dos veces.
        $stmt = $this->db->prepare(
            "INSERT OR IGNORE INTO pendientes (event_uuid, ruta, payload, siguiente_intento_at, created_at)
             VALUES (?, ?, ?, ?, ?)"
        );
        $now = utcNow();
        $stmt->execute([$eventUuid, $route, json_encode($payload, JSON_UNESCAPED_UNICODE), $now, $now]);
    }

    public function duePending(int $limit = 20): array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM pendientes
             WHERE estado = 'pendiente' AND siguiente_intento_at <= ?
             ORDER BY id ASC
             LIMIT " . (int) $limit
        );
        $stmt->execute([utcNow()]);

        return $stmt->fetchAll();
    }

    /** Enviado y confirmado: se borran los datos personales de esta computadora. */
    public function deletePending(int $id): void
    {
        $this->db->prepare("DELETE FROM pendientes WHERE id = ?")->execute([$id]);
    }

    public function retryPendingLater(int $id, int $attempts, string $error): void
    {
        // Espera progresiva: 15 s, 30 s, 1 min, 2 min… hasta 15 min.
        $delay = min(900, 15 * (2 ** min($attempts, 6)));
        $stmt = $this->db->prepare(
            "UPDATE pendientes
             SET intentos = ?, siguiente_intento_at = ?, ultimo_error = ?
             WHERE id = ?"
        );
        $stmt->execute([$attempts, gmdate("Y-m-d\\TH:i:s\\Z", time() + $delay), mb_substr($error, 0, 300), $id]);
    }

    /** El servidor rechazó los datos: se aparta para revisión y no se reintenta. */
    public function rejectPending(int $id, string $error): void
    {
        $stmt = $this->db->prepare(
            "UPDATE pendientes SET estado = 'rechazado', ultimo_error = ? WHERE id = ?"
        );
        $stmt->execute([mb_substr($error, 0, 300), $id]);
    }

    public function pendingCounts(): array
    {
        $rows = $this->db->query(
            "SELECT estado, COUNT(*) AS total FROM pendientes GROUP BY estado"
        )->fetchAll();
        $counts = ["pendiente" => 0, "rechazado" => 0];

        foreach ($rows as $row) {
            $counts[$row["estado"]] = (int) $row["total"];
        }

        $counts["interacciones"] = (int) $this->db->query(
            "SELECT COUNT(*) FROM interacciones WHERE version_enviada < version"
        )->fetchColumn();

        return $counts;
    }

    // ---------- Interacciones ----------

    public function startInteraction(string $tokenHash): string
    {
        $uuid = uuidV4();
        $now = utcNow();
        $stmt = $this->db->prepare(
            "INSERT INTO interacciones (uuid, token_hash, inicio_at, ultima_actividad_at)
             VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([$uuid, $tokenHash, $now, $now]);

        return $uuid;
    }

    public function touchInteraction(string $tokenHash): bool
    {
        // La actividad no marca la interacción para envío inmediato;
        // el proceso de sincronización la manda como máximo una vez por minuto.
        $stmt = $this->db->prepare(
            "UPDATE interacciones SET ultima_actividad_at = ?
             WHERE token_hash = ? AND estado = 'activa'"
        );
        $stmt->execute([utcNow(), $tokenHash]);

        return $stmt->rowCount() === 1;
    }

    public function finishInteraction(string $tokenHash): bool
    {
        $stmt = $this->db->prepare("SELECT inicio_at, estado FROM interacciones WHERE token_hash = ?");
        $stmt->execute([$tokenHash]);
        $row = $stmt->fetch();

        if (!$row) {
            return false;
        }

        if ($row["estado"] === "activa") {
            $now = utcNow();
            $stmt = $this->db->prepare(
                "UPDATE interacciones
                 SET fin_at = ?, ultima_actividad_at = ?, duracion_segundos = ?,
                     estado = 'finalizada', version = version + 1
                 WHERE token_hash = ? AND estado = 'activa'"
            );
            $stmt->execute([$now, $now, self::secondsBetween($row["inicio_at"], $now), $tokenHash]);
        }

        return true;
    }

    /** Cierra las interacciones abandonadas, igual que el servidor (3 min sin actividad). */
    public function finishInactiveInteractions(int $timeoutSeconds): int
    {
        $limit = gmdate("Y-m-d\\TH:i:s\\Z", time() - $timeoutSeconds);
        $stmt = $this->db->prepare(
            "SELECT uuid, inicio_at, ultima_actividad_at FROM interacciones
             WHERE estado = 'activa' AND ultima_actividad_at < ?"
        );
        $stmt->execute([$limit]);
        $rows = $stmt->fetchAll();
        $update = $this->db->prepare(
            "UPDATE interacciones
             SET fin_at = ultima_actividad_at, duracion_segundos = ?,
                 estado = 'finalizada', version = version + 1
             WHERE uuid = ? AND estado = 'activa'"
        );

        foreach ($rows as $row) {
            $update->execute([self::secondsBetween($row["inicio_at"], $row["ultima_actividad_at"]), $row["uuid"]]);
        }

        return count($rows);
    }

    /**
     * Interacciones por enviar: las nuevas o finalizadas de inmediato, y las
     * activas cuya actividad cambió, como máximo una vez por minuto.
     */
    public function interactionsToSync(int $limit = 50): array
    {
        $minuteAgo = gmdate("Y-m-d\\TH:i:s\\Z", time() - 60);
        $stmt = $this->db->prepare(
            "SELECT * FROM interacciones
             WHERE version_enviada < version
                OR (estado = 'activa' AND (enviado_at IS NULL OR (enviado_at < ? AND ultima_actividad_at > enviado_at)))
             ORDER BY inicio_at ASC
             LIMIT " . (int) $limit
        );
        $stmt->execute([$minuteAgo]);

        return $stmt->fetchAll();
    }

    public function markInteractionSynced(string $uuid, int $version, string $sentAt): void
    {
        $stmt = $this->db->prepare(
            "UPDATE interacciones
             SET version_enviada = MAX(version_enviada, ?), enviado_at = ?
             WHERE uuid = ?"
        );
        $stmt->execute([$version, $sentAt, $uuid]);
    }

    /** Borra el historial local ya enviado (el servidor conserva la copia). */
    public function purgeSyncedInteractions(int $days = 7): void
    {
        $limit = gmdate("Y-m-d\\TH:i:s\\Z", time() - $days * 86400);
        $stmt = $this->db->prepare(
            "DELETE FROM interacciones
             WHERE estado = 'finalizada' AND version_enviada >= version AND fin_at < ?"
        );
        $stmt->execute([$limit]);
    }

    public static function secondsBetween(string $from, string $to): int
    {
        return max(0, min(86400, strtotime($to) - strtotime($from)));
    }
}
