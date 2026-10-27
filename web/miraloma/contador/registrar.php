<?php
// Registra una visita. Lo llama contador.js desde cada página.
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('{"ok":false}');
}

$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Ignorar robots, buscadores y vistas previas de enlaces.
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|curl|wget|python|monitor/i', $ua)) {
    exit('{"ok":true,"ignorado":true}');
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];

function campo(array $data, string $key, int $max = 200): ?string
{
    $v = trim((string)($data[$key] ?? ''));
    return $v === '' ? null : mb_substr($v, 0, $max);
}

// Identificar al visitante con una cookie propia (no se comparte con nadie).
$visitante = $_COOKIE[VISITOR_COOKIE] ?? '';
if (!preg_match('/^[a-f0-9]{32}$/', $visitante)) {
    $visitante = bin2hex(random_bytes(16));
}
setcookie(VISITOR_COOKIE, $visitante, [
    'expires' => time() + VISITOR_COOKIE_DAYS * 86400,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']),
    'httponly' => true,
    'samesite' => 'Lax',
]);

$ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ipHash = hash('sha256', IP_SALT . $ip);

$dispositivo = preg_match('/mobile|android|iphone|ipad/i', $ua) ? 'Móvil' : 'Escritorio';

$pagina = campo($input, 'pagina') ?? '/';
$referencia = campo($input, 'referencia', 300);
// Solo guardar el dominio de donde viene (no la URL completa).
if ($referencia) {
    $host = parse_url($referencia, PHP_URL_HOST);
    $propio = parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
    $referencia = ($host && $host !== $propio) ? $host : null;
}

try {
    $stmt = db()->prepare('INSERT INTO visitas
        (visitante, ip_hash, pagina, utm_source, utm_medium, utm_campaign, referencia, dispositivo, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $visitante,
        $ipHash,
        $pagina,
        campo($input, 'utm_source'),
        campo($input, 'utm_medium'),
        campo($input, 'utm_campaign'),
        $referencia,
        $dispositivo,
        gmdate('Y-m-d H:i:s'),
    ]);
    echo '{"ok":true}';
} catch (Throwable $e) {
    error_log('Contador: ' . $e->getMessage());
    http_response_code(500);
    echo '{"ok":false}';
}
