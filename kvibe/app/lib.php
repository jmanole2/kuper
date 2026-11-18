<?php
declare(strict_types=1);

/** Error con mensaje seguro para mostrar al usuario. */
final class UserError extends RuntimeException {}

/* ============================================================
 * Configuración
 * ============================================================ */

/** Mezcla recursiva: los arreglos asociativos se combinan, las listas se reemplazan. */
function config_merge(array $base, array $over): array
{
    foreach ($over as $k => $v) {
        if (is_array($v) && isset($base[$k]) && is_array($base[$k]) && !array_is_list($v)) {
            $base[$k] = config_merge($base[$k], $v);
        } else {
            $base[$k] = $v;
        }
    }
    return $base;
}

/** cfg('texts.hero_title') */
function cfg(string $path, mixed $default = null): mixed
{
    $node = $GLOBALS['__config'];
    foreach (explode('.', $path) as $key) {
        if (!is_array($node) || !array_key_exists($key, $node)) {
            return $default;
        }
        $node = $node[$key];
    }
    return $node;
}

/** Escapa y evita que "K-VIBE+" se parta en dos líneas. */
function brand(string $s): string
{
    return preg_replace('/K-VIBE\+?/', '<span class="nw">$0</span>', e($s));
}

function t(string $key): string
{
    return (string) cfg('texts.' . $key, '');
}

/* ============================================================
 * Salida / vistas / rutas
 * ============================================================ */

function e(mixed $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Ruta base donde vive public/ (p. ej. '' o '/concurso'). */
function base_path(): string
{
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    $dir = rtrim(dirname($script), '/');
    if (str_ends_with($dir, '/admin')) {
        $dir = substr($dir, 0, -6);
    }
    // Si un .htaccess en la raíz reescribe todo hacia /kvibe/public, la URL pública no incluye
    // esa carpeta: en ese caso los enlaces van desde la raíz del dominio.
    $uri = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
    if ($dir !== '' && !str_starts_with($uri, $dir . '/') && $uri !== $dir) {
        return '';
    }
    return $dir;
}

function url(string $path = ''): string
{
    return base_path() . '/' . ltrim($path, '/');
}

function asset(string $path): string
{
    $file = APP_ROOT . '/public/' . ltrim($path, '/');
    $v = is_file($file) ? filemtime($file) : 0;
    return url($path) . ($v ? '?v=' . $v : '');
}

function redirect(string $path): never
{
    header('Location: ' . url($path), true, 303);
    exit;
}

function view(string $name, array $vars = [], string $layout = 'layout'): void
{
    extract($vars, EXTR_SKIP);
    ob_start();
    require APP_DIR . '/views/' . $name . '.php';
    $content = ob_get_clean();
    require APP_DIR . '/views/' . $layout . '.php';
}

/* ============================================================
 * Seguridad HTTP / sesión / CSRF
 * ============================================================ */

function is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
    if (($_SERVER['SERVER_PORT'] ?? '') == 443) return true;
    if (strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') return true;
    return false;
}

function force_https(): void
{
    if (cfg('force_https') && !is_https()) {
        $host = $_SERVER['HTTP_HOST'] ?? parse_url((string) cfg('base_url'), PHP_URL_HOST);
        header('Location: https://' . $host . ($_SERVER['REQUEST_URI'] ?? '/'), true, 301);
        exit;
    }
}

function send_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
    if (is_https()) {
        header('Strict-Transport-Security: max-age=31536000');
    }
}

