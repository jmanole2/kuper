<?php
// Funciones del blog: pide los artículos al panel (con caché en disco) y arma las páginas.
require __DIR__ . '/config.php';

function e($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }

/** Pide un JSON al panel. Guarda copia en cache/ y, si el panel no responde, usa la última copia. */
function blog_api($ruta) {
  global $PANEL_URL, $SITIO, $CACHE_MIN;
  $url = rtrim($PANEL_URL, '/') . '/blog/' . rawurlencode($SITIO) . '/' . $ruta;
  $dir = __DIR__ . '/cache';
  if (!is_dir($dir)) @mkdir($dir, 0755, true);
  $archivo = $dir . '/' . md5($url) . '.json';
  if (is_file($archivo) && filemtime($archivo) > time() - $CACHE_MIN * 60) return json_decode(file_get_contents($archivo), true);
  $cuerpo = false; $codigo = 0;
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'KuperBlogPHP/1.0']);
    $cuerpo = curl_exec($ch); $codigo = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  } else {
    $ctx = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true, 'header' => "User-Agent: KuperBlogPHP/1.0\r\n"]]);
    $cuerpo = @file_get_contents($url, false, $ctx);
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $codigo = (int) $m[1];
  }
  if ($codigo === 404) { @unlink($archivo); return null; }
  if ($cuerpo !== false && $codigo === 200) { @file_put_contents($archivo, $cuerpo); return json_decode($cuerpo, true); }
  return is_file($archivo) ? json_decode(file_get_contents($archivo), true) : false; // false = panel sin respuesta
}

function blog_base() {
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}
function blog_url_inicio($pagina = 1, $categoria = '') {
  global $BLOG_RUTA, $URLS_BONITAS;
  $r = rtrim($BLOG_RUTA, '/') . '/';
  if ($categoria) $r .= $URLS_BONITAS ? 'categoria/' . rawurlencode($categoria) . '/' : 'index.php?categoria=' . rawurlencode($categoria);
  if ($pagina > 1) $r .= (strpos($r, '?') !== false ? '&' : '?') . 'pagina=' . (int) $pagina;
  return $r;
}
function blog_url_articulo($slug) {
  global $BLOG_RUTA, $URLS_BONITAS;
  return rtrim($BLOG_RUTA, '/') . '/' . ($URLS_BONITAS ? rawurlencode($slug) : 'articulo.php?slug=' . rawurlencode($slug));
}
function blog_fecha($iso) {
  if (!$iso) return '';
  $meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  $t = strtotime($iso);
  return date('j', $t) . ' de ' . $meses[(int) date('n', $t) - 1] . ' de ' . date('Y', $t);
}

// ---- etiquetas del <head> (título, descripción, canonical, Open Graph y datos estructurados)
$BLOG_META = ['titulo' => '', 'descripcion' => '', 'canonical' => '', 'imagen' => '', 'tipo' => 'website', 'jsonld' => [], 'robots' => 'index, follow'];
function blog_meta() {
  global $BLOG_META, $NOMBRE_SITIO;
  $m = $BLOG_META;
  echo '<title>' . e($m['titulo']) . "</title>\n";
  echo '<meta name="description" content="' . e($m['descripcion']) . "\">\n";
  echo '<meta name="robots" content="' . e($m['robots']) . "\">\n";
  if ($m['canonical']) echo '<link rel="canonical" href="' . e($m['canonical']) . "\">\n";
  echo '<meta property="og:type" content="' . e($m['tipo']) . "\">\n<meta property=\"og:site_name\" content=\"" . e($NOMBRE_SITIO) . "\">\n";
  echo '<meta property="og:title" content="' . e($m['titulo']) . "\">\n<meta property=\"og:description\" content=\"" . e($m['descripcion']) . "\">\n";
  if ($m['canonical']) echo '<meta property="og:url" content="' . e($m['canonical']) . "\">\n";
  if ($m['imagen']) echo '<meta property="og:image" content="' . e($m['imagen']) . "\">\n<meta name=\"twitter:card\" content=\"summary_large_image\">\n";
  foreach ($m['jsonld'] as $ld) echo '<script type="application/ld+json">' . json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "</script>\n";
  global $BLOG_RUTA;
  echo '<link rel="stylesheet" href="' . e(rtrim($BLOG_RUTA, '/')) . '/estilos.css?v=1">' . "\n";
}

function blog_abrir() {
  global $ENCABEZADO, $NOMBRE_SITIO, $TITULO_BLOG;
  if ($ENCABEZADO && is_file($ENCABEZADO)) { include $ENCABEZADO; echo '<div class="kblog">'; return; }
  echo "<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n";
  blog_meta();
  echo "</head>\n<body class=\"kblog-solo\">\n<header class=\"kblog-barra\"><a href=\"/\">" . e($NOMBRE_SITIO) . '</a><a href="' . e(blog_url_inicio()) . '">' . e($TITULO_BLOG) . "</a></header>\n<div class=\"kblog\">";
}
function blog_cerrar() {
  global $PIE, $NOMBRE_SITIO;
  echo '</div>';
  if ($PIE && is_file($PIE)) { include $PIE; return; }
  echo '<footer class="kblog-pie">© ' . date('Y') . ' ' . e($NOMBRE_SITIO) . "</footer>\n</body>\n</html>";
}
function blog_tarjeta($a) {
  echo '<article class="kblog-tarjeta"><a href="' . e(blog_url_articulo($a['slug'])) . '">';
  if (!empty($a['imagen'])) echo '<img src="' . e($a['imagen']) . '" alt="' . e($a['imagen_alt']) . '" loading="lazy" width="600" height="314">';
  echo '<span class="kblog-cat">' . e($a['categoria']) . '</span><h2>' . e($a['titulo']) . '</h2><p>' . e($a['extracto']) . '</p>';
  echo '<span class="kblog-fecha">' . e(blog_fecha($a['publicado'])) . '</span></a></article>';
}
function blog_no_disponible() {
  http_response_code(503);
  echo '<div class="kblog-vacio">El blog no está disponible en este momento. Intenta de nuevo en unos minutos.</div>';
}
