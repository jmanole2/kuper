<?php

declare(strict_types=1);

class RegistroService
{
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
}
