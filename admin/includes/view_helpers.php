<?php

declare(strict_types=1);

function adminEscape($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, "UTF-8");
}

function adminFormatDate(?string $value): string
{
    if ($value === null || $value === "") {
        return "—";
    }

    try {
        $date = new DateTimeImmutable($value, new DateTimeZone("UTC"));

        return $date
            ->setTimezone(new DateTimeZone("America/Mexico_City"))
            ->format("d/m/Y H:i:s");
    } catch (Throwable $e) {
        return "—";
    }
}

function adminFormatDuration(?int $seconds): string
{
    if ($seconds === null) {
        return "—";
    }

    $seconds = max(0, $seconds);
    $hours = intdiv($seconds, 3600);
    $minutes = intdiv($seconds % 3600, 60);
    $remainingSeconds = $seconds % 60;

    if ($hours > 0) {
        return sprintf("%d h %02d min %02d s", $hours, $minutes, $remainingSeconds);
    }

    if ($minutes > 0) {
        return sprintf("%d min %02d s", $minutes, $remainingSeconds);
    }

    return sprintf("%d s", $remainingSeconds);
}
