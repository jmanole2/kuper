<?php

declare(strict_types=1);

/**
 * Validaciones comunes para la API pública.
 */
final class Input
{
    public static function text(array $data, string $key, int $maxLength, bool $required = true, int $minLength = 1): ?string
    {
        $value = $data[$key] ?? null;

        if ($value !== null && !is_string($value) && !is_int($value)) {
            throw new ValidationException("El campo {$key} no es válido.");
        }

        $value = trim(preg_replace('/\s+/u', " ", (string) $value) ?? "");

        if ($value === "") {
            if ($required) {
                throw new ValidationException("Falta el campo {$key}.");
            }

            return null;
        }

        $length = mb_strlen($value, "UTF-8");

        if ($length < $minLength || $length > $maxLength) {
            throw new ValidationException("El campo {$key} no tiene una longitud válida.");
        }

        return $value;
    }

    public static function longText(array $data, string $key, int $maxLength, int $minLength = 1): string
    {
        $value = $data[$key] ?? null;

        if (!is_string($value)) {
            throw new ValidationException("Falta el campo {$key}.");
        }

        $value = trim(str_replace("\r\n", "\n", $value));
        $length = mb_strlen($value, "UTF-8");

        if ($length < $minLength || $length > $maxLength) {
            throw new ValidationException("El campo {$key} no tiene una longitud válida.");
        }

        return $value;
    }

    public static function email(array $data, string $key): string
    {
        $value = strtolower((string) self::text($data, $key, 254));

        if (filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
            throw new ValidationException("El correo electrónico no es válido.");
        }

        return $value;
    }

    public static function oneOf(array $data, string $key, array $allowed): string
    {
        $value = $data[$key] ?? null;

        if (!is_string($value) || !in_array($value, $allowed, true)) {
            throw new ValidationException("El campo {$key} no es válido.");
        }

        return $value;
    }

    public static function uuid(array $data, string $key): string
    {
        $value = strtolower(trim((string) ($data[$key] ?? "")));

        if (!self::isUuid($value)) {
            throw new ValidationException("El campo {$key} debe ser un UUID válido.");
        }

        return $value;
    }

    public static function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $value) === 1;
    }

    /**
     * Convierte una fecha ISO 8601 a "Y-m-d H:i:s" en UTC.
     * Rechaza fechas de más de un año atrás o más de un día en el futuro.
     */
    public static function utcDateTime(array $data, string $key, bool $required = false): ?string
    {
        $value = $data[$key] ?? null;

        if ($value === null || $value === "") {
            if ($required) {
                throw new ValidationException("Falta el campo {$key}.");
            }

            return null;
        }

        if (!is_string($value)) {
            throw new ValidationException("El campo {$key} no es una fecha válida.");
        }

        try {
            $date = new DateTimeImmutable($value, new DateTimeZone("UTC"));
        } catch (Throwable $e) {
            throw new ValidationException("El campo {$key} no es una fecha válida.");
        }

        $date = $date->setTimezone(new DateTimeZone("UTC"));
        $now = new DateTimeImmutable("now", new DateTimeZone("UTC"));

        if ($date < $now->modify("-1 year") || $date > $now->modify("+1 day")) {
            throw new ValidationException("El campo {$key} está fuera del rango permitido.");
        }

        return $date->format("Y-m-d H:i:s");
    }
}