function start_session(): void
{
    session_name('kvibe_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    ini_set('session.use_strict_mode', '1');
    session_start();
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function csrf_check(): void
{
    $sent = (string) ($_POST['_csrf'] ?? '');
    if ($sent === '' || !hash_equals(csrf_token(), $sent)) {
        throw new UserError('Tu sesión expiró. Recarga la página e inténtalo de nuevo.');
    }
}

/** Detecta envíos que rebasaron post_max_size (PHP vacía $_POST y $_FILES). */
function post_too_large(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'
        && empty($_POST) && empty($_FILES)
        && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0;
}

function client_ip(): string
{
    if (cfg('trust_cloudflare_ip') && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $ip = $_SERVER['HTTP_CF_CONNECTING_IP'];
    } else {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

function user_agent(): string
{
    return mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
}

/** Identificador de dispositivo (cookie de 1 año) para el límite por dispositivo. */
function device_id(): string
{
    $id = $_COOKIE['kv_did'] ?? '';
    if (!preg_match('/^[a-f0-9]{32}$/', $id)) {
        $id = bin2hex(random_bytes(16));
        setcookie('kv_did', $id, [
            'expires' => time() + 31536000, 'path' => '/',
            'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax',
        ]);
        $_COOKIE['kv_did'] = $id;
    }
    return $id;
}

/* ============================================================
 * Base de datos
 * ============================================================ */

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = cfg('db');
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], $c['port'], $c['name']);
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        $pdo->exec("SET time_zone = '" . (new DateTime())->format('P') . "'");
    }
    return $pdo;
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

/**
 * Límite de eventos por llave en una ventana de tiempo.
 * Devuelve false si ya se alcanzó el máximo (no cuenta el intento).
 */
function rate_hit(string $key, int $max, int $window): bool
{
    $pdo = db();
    $k = hash('sha256', $key);
    $t = time();
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT hits, window_start FROM rate_limits WHERE k = ? FOR UPDATE');
        $st->execute([$k]);
        $row = $st->fetch();
        if (!$row || (int) $row['window_start'] + $window <= $t) {
            $pdo->prepare('REPLACE INTO rate_limits (k, hits, window_start) VALUES (?, 1, ?)')->execute([$k, $t]);
            $ok = true;
        } elseif ((int) $row['hits'] >= $max) {
            $ok = false;
        } else {
            $pdo->prepare('UPDATE rate_limits SET hits = hits + 1 WHERE k = ?')->execute([$k]);
            $ok = true;
        }
        $pdo->commit();
        return $ok;
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
}

function rate_check(string $rule, string $id): void
{
    [$max, $win] = cfg('rate.' . $rule);
    if (!rate_hit($rule . '|' . $id, (int) $max, (int) $win)) {
        throw new UserError('Demasiados intentos. Espera un momento y vuelve a intentarlo.');
    }
}

/* ============================================================
 * Estado del concurso
 * ============================================================ */

/** 'open' | 'soon' | 'closed' */
function contest_state(): string
{
    $mode = cfg('contest_mode', 'auto');
    if ($mode === 'open' || $mode === 'closed') return $mode;
    $t = time();
    if (cfg('opens_at') && $t < strtotime((string) cfg('opens_at'))) return 'soon';
    if (cfg('closes_at') && $t >= strtotime((string) cfg('closes_at'))) return 'closed';
    return 'open';
}

/** Guarda el origen del QR en sesión la primera vez. */
function capture_source(): string
{
    $src = strtolower(trim((string) ($_GET['src'] ?? '')));
    if ($src !== '' && in_array($src, cfg('sources', []), true)) {
        $_SESSION['src'] = $src;
    }
    return $_SESSION['src'] ?? (string) cfg('default_source');
}

/* ============================================================
 * Validación / normalización
 * ============================================================ */

function clean_text(?string $s): string
{
    $s = (string) $s;
    if (!mb_check_encoding($s, 'UTF-8')) return '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s);
    $s = preg_replace('/[ \t]+/u', ' ', $s);
    $s = preg_replace("/\R{3,}/u", "\n\n", $s);
    return trim($s);
}

function normalize_email(?string $s): ?string
{
    $s = mb_strtolower(trim((string) $s));
    if ($s === '' || mb_strlen($s) > 190 || !filter_var($s, FILTER_VALIDATE_EMAIL)) return null;
    return $s;
}

/** Deja solo dígitos; acepta +52 / 52 / 521 al inicio. Devuelve 10 dígitos o null. */
function normalize_phone(?string $s): ?string
{
    $d = preg_replace('/\D+/', '', (string) $s);
    if (strlen($d) === 13 && str_starts_with($d, '521')) $d = substr($d, 3);
    if (strlen($d) === 12 && str_starts_with($d, '52')) $d = substr($d, 2);
    return preg_match('/^[1-9]\d{9}$/', $d) ? $d : null;
}

function mask_email(string $email): string
{
    [$u, $d] = explode('@', $email, 2);
    $keep = mb_substr($u, 0, min(2, mb_strlen($u)));
    return $keep . str_repeat('•', max(1, mb_strlen($u) - mb_strlen($keep))) . '@' . $d;
}

/** Folio no secuencial: KV + 8 caracteres sin ambiguos (0/O, 1/I/L). */
function random_public_id(): string
{
    $alpha = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    $s = 'KV';
    for ($i = 0; $i < 8; $i++) $s .= $alpha[random_int(0, strlen($alpha) - 1)];
    return $s;
}

function random_code(): string
{
    return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

/* ============================================================
 * Captcha (Cloudflare Turnstile o reCAPTCHA v3)
 * ============================================================ */

function captcha_verify(?string $token): bool
{
    $provider = cfg('captcha.provider');
    if ($provider === 'none') return true;
    if (!$token) return false;

    $url = $provider === 'recaptcha'
        ? 'https://www.google.com/recaptcha/api/siteverify'
        : 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    $res = http_post_form($url, [
        'secret' => cfg('captcha.secret'), 'response' => $token, 'remoteip' => client_ip(),
    ]);
    if ($res === null) {
        error_log('captcha: sin respuesta del proveedor');
        return (bool) cfg('captcha.fail_open');
    }
    $j = json_decode($res, true);
    if (empty($j['success'])) return false;
    if ($provider === 'recaptcha') {
        return ($j['score'] ?? 0) >= cfg('captcha.min_score') && ($j['action'] ?? '') === 'submit';
    }
    return true;
}

function http_post_form(string $url, array $fields): ?string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $out = curl_exec($ch);
    $ok = $out !== false && curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
    curl_close($ch);
    return $ok ? (string) $out : null;
}

/* ============================================================
 * Fotos (se guardan fuera del webroot, re-codificadas a JPEG)
 * ============================================================ */

/** Valida y guarda la foto en storage/uploads/pending. Devuelve el nombre de archivo. */
function store_upload(?array $f): string
{
    if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        throw new UserError('Sube tu foto para participar.');
    }
    if (in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
        || $f['size'] > cfg('upload.max_bytes')) {
        throw new UserError('Tu foto es demasiado pesada. Máximo ' . round(cfg('upload.max_bytes') / 1048576) . ' MB.');
    }
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
        throw new UserError('No pudimos recibir tu foto. Inténtalo de nuevo.');
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (in_array($mime, ['image/heic', 'image/heif'], true)) {
        throw new UserError('Tu foto está en formato HEIC. Elígela de nuevo desde la galería o tómala con la cámara (se convierte sola a JPG).');
    }
    if (!in_array($mime, $allowed, true) || !@getimagesize($f['tmp_name'])) {
        throw new UserError('El archivo debe ser una imagen JPG, PNG o WEBP.');
    }

    ini_set('memory_limit', '512M');
    $img = match ($mime) {
        'image/jpeg' => @imagecreatefromjpeg($f['tmp_name']),
        'image/png'  => @imagecreatefrompng($f['tmp_name']),
        'image/webp' => @imagecreatefromwebp($f['tmp_name']),
    };
    if (!$img) {
        throw new UserError('No pudimos leer tu foto. Prueba con otra imagen.');
    }
    if ($mime === 'image/jpeg') {
        $img = fix_orientation($img, $f['tmp_name']);
    }

    $name = bin2hex(random_bytes(16)) . '.jpg';
    save_jpeg($img, STORAGE . '/uploads/pending/' . $name, (int) cfg('upload.max_side'));
    imagedestroy($img);
    return $name;
}

