<?php

declare(strict_types=1);

class RegistroService
{
    public const RECORRIDOS = ["roma-condesa", "centro", "juarez"];

    private Registro $model;

    public function __construct(?Registro $model = null)
    {
        $this->model = $model ?? new Registro(
            Database::getInstance()->getConnection()
        );
    }

    public function getRegistros(): array
    {
        return $this->model->getAll();
    }

    public function countRegistros(): int
    {
        return $this->model->count();
    }

    public function create(array $payload, ?int $dispositivoId): array
    {
        $eventUuid = Input::uuid($payload, "event_uuid");
        $nombre = Input::text($payload, "nombre", 150, true, 2);
        $correo = Input::email($payload, "correo");
        $recorridos = $payload["recorridos"] ?? null;

        if (!is_array($recorridos) || $recorridos === []) {
            throw new ValidationException("Selecciona al menos un recorrido.");
        }

        $recorridos = array_values(array_unique(array_map("strval", $recorridos)));

        foreach ($recorridos as $recorrido) {
            if (!in_array($recorrido, self::RECORRIDOS, true)) {
                throw new ValidationException("El recorrido seleccionado no es válido.");
            }
        }

        return $this->model->create(
            $eventUuid,
            $dispositivoId,
            $nombre,
            $correo,
            implode(",", $recorridos),
            Input::utcDateTime($payload, "capturado_at")
        );
    }
}
