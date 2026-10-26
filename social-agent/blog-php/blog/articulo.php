<?php
// Página de un artículo, con todo lo que Google necesita (metas, canonical, datos estructurados).
require __DIR__ . '/lib.php';
$slug = preg_replace('/[^a-z0-9-]/', '', strtolower($_GET['slug'] ?? ''));
$datos = $slug ? blog_api('articulo/' . rawurlencode($slug) . '.json') : null;
$a = $datos['articulo'] ?? null;

if ($a) {
  $url = blog_base() . blog_url_articulo($a['slug']);
  $BLOG_META['titulo'] = $a['meta_title'] . ' · ' . $NOMBRE_SITIO;
  $BLOG_META['descripcion'] = $a['meta_description'];
  $BLOG_META['canonical'] = $url;
  $BLOG_META['imagen'] = $a['imagen'] ?? '';
  $BLOG_META['tipo'] = 'article';
  $BLOG_META['jsonld'][] = array_filter([
    '@context' => 'https://schema.org', '@type' => 'BlogPosting', 'headline' => $a['titulo'], 'description' => $a['meta_description'],
    'image' => $a['imagen'] ?? null, 'datePublished' => $a['publicado'], 'dateModified' => $a['actualizado'] ?: $a['publicado'],
    'author' => ['@type' => 'Organization', 'name' => $a['autor']], 'publisher' => ['@type' => 'Organization', 'name' => $NOMBRE_SITIO],
    'mainEntityOfPage' => $url, 'articleSection' => $a['categoria'], 'keywords' => implode(', ', $a['etiquetas'] ?? []), 'wordCount' => $a['palabras'],
  ]);
  $BLOG_META['jsonld'][] = ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => [
    ['@type' => 'ListItem', 'position' => 1, 'name' => $NOMBRE_SITIO, 'item' => blog_base() . '/'],
    ['@type' => 'ListItem', 'position' => 2, 'name' => $TITULO_BLOG, 'item' => blog_base() . blog_url_inicio()],
    ['@type' => 'ListItem', 'position' => 3, 'name' => $a['titulo'], 'item' => $url],
  ]];
} else {
  http_response_code($datos === false ? 503 : 404);
  $BLOG_META['titulo'] = 'Artículo no encontrado · ' . $NOMBRE_SITIO;
  $BLOG_META['robots'] = 'noindex';
}
blog_abrir();
if (!$a): ?>
  <main class="kblog-articulo"><?php if ($datos === false): blog_no_disponible(); else: ?>
    <div class="kblog-vacio">Este artículo no existe o ya no está publicado. <a href="<?= e(blog_url_inicio()) ?>">Ver todos los artículos</a></div>
  <?php endif; ?></main>
<?php else: $minutos = max(1, (int) round(($a['palabras'] ?? 0) / 200)); ?>
<main class="kblog-articulo">
  <nav class="kblog-migas" aria-label="Ruta"><a href="<?= e(blog_url_inicio()) ?>"><?= e($TITULO_BLOG) ?></a> / <a href="<?= e(blog_url_inicio(1, $a['categoria_slug'])) ?>"><?= e($a['categoria']) ?></a></nav>
  <article>
    <header>
      <h1><?= e($a['titulo']) ?></h1>
      <p class="kblog-datos"><time datetime="<?= e($a['publicado']) ?>"><?= e(blog_fecha($a['publicado'])) ?></time> · <?= $minutos ?> min de lectura<?= $a['autor'] ? ' · ' . e($a['autor']) : '' ?></p>
    </header>
    <?php if (!empty($a['imagen'])): ?>
      <figure class="kblog-portada">
        <img src="<?= e($a['imagen']) ?>" alt="<?= e($a['imagen_alt']) ?>" width="1200" height="628">
        <?php if (!empty($a['imagen_credito']['autor'])): ?>
          <figcaption>Foto de <a href="<?= e($a['imagen_credito']['autor_url']) ?>" target="_blank" rel="noopener nofollow"><?= e($a['imagen_credito']['autor']) ?></a> en <a href="<?= e($a['imagen_credito']['url']) ?>" target="_blank" rel="noopener nofollow">Pexels</a></figcaption>
        <?php endif; ?>
      </figure>
    <?php endif; ?>
    <div class="kblog-cuerpo"><?= $a['contenido_html'] /* ya viene limpio desde el panel */ ?></div>
    <?php if (!empty($a['etiquetas'])): ?><p class="kblog-etiquetas"><?php foreach ($a['etiquetas'] as $t): ?><span><?= e($t) ?></span><?php endforeach; ?></p><?php endif; ?>
    <?php if (!empty($a['fuentes'])): ?>
      <aside class="kblog-fuentes"><strong>Fuentes</strong><ul><?php foreach ($a['fuentes'] as $f): ?><li><a href="<?= e($f['url']) ?>" target="_blank" rel="noopener nofollow"><?= e($f['titulo']) ?></a></li><?php endforeach; ?></ul></aside>
    <?php endif; ?>
  </article>
  <?php if (!empty($datos['relacionados'])): ?>
    <section class="kblog-relacionados"><h2>Sigue leyendo</h2><div class="kblog-rejilla"><?php foreach ($datos['relacionados'] as $r) blog_tarjeta($r); ?></div></section>
  <?php endif; ?>
</main>
<?php endif;
blog_cerrar();
