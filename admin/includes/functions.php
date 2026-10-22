<?php

declare(strict_types=1);

function getUserInfo(int $userId, ?mysqli $connection = null): array
{
    $emptyUser = [
        "id" => 0,
        "usuario" => "",
        "correo" => "",
        "nivel" => "",
        "nombre" => "",
    ];

    if ($userId <= 0) {
        return $emptyUser;
    }

    $connection = $connection ?? Database::getInstance()->getConnection();

    $stmt = $connection->prepare(
        "SELECT *
         FROM users
         WHERE id = ?
         LIMIT 1"
    );

    if (!$stmt) {
        return $emptyUser;
    }

    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) {
        return $emptyUser;
    }

    return [
        "id" => (int) $user["id"],
        "usuario" => (string) ($user["username"] ?? ""),
        "correo" => (string) ($user["correo"] ?? $user["email"] ?? ""),
        "nivel" => (string) ($user["accesslevel"] ?? ""),
        "nombre" => (string) ($user["nombre"] ?? ""),
    ];
}
