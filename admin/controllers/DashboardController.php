<?php

declare(strict_types=1);

class DashboardController
{
    private RegistroController $registroController;
    private InteraccionController $interaccionController;

    public function __construct(
        ?RegistroController $registroController = null,
        ?InteraccionController $interaccionController = null
    ) {
        $this->registroController = $registroController ?? new RegistroController();
        $this->interaccionController = $interaccionController ?? new InteraccionController();
    }

    public function index(): array
    {
        return [
            "registros" => $this->registroController->count(),
            "interacciones" => $this->interaccionController->summary(),
        ];
    }
}
