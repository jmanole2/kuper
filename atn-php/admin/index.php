<?php
/**
 * Administrador de Amasando Tu Negocio.
 */
require dirname(__DIR__) . '/includes/bootstrap.php';
require ROOT . '/includes/schemas.php';
require __DIR__ . '/form.php';

// ---------- Sesión segura ----------
session_name('atn_admin');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => (base_path() ?: '') . '/admin',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function admin_url(array $q = []): string
{
    return url('/admin/') . ($q ? '?' . http_build_query($q) : '');
}
function redirect(array $q = []): void
{
    header('Location: ' . admin_url($q));
    exit;
}
function flash(string $msg, string $type = 'ok'): void
{
    $_SESSION['flash'][] = [$type, $msg];
}
function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e($_SESSION['csrf']) . '">';
}
function check_csrf(): void
{
    if (!hash_equals($_SESSION['csrf'] ?? '', (string) ($_POST['csrf'] ?? ''))) {
        http_response_code(400);
        exit('La sesión expiró. Regresa y vuelve a intentarlo.');
    }
}
function current_user(): ?array
{
    if (empty($_SESSION['uid'])) {
        return null;
    }
    $st = db()->prepare('SELECT id, email, name FROM users WHERE id = ?');
    $st->execute([$_SESSION['uid']]);
    return $st->fetch() ?: null;
}
function users_count(): int
{
    return (int) db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
}

$a = $_GET['a'] ?? 'dashboard';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';

// Archivos demasiado grandes: PHP descarta todo el formulario.
if ($isPost && empty($_POST) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    flash('Lo que intentaste subir pesa más de lo que permite el hosting (' . ini_get('post_max_size') . '). Sube los archivos de uno en uno o redúcelos.', 'error');
    header('Location: ' . ($_SERVER['HTTP_REFERER'] ?? admin_url()));
    exit;
}

