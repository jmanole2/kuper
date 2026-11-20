<?php
/**
 * Amasando Tu Negocio — controlador principal (todas las URLs pasan por aquí vía .htaccess).
 */
require __DIR__ . '/includes/bootstrap.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rawurldecode($path);
$bp = base_path();
if ($bp !== '' && strpos($path, $bp) === 0) {
    $path = substr($path, strlen($bp));
}
$path = '/' . trim($path, '/');

// Redirige /index.php y barras finales a la URL limpia (evita contenido duplicado en Google).
if ($path === '/index.php') {
    header('Location: ' . url('/'), true, 301);
    exit;
}
$req = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if ($path !== '/' && substr($req, -1) === '/') {
    header('Location: ' . url($path), true, 301);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

switch ($path) {
    case '/':
        $home = doc('home');
        $GLOBALS['page'] = ['path' => '/', 'seo' => $home['seo'] ?? []];
        render('home', ['d' => $home]);
        break;

    case '/comunidad':
        $c = doc('comunidad');
        $GLOBALS['page'] = ['path' => '/comunidad', 'title' => 'Comunidad', 'seo' => $c['seo'] ?? []];
        render('comunidad', ['d' => $c]);
        break;

    case '/sitemap.xml':
        require ROOT . '/includes/sitemap.php';
        break;

    case '/robots.txt':
        header('Content-Type: text/plain; charset=utf-8');
        echo "User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: " . site_url() . "/sitemap.xml\n";
        break;

    default:
        $slug = substr($path, 1);
        if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
            not_found();
        }
        if (doc_exists('programa:' . $slug)) {
            $p = doc('programa:' . $slug);
            $GLOBALS['page'] = ['path' => $path, 'title' => $p['name'] ?? '', 'seo' => $p['seo'] ?? [], 'overlay' => true];
            render('programa', ['p' => $p, 'slug' => $slug]);
        } elseif (doc_exists('pagina:' . $slug)) {
            $pg = doc('pagina:' . $slug);
            $GLOBALS['page'] = ['path' => $path, 'title' => $pg['title'] ?? '', 'seo' => $pg['seo'] ?? []];
            render('pagina', ['pg' => $pg]);
        } else {
            not_found();
        }
}
