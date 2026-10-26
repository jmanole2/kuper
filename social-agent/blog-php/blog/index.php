<?php
// Página principal del blog: lista de artículos, filtro por categoría y páginas.
require __DIR__ . '/lib.php';
$pagina = max(1, (int) ($_GET['pagina'] ?? 1));
$categoria = preg_replace('/[^a-z0-9-]/', '', strtolower($_GET['categoria'] ?? ''));
$q = 'articulos.json?pagina=' . $pagina . '&por_pagina=' . (int) $POR_PAGINA . ($categoria ? '&categoria=' . rawurlencode($categoria) : '');
$datos = blog_api($q);
$cat = null;
if ($datos) foreach ($datos['categorias'] as $c) if ($c['slug'] === $categoria) $cat = $c;
if ($categoria && $datos && !$cat) { http_response_code(404); }

$BLOG_META['titulo'] = ($cat ? $cat['nombre'] . ' · ' : '') . $TITULO_BLOG . ' · ' . $NOMBRE_SITIO . ($pagina > 1 ? ' (página ' . $pagina . ')' : '');
$BLOG_META['descripcion'] = $cat ? 'Artículos de ' . $cat['nombre'] . ' en el blog de ' . $NOMBRE_SITIO . '.' : $DESCRIPCION_BLOG;
$BLOG_META['canonical'] = blog_base() . blog_url_inicio($pagina, $categoria);
$BLOG_META['jsonld'][] = ['@context' => 'https://schema.org', '@type' => 'Blog', 'name' => $TITULO_BLOG . ' · ' . $NOMBRE_SITIO, 'url' => blog_base() . blog_url_inicio(), 'description' => $DESCRIPCION_BLOG];
if ($categoria && !$cat) $BLOG_META['robots'] = 'noindex';

blog_abrir();
?>
<main class="kblog-inicio">
  <header class="kblog-cabeza">
    <h1><?= e($cat ? $cat['nombre'] : $TITULO_BLOG) ?></h1>
    <?php if (!$cat): ?><p><?= e($DESCRIPCION_BLOG) ?></p><?php endif; ?>
  </header>
  <?php if ($datos === false): blog_no_disponible(); elseif (!$datos): ?>
    <div class="kblog-vacio">El blog todavía no está configurado (revisa $SITIO en blog/config.php).</div>
  <?php else: ?>
    <nav class="kblog-categorias" aria-label="Categorías">
      <a href="<?= e(blog_url_inicio()) ?>" class="<?= $categoria ? '' : 'on' ?>">Todo</a>
      <?php foreach ($datos['categorias'] as $c): if (!$c['total']) continue; ?>
        <a href="<?= e(blog_url_inicio(1, $c['slug'])) ?>" class="<?= $c['slug'] === $categoria ? 'on' : '' ?>"><?= e($c['nombre']) ?></a>
      <?php endforeach; ?>
    </nav>
    <?php if (!$datos['articulos']): ?>
      <div class="kblog-vacio">Todavía no hay artículos<?= $cat ? ' en esta categoría' : '' ?>.</div>
    <?php else: ?>
      <div class="kblog-rejilla"><?php foreach ($datos['articulos'] as $a) blog_tarjeta($a); ?></div>
      <?php if ($datos['paginas'] > 1): ?>
        <nav class="kblog-paginas" aria-label="Páginas">
          <?php if ($pagina > 1): ?><a href="<?= e(blog_url_inicio($pagina - 1, $categoria)) ?>" rel="prev">← Anteriores</a><?php endif; ?>
          <span>Página <?= $pagina ?> de <?= (int) $datos['paginas'] ?></span>
          <?php if ($pagina < $datos['paginas']): ?><a href="<?= e(blog_url_inicio($pagina + 1, $categoria)) ?>" rel="next">Siguientes →</a><?php endif; ?>
        </nav>
      <?php endif; ?>
    <?php endif; ?>
  <?php endif; ?>
</main>
<?php blog_cerrar();
