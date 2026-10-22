<?php

declare(strict_types=1);

class OpinionController
{
    private OpinionService $service;

    public function __construct(?OpinionService $service = null)
    {
        $this->service = $service ?? new OpinionService();
    }

    public function index(): array
    {
        return $this->service->getOpiniones();
    }

    public function summary(): array
    {
        return $this->service->getSummary();
    }

    public function create(array $payload, ?int $dispositivoId): array
    {
        return $this->service->create($payload, $dispositivoId);
    }
}
