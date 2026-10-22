<?php

declare(strict_types=1);

class DashboardController
{
    private RegistroController $registroController;
    private InteraccionController $interaccionController;
    private OpinionController $opinionController;
    private DispositivoController $dispositivoController;

    public function __construct(
        ?RegistroController $registroController = null,
        ?InteraccionController $interaccionController = null,
        ?OpinionController $opinionController = null,
        ?DispositivoController $dispositivoController = null
    ) {
        $this->registroController = $registroController ?? new RegistroController();
        $this->interaccionController = $interaccionController ?? new InteraccionController();
        $this->opinionController = $opinionController ?? new OpinionController();
        $this->dispositivoController = $dispositivoController ?? new DispositivoController();
    }

    public function index(): array
    {
        return [
            "registros" => $this->registroController->count(),
            "interacciones" => $this->interaccionController->summary(),
            "opiniones" => $this->opinionController->summary(),
            "dispositivos" => $this->dispositivoController->summary(),
        ];
    }
}