function fix_orientation(GdImage $img, string $path): GdImage
{
    if (!function_exists('exif_read_data')) return $img;
    $exif = @exif_read_data($path);
    $o = (int) ($exif['Orientation'] ?? 1);
    $r = match ($o) { 3 => imagerotate($img, 180, 0), 6 => imagerotate($img, -90, 0), 8 => imagerotate($img, 90, 0), default => null };
    if ($r) { imagedestroy($img); return $r; }
    return $img;
}

/** Reescala (si excede max_side), aplana transparencia y guarda JPEG sin metadatos. */
function save_jpeg(GdImage $src, string $dest, int $maxSide): void
{
    $w = imagesx($src);
    $h = imagesy($src);
    $scale = min(1, $maxSide / max($w, $h));
    $nw = max(1, (int) round($w * $scale));
    $nh = max(1, (int) round($h * $scale));
    $dst = imagecreatetruecolor($nw, $nh);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    if (!imagejpeg($dst, $dest, (int) cfg('upload.jpeg_quality'))) {
        throw new RuntimeException('No se pudo guardar la imagen');
    }
    imagedestroy($dst);
}

/** Mueve la foto de pending/ a entries/ y genera miniatura. */
function promote_photo(string $name): void
{
    if (!preg_match('/^[a-f0-9]{32}\.jpg$/', $name)) throw new RuntimeException('nombre de foto inválido');
    $from = STORAGE . '/uploads/pending/' . $name;
    $to = STORAGE . '/uploads/entries/' . $name;
    if (!rename($from, $to)) throw new RuntimeException('no se pudo mover la foto');
    $img = @imagecreatefromjpeg($to);
    if ($img) {
        save_jpeg($img, STORAGE . '/uploads/thumbs/' . $name, (int) cfg('upload.thumb_side'));
        imagedestroy($img);
    }
}

