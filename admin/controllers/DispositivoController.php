<?php

declare(strict_types=1);

class DispositivoController
{
    private DispositivoService $service;

    public function __construct(?DispositivoService $service = null)
    {
        $this->service = $service ?? new DispositivoService();
    }

    public function index(): array
    {
        return $this->service->getDispositivos();
    }

    public function summary(): array
    {
        return $this->service->getSummary();
    }

    public function create(string $nombre, ?string $ubicacion): array
    {
        return $this->service->create($nombre, $ubicacion);
    }

    public function regenerateCode(int $id): ?string
    {
        return $this->service->regenerateCode($id);
    }

    public function revoke(int $id): bool
    {
        return $this->service->revoke($id);
    }

    public function activate(array $payload, ?string $ip): array
    {
        return $this->service->activate($payload, $ip);
    }

    public function authenticate(string $token): ?array
    {
        return $this->service->authenticate($token);
    }

    public function heartbeat(array $device, array $payload, ?string $ip): void
    {
        $this->service->heartbeat($device, $payload, $ip);
    }
}
