<?php

declare(strict_types=1);

class InteraccionService
{
    private const TOKEN_BYTES = 32;
    private const INACTIVE_TIMEOUT_SECONDS = 3 * 60;

    private Interaccion $model;

    public function __construct(?Interaccion $model = null)
    {
        $this->model = $model ?? new Interaccion(
            Database::getInstance()->getConnection()
        );
    }

    public function getInteracciones(): array
    {
        $this->finishInactive();

        return $this->model->getAll();
    }

    public function start(?int $dispositivoId = null): string
    {
        $this->finishInactive();
        $token = bin2hex(random_bytes(self::TOKEN_BYTES));
        $this->model->start($this->hashToken($token), $dispositivoId);

        return $token;
    }

    public function heartbeat(string $token): bool
    {
        $token = $this->normalizeToken($token);

        if ($token === null) {
            return false;
        }

        $this->finishInactive();

        return $this->model->heartbeat($this->hashToken($token));
    }

    public function finish(string $token): bool
    {
        $token = $this->normalizeToken($token);

        if ($token === null) {
            return false;
        }

        $this->finishInactive();

        return $this->model->finish($this->hashToken($token));
    }

    /**
     * Guarda una interacción medida por el programa local (puede llegar tarde
     * si el equipo estuvo sin internet).
     */
    public function sync(int $dispositivoId, array $payload): bool
    {
        $uuid = Input::uuid($payload, "interaction_uuid");
        $inicioAt = Input::utcDateTime($payload, "inicio_at", true);
        $finAt = Input::utcDateTime($payload, "fin_at");
        $ultimaActividadAt = Input::utcDateTime($payload, "ultima_actividad_at")
            ?? $finAt
            ?? $inicioAt;
        $duracion = null;

        if ($finAt !== null) {
            $duracion = $payload["duracion_segundos"] ?? null;

            if (!is_int($duracion) || $duracion < 0 || $duracion > 86400) {
                throw new ValidationException("La duración no es válida.");
            }
        }

        if ($ultimaActividadAt < $inicioAt || ($finAt !== null && $finAt < $inicioAt)) {
            throw new ValidationException("Las fechas de la interacción no son consistentes.");
        }

        return $this->model->upsertFromDevice(
            $uuid,
            $dispositivoId,
            $inicioAt,
            $ultimaActividadAt,
            $finAt,
            $duracion,
            $finAt === null ? "activa" : "finalizada"
        );
    }

    public function getSummary(): array
    {
        $this->finishInactive();

        return $this->model->getSummary();
    }

    private function finishInactive(): void
    {
        $this->model->finishInactive(self::INACTIVE_TIMEOUT_SECONDS);
    }

    private function normalizeToken(string $token): ?string
    {
        $token = strtolower(trim($token));

        return preg_match('/^[a-f0-9]{64}$/', $token) ? $token : null;
    }

    private function hashToken(string $token): string
    {
        return hash("sha256", $token);
    }
}