function delete_pending_photo(string $name): void
{
    if (preg_match('/^[a-f0-9]{32}\.jpg$/', $name)) {
        @unlink(STORAGE . '/uploads/pending/' . $name);
    }
}

/** Limpia registros sin verificar (se llama de vez en cuando y desde bin/cleanup.php). */
function cleanup_pending(): int
{
    $limit = date('Y-m-d H:i:s', time() - 3600 * (int) cfg('verify.pending_ttl_hours'));
    $st = db()->prepare('SELECT id, photo_file FROM pending_entries WHERE created_at < ?');
    $st->execute([$limit]);
    $n = 0;
    foreach ($st->fetchAll() as $row) {
        delete_pending_photo($row['photo_file']);
        db()->prepare('DELETE FROM pending_entries WHERE id = ?')->execute([$row['id']]);
        $n++;
    }
    return $n;
}

/* ============================================================
 * Correo
 * ============================================================ */

function send_code_email(string $to, string $name, string $code): void
{
    $ttl = (int) cfg('verify.code_ttl_min');
    $subject = $code . ' es tu código de K-VIBE+';
    $text = "Hola {$name}:\n\nTu código para confirmar tu participación en el concurso K-VIBE+ es:\n\n{$code}\n\n"
          . "Vence en {$ttl} minutos. Si no fuiste tú, ignora este correo.\n\nK-VIBE+ · Canal 564 de LG Channels";
    ob_start();
    require APP_DIR . '/views/email_code.php';
    $html = ob_get_clean();
    send_mail($to, $subject, $html, $text);
}

