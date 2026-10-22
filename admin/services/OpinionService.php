<?php

declare(strict_types=1);

class OpinionService
{
    public const TIPOS = ["felicitacion", "solicitud", "queja"];
    public const GENEROS = ["masculino", "femenino", "no-binario", "otro", "prefiero-no-contestar"];

    private Opinion $model;

    public function __construct(?Opinion $model = null)
    {
        $this->model = $model ?? new Opinion(
            Database::getInstance()->getConnection()
        );
    }

    public function getOpiniones(): array
    {
        return $this->model->getAll();
    }

    public function getSummary(): array
    {
        return $this->model->countByType();
    }

    public function create(array $payload, ?int $dispositivoId): array
    {
        $eventUuid = Input::uuid($payload, "event_uuid");
        $edad = $payload["edad"] ?? null;

        if (is_string($edad) && preg_match('/^\d{1,3}$/', $edad) === 1) {
            $edad = (int) $edad;
        }

        if (!is_int($edad) || $edad < 1 || $edad > 120) {
            throw new ValidationException("La edad no es válida.");
        }

        if (($payload["privacidad"] ?? false) !== true) {
            throw new ValidationException("Es necesario aceptar el aviso de privacidad.");
        }

        $data = [
            "tipo" => Input::oneOf($payload, "tipo", self::TIPOS),
            "nombre" => Input::text($payload, "nombre", 80, true, 2),
            "apellido_paterno" => Input::text($payload, "apellido_paterno", 80, true, 2),
            "apellido_materno" => Input::text($payload, "apellido_materno", 80, false),
            "pais" => Input::text($payload, "pais", 80),
            "correo" => Input::email($payload, "correo"),
            "edad" => $edad,
            "genero" => Input::oneOf($payload, "genero", self::GENEROS),
            "comentario" => Input::longText($payload, "comentario", 800, 5),
        ];

        return $this->model->create(
            $eventUuid,
            $dispositivoId,
            $data,
            Input::utcDateTime($payload, "capturado_at")
        );
    }
}
