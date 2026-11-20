<?php
/** Funciones de ayuda generales. */

/** Escapa texto para HTML. */
function e($v): string
{
    return htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Lee un valor anidado con notación de puntos: get($data, 'hero.title'). */
function get($arr, string $path, $default = null)
{
    foreach (explode('.', $path) as $k) {
        if (is_array($arr) && array_key_exists($k, $arr)) {
            $arr = $arr[$k];
        } else {
            return $default;
        }
    }
    return $arr ?? $default;
}

/** Asigna un valor anidado con notación de puntos. */
function set_path(array &$arr, string $path, $value): void
{
    $ref = &$arr;
    foreach (explode('.', $path) as $k) {
        if (!isset($ref[$k]) || !is_array($ref[$k])) {
            $ref[$k] = $ref[$k] ?? [];
            if (!is_array($ref[$k])) {
                $ref[$k] = [];
            }
        }
        $ref = &$ref[$k];
    }
    $ref = $value;
}

/** Ruta base donde está instalado el sitio ('' si está en la raíz del dominio). */
function base_path(): string
{
    static $base = null;
    if ($base === null) {
        $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
        $dir = rtrim(dirname($script), '/');
        if (substr($dir, -6) === '/admin') {
            $dir = substr($dir, 0, -6);
        }
        $base = $dir === '/' ? '' : $dir;
    }
    return $base;
}

/** URL relativa al sitio: url('/ideas') → /ideas (o /subcarpeta/ideas). */
function url(string $path = '/'): string
{
    if (preg_match('#^([a-z]+:|//|\#)#i', $path)) {
        return $path;
    }
    return base_path() . '/' . ltrim($path, '/');
}

/** URL pública absoluta del sitio (para SEO). */
function site_url(): string
{
    $fromSettings = trim((string) get(doc('settings'), 'siteUrl', ''));
    if ($fromSettings !== '') {
        return rtrim($fromSettings, '/');
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return ($https ? 'https' : 'http') . '://' . $host . base_path();
}

function absolute_url(?string $path): ?string
{
    if (!$path) {
        return null;
    }
    if (preg_match('#^https?://#', $path)) {
        return $path;
    }
    $base = site_url();
    // site_url ya incluye la subcarpeta; quitamos la base de la ruta para no duplicarla.
    $bp = base_path();
    if ($bp !== '' && strpos($path, $bp . '/') === 0) {
        $path = substr($path, strlen($bp));
    }
    return $base . '/' . ltrim($path, '/');
}

function is_external(?string $url): bool
{
    return (bool) preg_match('#^(https?:)?//#i', (string) $url);
}

/** Atributos para un enlace (externos abren en otra pestaña). */
function link_attrs(?string $href): string
{
    $href = (string) $href;
    $out = 'href="' . e(url($href)) . '"';
    if (is_external($href)) {
        $out .= ' target="_blank" rel="noopener noreferrer"';
    }
    return $out;
}

/** Botón negro / gris del diseño. */
function button(?array $link, string $variant = 'primary', string $size = 'md'): string
{
    $label = trim((string) ($link['label'] ?? ''));
    $href = trim((string) ($link['url'] ?? ''));
    if ($label === '' || $href === '') {
        return '';
    }
    $cls = 'btn btn--' . $variant . ($size === 'lg' ? ' btn--lg' : '');
    return '<a class="' . $cls . '" ' . link_attrs($href) . '>' . e($label) . '</a>';
}

/** Párrafos a partir de texto con saltos de línea dobles. */
function paragraphs(?string $text, string $class = ''): string
{
    $text = trim((string) $text);
    if ($text === '') {
        return '';
    }
    $out = '';
    foreach (preg_split("/\R{2,}/u", $text) as $p) {
        $html = str_replace(["\r\n", "\n", "\r"], '<br>', e(trim($p)));
        $out .= '<p' . ($class ? ' class="' . e($class) . '"' : '') . '>' . $html . '</p>';
    }
    return $out;
}

function slugify(string $v): string
{
    $v = mb_strtolower(trim($v));
    $v = strtr($v, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
    $v = (string) preg_replace('/[^a-z0-9]+/', '-', $v);
    return trim($v, '-');
}

/** Limpia HTML del editor de texto: solo etiquetas seguras. */
function clean_html(string $html): string
{
    $html = strip_tags($html, '<p><br><strong><b><em><i><u><h2><h3><ul><ol><li><a><blockquote>');
    // Quita atributos peligrosos; en <a> solo se conserva href seguro.
    $html = (string) preg_replace_callback('/<(\w+)([^>]*)>/u', function ($m) {
        $tag = strtolower($m[1]);
        if ($tag === 'a' && preg_match('/href\s*=\s*"([^"]*)"/i', $m[2], $h)) {
            $href = html_entity_decode($h[1]);
            if (!preg_match('#^(https?:|mailto:|tel:|/|\#)#i', $href)) {
                $href = '#';
            }
            $ext = is_external($href) ? ' target="_blank" rel="noopener noreferrer"' : '';
            return '<a href="' . e($href) . '"' . $ext . '>';
        }
        return '<' . $tag . '>';
    }, $html);
    return trim($html);
}

/** Envía una respuesta 404. */
function not_found(): void
{
    http_response_code(404);
    $GLOBALS['page'] = ['title' => 'Página no encontrada', 'path' => '/404', 'seo' => ['noIndex' => true]];
    render('404');
    exit;
}

/** Renderiza una plantilla dentro del layout. */
function render(string $template, array $vars = []): void
{
    extract($vars, EXTR_SKIP);
    ob_start();
    include ROOT . '/templates/' . $template . '.php';
    $content = ob_get_clean();
    include ROOT . '/templates/layout.php';
}

function partial(string $name, array $vars = []): void
{
    extract($vars, EXTR_SKIP);
    include ROOT . '/templates/partials/' . $name . '.php';
}
