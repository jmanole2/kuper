<?php
declare(strict_types=1);
require __DIR__ . '/../../app/bootstrap.php';

header('X-Robots-Tag: noindex, nofollow');
$a = $_GET['a'] ?? 'list';

/* ---------- Login / logout ---------- */
if ($a === 'login') {
    $error = null;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        try {
            csrf_check();
            rate_check('login_per_ip', client_ip());
            $st = db()->prepare('SELECT * FROM users WHERE username = ? AND active = 1');
            $st->execute([trim((string) ($_POST['username'] ?? ''))]);
            $u = $st->fetch();
            if (!$u || !password_verify((string) ($_POST['password'] ?? ''), $u['password_hash'])) {
                throw new UserError('Usuario o contraseña incorrectos.');
            }
            if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
                db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                    ->execute([password_hash((string) $_POST['password'], PASSWORD_DEFAULT), $u['id']]);
            }
            db()->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([now(), $u['id']]);
            session_regenerate_id(true);
            $_SESSION['user'] = ['id' => (int) $u['id'], 'username' => $u['username'], 'name' => $u['name'], 'role' => $u['role']];
            redirect('admin/');
        } catch (UserError $ex) {
            $error = $ex->getMessage();
        }
    }
    view('admin/login', ['error' => $error], 'admin/layout');
    exit;
}

if ($a === 'logout') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        csrf_check();
        $_SESSION = [];
        session_regenerate_id(true);
    }
    redirect('admin/?a=login');
}

/* ---------- Foto (sirve archivos fuera del webroot) ---------- */
if ($a === 'photo') {
    require_role('admin', 'jurado');
    $st = db()->prepare('SELECT photo_file FROM entries WHERE public_id = ?');
    $st->execute([(string) ($_GET['id'] ?? '')]);
    $file = $st->fetchColumn();
    $dir = ($_GET['size'] ?? '') === 'thumb' ? 'thumbs' : 'entries';
    $path = $file ? STORAGE . "/uploads/{$dir}/{$file}" : null;
    if (!$path || !is_file($path)) {
        if ($file && $dir === 'thumbs') $path = STORAGE . "/uploads/entries/{$file}";
        if (!$path || !is_file($path)) { http_response_code(404); exit('No encontrada'); }
    }
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, max-age=86400');
    if (isset($_GET['download'])) header('Content-Disposition: attachment; filename="' . preg_replace('/\W/', '', $_GET['id']) . '.jpg"');
    readfile($path);
    exit;
}

/* ---------- Exportación CSV (abre en Excel) ---------- */
if ($a === 'export') {
    require_role('admin');
    $cats = cfg('categories');
    $fn = 'kvibe-participaciones-' . date('Ymd-His') . '.csv';
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $fn . '"');
    header('Cache-Control: no-store');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM para que Excel respete acentos
    $safe = fn($v) => is_string($v) && $v !== '' && strpbrk($v[0], "=+-@\t\r") !== false ? "'" . $v : $v;
    fputcsv($out, ['Folio', 'Fecha y hora', 'Origen QR', 'Nombre', 'Apellido', 'Correo', 'Celular',
        'Categoría (code)', 'Categoría', 'Slogan', 'Foto (URL panel)', 'T&C versión', 'T&C aceptado',
        'Aviso versión', 'Aviso aceptado', 'Correo verificado'], ',', '"', '');
    $base = rtrim((string) cfg('base_url'), '/') . base_path();
    $st = db()->query('SELECT * FROM entries ORDER BY created_at ASC');
    while ($r = $st->fetch()) {
        fputcsv($out, array_map($safe, [
            $r['public_id'], $r['created_at'], $r['src'], $r['first_name'], $r['last_name'], $r['email'], $r['phone'],
            $r['category'] ?? '', $r['category'] ? ($cats[$r['category']] ?? $r['category']) : '', $r['slogan'],
            $base . '/admin/?a=photo&id=' . $r['public_id'],
            $r['terms_version'], $r['terms_accepted_at'], $r['privacy_version'], $r['privacy_accepted_at'], $r['email_verified_at'],
        ]), ',', '"', '');
    }
    fclose($out);
    exit;
}

/* ---------- Listado ---------- */
$user = require_role('admin');
$q = trim((string) ($_GET['q'] ?? ''));
$page = max(1, (int) ($_GET['p'] ?? 1));
$per = 50;
$where = '';
$args = [];
if ($q !== '') {
    $where = 'WHERE public_id = ? OR email LIKE ? OR phone LIKE ? OR CONCAT(first_name, " ", last_name) LIKE ? OR slogan LIKE ?';
    $like = '%' . addcslashes($q, '%_\\') . '%';
    $args = [strtoupper($q), $like, $like, $like, $like];
}
$st = db()->prepare("SELECT COUNT(*) FROM entries {$where}");
$st->execute($args);
$total = (int) $st->fetchColumn();
$st = db()->prepare("SELECT * FROM entries {$where} ORDER BY created_at DESC LIMIT {$per} OFFSET " . (($page - 1) * $per));
$st->execute($args);
$rows = $st->fetchAll();

$stats = [
    'total'   => (int) db()->query('SELECT COUNT(*) FROM entries')->fetchColumn(),
    'today'   => (int) db()->query("SELECT COUNT(*) FROM entries WHERE created_at >= CURDATE()")->fetchColumn(),
    'pending' => (int) db()->query('SELECT COUNT(*) FROM pending_entries')->fetchColumn(),
    'by_src'  => db()->query('SELECT src, COUNT(*) n FROM entries GROUP BY src ORDER BY n DESC')->fetchAll(),
    'by_cat'  => db()->query('SELECT COALESCE(category, "—") c, COUNT(*) n FROM entries GROUP BY category ORDER BY n DESC')->fetchAll(),
];

view('admin/list', compact('user', 'rows', 'total', 'page', 'per', 'q', 'stats'), 'admin/layout');
