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

    public function start(): string
    {
        $this->finishInactive();
        $token = bin2hex(random_bytes(self::TOKEN_BYTES));
        $this->model->start($this->hashToken($token));

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
