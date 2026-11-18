<?php
// Crea o actualiza un usuario del panel.
// Uso: php bin/create-user.php <usuario> <admin|jurado> ["Nombre"] [correo]
// La contraseña se pide por consola (no queda en el historial).
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

[$_, $username, $role] = $argv + [null, null, null];
$name = $argv[3] ?? '';
$email = $argv[4] ?? '';
if (!$username || !in_array($role, ['admin', 'jurado'], true)) {
    fwrite(STDERR, "Uso: php bin/create-user.php <usuario> <admin|jurado> [\"Nombre\"] [correo]\n");
    exit(1);
}

$pass = getenv('KV_PASSWORD') ?: null;
if (!$pass) {
    fwrite(STDOUT, 'Contraseña (mín. 12 caracteres): ');
    @shell_exec('stty -echo');
    $pass = trim((string) fgets(STDIN));
    @shell_exec('stty echo');
    fwrite(STDOUT, "\n");
}
if (strlen($pass) < 12) {
    fwrite(STDERR, "La contraseña debe tener al menos 12 caracteres.\n");
    exit(1);
}

db()->prepare(
    'INSERT INTO users (username, name, email, password_hash, role, active, created_at) VALUES (?,?,?,?,?,1,?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), password_hash = VALUES(password_hash), role = VALUES(role), active = 1'
)->execute([$username, $name, $email, password_hash($pass, PASSWORD_DEFAULT), $role, now()]);

echo "Usuario '{$username}' ({$role}) listo.\n";