function send_mail(string $to, string $subject, string $html, string $text): void
{
    $driver = cfg('mail.driver');
    $from = (string) cfg('mail.from');
    $fromName = (string) cfg('mail.from_name');
    $domain = substr(strrchr($from, '@') ?: '@localhost', 1);
    $boundary = 'b' . bin2hex(random_bytes(12));

    $headers = [
        'From' => mb_encode_mimeheader($fromName, 'UTF-8', 'Q') . " <{$from}>",
        'Reply-To' => $from,
        'Date' => date(DATE_RFC2822),
        'Message-ID' => '<' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
        'MIME-Version' => '1.0',
        'Content-Type' => "multipart/alternative; boundary=\"{$boundary}\"",
    ];
    $body = "--{$boundary}\r\n"
          . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n"
          . quoted_printable_encode(str_replace("\n", "\r\n", $text)) . "\r\n"
          . "--{$boundary}\r\n"
          . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n"
          . quoted_printable_encode($html) . "\r\n"
          . "--{$boundary}--\r\n";
    $encSubject = mb_encode_mimeheader($subject, 'UTF-8', 'Q');

    if ($driver === 'log') {
        file_put_contents(STORAGE . '/logs/mail.log',
            "==== " . now() . " To: {$to}\nSubject: {$subject}\n\n{$text}\n\n", FILE_APPEND | LOCK_EX);
        return;
    }
    if ($driver === 'mail') {
        $h = '';
        foreach ($headers as $k => $v) $h .= "{$k}: {$v}\r\n";
        if (!mail($to, $encSubject, $body, rtrim($h), '-f' . $from)) {
            throw new RuntimeException('mail() falló');
        }
        return;
    }
    $headers = ['To' => "<{$to}>", 'Subject' => $encSubject] + $headers;
    $raw = '';
    foreach ($headers as $k => $v) $raw .= "{$k}: {$v}\r\n";
    smtp_send((array) cfg('mail.smtp'), $from, $to, $raw . "\r\n" . $body);
}

/** Cliente SMTP mínimo (SSL 465 o STARTTLS 587, AUTH LOGIN). */
function smtp_send(array $c, string $from, string $to, string $message): void
{
    $secure = $c['secure'] ?? 'ssl';
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $c['host'] . ':' . (int) $c['port'];
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $c['host']]]);
    $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) throw new RuntimeException("SMTP: no conecta ({$errstr})");
    stream_set_timeout($fp, 20);

    $cmd = function (?string $line, array $ok, string $label) use ($fp): string {
        if ($line !== null) fwrite($fp, $line . "\r\n");
        $resp = '';
        while (($l = fgets($fp, 1024)) !== false) {
            $resp .= $l;
            if (strlen($l) < 4 || $l[3] === ' ') break;
        }
        if (!in_array((int) substr($resp, 0, 3), $ok, true)) {
            throw new RuntimeException("SMTP {$label}: " . trim($resp));
        }
        return $resp;
    };

    try {
        $ehlo = parse_url((string) cfg('base_url'), PHP_URL_HOST) ?: 'localhost';
        $cmd(null, [220], 'saludo');
        $cmd("EHLO {$ehlo}", [250], 'EHLO');
        if ($secure === 'tls') {
            $cmd('STARTTLS', [220], 'STARTTLS');
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                throw new RuntimeException('SMTP: STARTTLS falló');
            }
            $cmd("EHLO {$ehlo}", [250], 'EHLO');
        }
        if (($c['user'] ?? '') !== '') {
            $cmd('AUTH LOGIN', [334], 'AUTH');
            $cmd(base64_encode($c['user']), [334], 'AUTH usuario');
            $cmd(base64_encode($c['pass']), [235], 'AUTH contraseña');
        }
        $cmd("MAIL FROM:<{$from}>", [250], 'MAIL FROM');
        $cmd("RCPT TO:<{$to}>", [250, 251], 'RCPT TO');
        $cmd('DATA', [354], 'DATA');
        $message = preg_replace('/^\./m', '..', $message);
        $cmd($message . "\r\n.", [250], 'envío');
        try { $cmd('QUIT', [221], 'QUIT'); } catch (Throwable) {}
    } finally {
        fclose($fp);
    }
}

/* ============================================================
 * Panel: autenticación
 * ============================================================ */

function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

function require_role(string ...$roles): array
{
    $u = current_user();
    if (!$u) redirect('admin/?a=login');
    if (!in_array($u['role'], $roles, true)) {
        http_response_code(403);
        exit('Sin permiso.');
    }
    return $u;
}