// ---------- Primer usuario ----------
if (users_count() === 0) {
    if ($isPost) {
        check_csrf();
        $email = trim((string) ($_POST['email'] ?? ''));
        $pass = (string) ($_POST['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 8 || $pass !== ($_POST['password2'] ?? '')) {
            flash('Revisa el correo y que la contraseña tenga al menos 8 caracteres y coincida.', 'error');
        } else {
            db()->prepare('INSERT INTO users (email, name, password, created_at) VALUES (?,?,?,?)')
                ->execute([$email, trim((string) ($_POST['name'] ?? '')), password_hash($pass, PASSWORD_DEFAULT), date('c')]);
            session_regenerate_id(true);
            $_SESSION['uid'] = (int) db()->lastInsertId();
            flash('¡Listo! Tu usuario fue creado.');
            redirect();
        }
    }
    $view = 'setup';
    include __DIR__ . '/views.php';
    exit;
}

// ---------- Login / logout ----------
if ($a === 'logout') {
    $_SESSION = [];
    session_destroy();
    redirect(['a' => 'login']);
}
$user = current_user();
if (!$user) {
    if ($isPost && $a === 'login') {
        check_csrf();
        $st = db()->prepare('SELECT * FROM users WHERE email = ?');
        $st->execute([trim((string) ($_POST['email'] ?? ''))]);
        $u = $st->fetch();
        if ($u && password_verify((string) ($_POST['password'] ?? ''), $u['password'])) {
            session_regenerate_id(true);
            $_SESSION['uid'] = (int) $u['id'];
            if (password_needs_rehash($u['password'], PASSWORD_DEFAULT)) {
                db()->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([password_hash($_POST['password'], PASSWORD_DEFAULT), $u['id']]);
            }
            redirect();
        }
        sleep(1); // frena intentos por fuerza bruta
        flash('Correo o contraseña incorrectos.', 'error');
    }
    $view = 'login';
    include __DIR__ . '/views.php';
    exit;
}

// ---------- Acciones con sesión ----------
$editable = ['home' => 'Inicio', 'comunidad' => 'Comunidad', 'settings' => 'Configuración del sitio'];

function doc_type_of(string $key): ?string
{
    if (in_array($key, ['home', 'comunidad', 'settings'], true)) {
        return $key;
    }
    if (preg_match('/^(programa|pagina):[a-z0-9-]+$/', $key, $m)) {
        return $m[1];
    }
    return null;
}

function public_path_of(string $key): ?string
{
    if ($key === 'home') return '/';
    if ($key === 'comunidad') return '/comunidad';
    if (strpos($key, ':') !== false) return '/' . explode(':', $key, 2)[1];
    return null;
}

switch ($a) {
    case 'edit':
        $key = (string) ($_GET['k'] ?? '');
        $type = doc_type_of($key);
        if (!$type || !doc_exists($key)) {
            flash('Esa página no existe.', 'error');
            redirect();
        }
        $schema = schema_for($type);
        if ($isPost) {
            check_csrf();
            $input = $_POST['data'] ?? [];
            $errors = apply_uploads($input);
            $data = normalize_fields(schema_fields($schema), $input);
            $sort = $type === 'programa' ? (int) ($data['order'] ?? 0) : null;
            doc_save($key, $type, $data, $sort);

            // Cambio de URL (slug) para programas y páginas.
            if (in_array($type, ['programa', 'pagina'], true)) {
                $newSlug = slugify((string) ($_POST['_slug'] ?? ''));
                $oldSlug = explode(':', $key, 2)[1];
                if ($newSlug !== '' && $newSlug !== $oldSlug) {
                    $reserved = ['admin', 'comunidad', 'uploads', 'assets', 'sitemap-xml', 'robots-txt', 'index-php'];
                    if (in_array($newSlug, $reserved, true) || doc_exists('programa:' . $newSlug) || doc_exists('pagina:' . $newSlug)) {
                        $errors[] = 'La URL “/' . $newSlug . '” ya está en uso. Se conservó “/' . $oldSlug . '”.';
                    } else {
                        doc_rename($key, $type . ':' . $newSlug);
                        $key = $type . ':' . $newSlug;
                        flash('La URL cambió a /' . $newSlug . '. Si está en el menú, actualiza el enlace en Configuración → General.', 'warn');
                    }
                }
            }
            foreach ($errors as $err) {
                flash($err, 'error');
            }
            flash('Cambios guardados.');
            redirect(['a' => 'edit', 'k' => $key, 'tab' => $_POST['_tab'] ?? '']);
        }
        $data = doc($key);
        $view = 'edit';
        break;

    case 'list':
        $type = ($_GET['t'] ?? '') === 'pagina' ? 'pagina' : 'programa';
        if ($isPost) {
            check_csrf();
            $name = trim((string) ($_POST['name'] ?? ''));
            $slug = slugify((string) (($_POST['slug'] ?? '') ?: $name));
            if ($name === '' || $slug === '') {
                flash('Escribe un nombre.', 'error');
            } elseif (doc_exists('programa:' . $slug) || doc_exists('pagina:' . $slug) || in_array($slug, ['admin', 'comunidad', 'uploads', 'assets'], true)) {
                flash('Ya existe una página con la URL /' . $slug . '.', 'error');
            } else {
                if ($type === 'programa') {
                    $from = (string) ($_POST['copy'] ?? '');
                    $data = ($from && doc_exists($from)) ? doc($from) : [];
                    $data['name'] = $name;
                    $data['order'] = count(docs_of('programa')) + 1;
                    $data['hero']['subtitle'] = $name;
                    $data['seo'] = ['title' => '', 'description' => '', 'image' => null, 'noIndex' => false];
                } else {
                    $data = ['title' => $name, 'content' => '', 'seo' => ['title' => '', 'description' => '', 'image' => null, 'noIndex' => false]];
                }
                doc_save($type . ':' . $slug, $type, $data, $data['order'] ?? 99);
                flash('Creado. Ya puedes editarlo.');
                redirect(['a' => 'edit', 'k' => $type . ':' . $slug]);
            }
        }
        $items = docs_of($type);
        $view = 'list';
        break;

    case 'delete':
        if ($isPost) {
            check_csrf();
            $key = (string) ($_POST['k'] ?? '');
            $type = doc_type_of($key);
            if (in_array($type, ['programa', 'pagina'], true)) {
                doc_delete($key);
                flash('Eliminado.');
            }
            redirect(['a' => 'list', 't' => $type ?: 'programa']);
        }
        redirect();
        break;

    case 'media':
        if ($isPost) {
            check_csrf();
            $do = $_POST['do'] ?? '';
            if ($do === 'upload' && !empty($_FILES['files'])) {
                $ok = 0;
                foreach ($_FILES['files']['name'] as $i => $n) {
                    if ($_FILES['files']['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
                    if ($_FILES['files']['error'][$i] !== UPLOAD_ERR_OK) {
                        flash('“' . $n . '”: ' . upload_error_text($_FILES['files']['error'][$i]), 'error');
                        continue;
                    }
                    try {
                        media_store($_FILES['files']['tmp_name'][$i], $n, pathinfo($n, PATHINFO_FILENAME));
                        $ok++;
                    } catch (Throwable $t) {
                        flash('“' . $n . '”: ' . $t->getMessage(), 'error');
                    }
                }
                if ($ok) flash($ok === 1 ? 'Archivo subido.' : "$ok archivos subidos.");
            } elseif ($do === 'alt') {
                db()->prepare('UPDATE media SET alt = ? WHERE id = ?')->execute([trim((string) ($_POST['alt'] ?? '')), (int) ($_POST['id'] ?? 0)]);
                flash('Texto alternativo guardado.');
            } elseif ($do === 'delete') {
                media_delete((int) ($_POST['id'] ?? 0));
                flash('Archivo eliminado.');
            }
            redirect(['a' => 'media']);
        }
        $media = db()->query('SELECT * FROM media ORDER BY id DESC')->fetchAll();
        $view = 'media';
        break;

    case 'media_json':
        header('Content-Type: application/json; charset=utf-8');
        $kind = $_GET['kind'] ?? 'image';
        $rows = db()->query('SELECT * FROM media ORDER BY id DESC')->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $r['variants'] = json_decode($r['variants'], true) ?: [];
            $img = strpos($r['mime'], 'image/') === 0;
            if ($kind === 'image' && !$img) continue;
            $out[] = [
                'id' => (int) $r['id'],
                'alt' => $r['alt'],
                'name' => basename($r['file']),
                'mime' => $r['mime'],
                'thumb' => $img ? media_url($r, isset($r['variants']['480']) ? '480' : null) : null,
            ];
        }
        echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;

    case 'users':
        if ($isPost) {
            check_csrf();
            $do = $_POST['do'] ?? '';
            if ($do === 'add') {
                $email = trim((string) ($_POST['email'] ?? ''));
                $pass = (string) ($_POST['password'] ?? '');
                if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 8) {
                    flash('Correo inválido o contraseña menor a 8 caracteres.', 'error');
                } else {
                    try {
                        db()->prepare('INSERT INTO users (email, name, password, created_at) VALUES (?,?,?,?)')
                            ->execute([$email, trim((string) ($_POST['name'] ?? '')), password_hash($pass, PASSWORD_DEFAULT), date('c')]);
                        flash('Usuario agregado.');
                    } catch (PDOException $ex) {
                        flash('Ese correo ya tiene usuario.', 'error');
                    }
                }
            } elseif ($do === 'password') {
                $pass = (string) ($_POST['password'] ?? '');
                if (strlen($pass) < 8 || $pass !== ($_POST['password2'] ?? '')) {
                    flash('La contraseña debe tener al menos 8 caracteres y coincidir.', 'error');
                } else {
                    db()->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $user['id']]);
                    flash('Contraseña actualizada.');
                }
            } elseif ($do === 'delete') {
                $id = (int) ($_POST['id'] ?? 0);
                if ($id === (int) $user['id']) {
                    flash('No puedes eliminar tu propio usuario.', 'error');
                } else {
                    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
                    flash('Usuario eliminado.');
                }
            }
            redirect(['a' => 'users']);
        }
        $users = db()->query('SELECT id, email, name, created_at FROM users ORDER BY id')->fetchAll();
        $view = 'users';
        break;

    default:
        $view = 'dashboard';
}

include __DIR__ . '/views.php';
