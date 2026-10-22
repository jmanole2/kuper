<?php

declare(strict_types=1);

class InteraccionController
{
    private InteraccionService $service;

    public function __construct(?InteraccionService $service = null)
    {
        $this->service = $service ?? new InteraccionService();
    }

    public function index(): array
    {
        return $this->service->getInteracciones();
    }

    public function start(?int $dispositivoId = null): array
    {
        return [
            "token" => $this->service->start($dispositivoId),
        ];
    }

    public function sync(int $dispositivoId, array $payload): bool
    {
        return $this->service->sync($dispositivoId, $payload);
    }

    public function finish(string $token): bool
    {
        return $this->service->finish($token);
    }

    public function heartbeat(string $token): bool
    {
        return $this->service->heartbeat($token);
    }

    public function summary(): array
    {
        return $this->service->getSummary();
    }
}
