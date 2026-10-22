<?php

declare(strict_types=1);

class RegistroController
{
    private RegistroService $service;

    public function __construct(?RegistroService $service = null)
    {
        $this->service = $service ?? new RegistroService();
    }

    public function index(): array
    {
        return $this->service->getRegistros();
    }

    public function count(): int
    {
        return $this->service->countRegistros();
    }

    public function create(array $payload, ?int $dispositivoId): array
    {
        return $this->service->create($payload, $dispositivoId);
    }
}
