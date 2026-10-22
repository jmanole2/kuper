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

    public function start(): array
    {
        return [
            "token" => $this->service->start(),
        ];
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
