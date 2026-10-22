<?php

declare(strict_types=1);

final class DuplicateKey
{
    private const MYSQL_DUPLICATE_ENTRY = 1062;

    public static function matches(Throwable $e): bool
    {
        return $e instanceof mysqli_sql_exception
            && $e->getCode() === self::MYSQL_DUPLICATE_ENTRY;
    }
}
