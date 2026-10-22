<?php

declare(strict_types=1);

class Opinion
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
                o.id,
                o.tipo,
                o.nombre,
                o.apellido_paterno,
                o.apellido_materno,
                o.pais,
                o.correo,
                o.edad,
                o.genero,
                o.comentario,
                o.created_at,
                d.nombre AS dispositivo
             FROM opiniones o
             LEFT JOIN dispositivos d ON d.id = o.dispositivo_id
             ORDER BY o.created_at DESC, o.id DESC"
        );

        if (!$result) {
            throw new RuntimeException(
                "No fue posible consultar las opiniones: " . $this->db->error
            );
        }

        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public function countByType(): array
    {
        $result = $this->db->query(
            "SELECT
                COUNT(*) AS total,
                SUM(tipo = 'felicitacion') AS felicitaciones,
                SUM(tipo = 'solicitud') AS solicitudes,
                SUM(tipo = 'queja') AS quejas
             FROM opiniones"
        );

        if (!$result) {
            throw new RuntimeException(
                "No fue posible contar las opiniones: " . $this->db->error
            );
        }

        $row = $result->fetch_assoc() ?: [];

        return [
            "total" => (int) ($row["total"] ?? 0),
            "felicitaciones" => (int) ($row["felicitaciones"] ?? 0),
            "solicitudes" => (int) ($row["solicitudes"] ?? 0),
            "quejas" => (int) ($row["quejas"] ?? 0),
        ];
    }

    /**
     * Inserta una opinión. Si el event_uuid ya existe devuelve el id existente.
     */
    public function create(string $eventUuid, ?int $dispositivoId, array $data, ?string $capturadoAt): array
    {
        $stmt = $this->db->prepare(
            "INSERT INTO opiniones (
                event_uuid, dispositivo_id, tipo, nombre, apellido_paterno, apellido_materno,
                pais, correo, edad, genero, comentario, acepta_privacidad, capturado_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)"
        );
        $stmt->bind_param(
            "sissssssisss",
            $eventUuid,
            $dispositivoId,
            $data["tipo"],
            $data["nombre"],
            $data["apellido_paterno"],
            $data["apellido_materno"],
            $data["pais"],
            $data["correo"],
            $data["edad"],
            $data["genero"],
            $data["comentario"],
            $capturadoAt
        );

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

        $stmt = $this->db->prepare("SELECT id FROM opiniones WHERE event_uuid = ? LIMIT 1");
        $stmt->bind_param("s", $eventUuid);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        return ["id" => (int) ($row["id"] ?? 0), "duplicado" => true];
    }
}
