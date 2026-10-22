<?php

declare(strict_types=1);

class DispositivoService
{
    /** Tiempo sin heartbeat tras el cual el equipo se muestra como desconectado. */
    public const ONLINE_SECONDS = 3 * 60;

    private const TOKEN_BYTES = 32;
    private const CODE_TTL = "+7 days";
    private const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private const CODE_LENGTH = 8;

    private Dispositivo $model;

    public function __construct(?Dispositivo $model = null)
    {
        $this->model = $model ?? new Dispositivo(
            Database::getInstance()->getConnection()
        );
    }

    public function getDispositivos(): array
    {
        return $this->model->getAll();
    }

    public function getSummary(): array
    {
        return $this->model->getSummary(self::ONLINE_SECONDS);
    }

    /**
     * Registra un equipo pendiente y devuelve su código de activación
     * (solo se muestra una vez; en la base se guarda su hash).
     */
    public function create(string $nombre, ?string $ubicacion): array
    {
        $nombre = Input::text(["nombre" => $nombre], "nombre", 120, true, 2);
        $ubicacion = Input::text(["ubicacion" => $ubicacion], "ubicacion", 160, false);
        $code = $this->generateCode();
        $id = $this->model->create($nombre, $ubicacion, $this->hashCode($code), $this->codeExpiration());

        return ["id" => $id, "codigo" => $code];
    }

    public function regenerateCode(int $id): ?string
    {
        $code = $this->generateCode();

        return $this->model->setActivationCode($id, $this->hashCode($code), $this->codeExpiration())
            ? $code
            : null;
    }

    public function revoke(int $id): bool
    {
        return $this->model->revoke($id);
    }

    /**
     * Canjea el código de activación desde el programa local.
     */
    public function activate(array $payload, ?string $ip): array
    {
        $code = $this->normalizeCode((string) ($payload["codigo"] ?? ""));

        if ($code === null) {
            throw new ValidationException("El código de activación no es válido.");
        }

        $uuid = Input::uuid($payload, "uuid");
        $equipo = Input::text($payload, "equipo", 120, false);
        $version = Input::text($payload, "version", 40, false);
        $token = bin2hex(random_bytes(self::TOKEN_BYTES));

        $id = $this->model->activate(
            $this->hashCode($code),
            $uuid,
            $this->hashToken($token),
            $equipo,
            $version,
            $ip
        );

        if ($id === null) {
            throw new ValidationException("El código de activación no existe o ya expiró.");
        }

        return [
            "dispositivo_id" => $id,
            "uuid" => $uuid,
            "token" => $token,
        ];
    }

    /**
     * Devuelve el dispositivo activo dueño del token, o null.
     */
    public function authenticate(string $token): ?array
    {
        $token = strtolower(trim($token));

        if (preg_match('/^[a-f0-9]{64}$/', $token) !== 1) {
            return null;
        }

        $device = $this->model->findActiveByTokenHash($this->hashToken($token));

        if ($device === null) {
            return null;
        }

        $device["id"] = (int) $device["id"];

        return $device;
    }

    public function heartbeat(array $device, array $payload, ?string $ip): void
    {
        $this->model->touch(
            (int) $device["id"],
            Input::text($payload, "equipo", 120, false),
            Input::text($payload, "version", 40, false),
            $ip
        );
    }

    private function generateCode(): string
    {
        $alphabetLength = strlen(self::CODE_ALPHABET);
        $code = "";

        for ($i = 0; $i < self::CODE_LENGTH; $i++) {
            $code .= self::CODE_ALPHABET[random_int(0, $alphabetLength - 1)];
        }

        return substr($code, 0, 4) . "-" . substr($code, 4);
    }

    private function normalizeCode(string $code): ?string
    {
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', "", $code) ?? "");

        if (strlen($code) !== self::CODE_LENGTH) {
            return null;
        }

        return substr($code, 0, 4) . "-" . substr($code, 4);
    }

    private function codeExpiration(): string
    {
        return (new DateTimeImmutable("now", new DateTimeZone("UTC")))
            ->modify(self::CODE_TTL)
            ->format("Y-m-d H:i:s");
    }

    private function hashCode(string $code): string
    {
        return hash("sha256", "codigo:" . $code);
    }

    private function hashToken(string $token): string
    {
        return hash("sha256", $token);
    }
}
