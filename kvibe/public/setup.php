<?php
/*
 * Instalación de un solo uso (para hosting sin SSH).
 * - Revisa requisitos y la conexión a MySQL
 * - Crea las tablas (sql/schema.sql)
 * - Crea el usuario administrador del panel
 * - Envía un correo de prueba por SMTP (opcional)
 *
 * Solo funciona si 'setup_token' está definido en app/config.local.php
 * y NO existe storage/setup.lock. Al terminar se bloquea sola.
 */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

header('X-Robots-Tag: noindex, nofollow');
$lock = STORAGE . '/setup.lock';
$token = (string) cfg('setup_token', '');
if ($token === '' || strlen($token) < 16 || is_file($lock)) {
    http_response_code(404);
    exit('No encontrado.');
}

function ini_bytes(string $k): int
{
    $v = trim((string) ini_get($k));
    $n = (int) $v;
    return match (strtolower(substr($v, -1))) { 'g' => $n << 30, 'm' => $n << 20, 'k' => $n << 10, default => $n };
}

// ---- Diagnóstico ----
$checks = [];
$checks[] = ['PHP 8.1 o superior', version_compare(PHP_VERSION, '8.1.0', '>='), PHP_VERSION];
foreach (['pdo_mysql', 'gd', 'fileinfo', 'exif', 'curl', 'mbstring', 'openssl'] as $ext) {
    $checks[] = ["Extensión {$ext}", extension_loaded($ext), ''];
}
foreach (['uploads/pending', 'uploads/entries', 'uploads/thumbs', 'logs', 'backups'] as $d) {
    $checks[] = ["storage/{$d} con permiso de escritura", is_writable(STORAGE . '/' . $d), ''];
}
$checks[] = ['Límite de subida (upload_max_filesize)', ini_bytes('upload_max_filesize') >= 10 * 1048576, ini_get('upload_max_filesize')];
$checks[] = ['Límite POST (post_max_size)', ini_bytes('post_max_size') >= 11 * 1048576, ini_get('post_max_size')];
$dbError = null;
try {
    db()->query('SELECT 1');
    $checks[] = ['Conexión a MySQL', true, cfg('db.host') . ' / ' . cfg('db.name')];
} catch (Throwable $ex) {
    $dbError = $ex->getMessage();
    $checks[] = ['Conexión a MySQL', false, $dbError];
}
$checks[] = ['Captcha configurado', cfg('captcha.provider') === 'none' || (cfg('captcha.site_key') && cfg('captcha.secret')), (string) cfg('captcha.provider')];

$result = [];
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        csrf_check();
        if (!hash_equals($token, (string) ($_POST['token'] ?? ''))) {
            usleep(800000);
            throw new UserError('Token incorrecto.');
        }
        if ($dbError) throw new UserError('Primero corrige la conexión a MySQL en app/config.local.php.');

        $username = trim((string) ($_POST['username'] ?? ''));
        $pass = (string) ($_POST['password'] ?? '');
        if (!preg_match('/^[a-zA-Z0-9._-]{3,60}$/', $username)) throw new UserError('Usuario: 3 a 60 caracteres (letras, números, punto, guion).');
        if (strlen($pass) < 12) throw new UserError('La contraseña debe tener al menos 12 caracteres.');
        if ($pass !== (string) ($_POST['password2'] ?? '')) throw new UserError('Las contraseñas no coinciden.');

        // 1) Tablas
        $sql = file_get_contents(APP_ROOT . '/sql/schema.sql');
        $n = 0;
        foreach (preg_split('/;\s*(\r?\n|$)/', $sql) as $stmt) {
            $clean = trim(preg_replace('/^\s*--.*$/m', '', $stmt));
            if ($clean === '') continue;
            db()->exec($clean);
            $n++;
        }
        $result[] = "Base de datos lista ({$n} instrucciones, tablas creadas si no existían).";

        // 2) Administrador
        db()->prepare(
            'INSERT INTO users (username, name, email, password_hash, role, active, created_at) VALUES (?,?,?,?,"admin",1,?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = "admin", active = 1'
        )->execute([$username, trim((string) ($_POST['name'] ?? '')), '', password_hash($pass, PASSWORD_DEFAULT), now()]);
        $result[] = "Usuario administrador «{$username}» creado.";

        // 3) Correo de prueba
        $test = normalize_email($_POST['test_email'] ?? '');
        if ($test) {
            try {
                send_code_email($test, 'Prueba', '123456');
                $result[] = "Correo de prueba enviado a {$test}. Revisa bandeja y spam (prueba con Gmail y Outlook).";
            } catch (Throwable $ex) {
                $result[] = 'ERROR al enviar correo: ' . $ex->getMessage();
            }
        }

        file_put_contents($lock, 'instalado ' . now() . "\n");
        $result[] = 'Instalación bloqueada (storage/setup.lock). Para volver a usarla, borra ese archivo por FTP.';
    } catch (UserError $ex) {
        $error = $ex->getMessage();
    } catch (Throwable $ex) {
        $error = 'Error: ' . $ex->getMessage();
    }
}

view('admin/setup', compact('checks', 'result', 'error'), 'admin/layout');
