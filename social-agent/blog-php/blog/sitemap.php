<?php
// Sitemap del blog para Google: /blog/sitemap.xml (agrégalo en Search Console).
require __DIR__ . '/lib.php';
$lista = blog_api('sitemap.json');
header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
echo '  <url><loc>' . e(blog_base() . blog_url_inicio()) . "</loc><changefreq>daily</changefreq></url>\n";
foreach (($lista ?: []) as $a) {
  echo '  <url><loc>' . e(blog_base() . blog_url_articulo($a['slug'])) . '</loc>' . ($a['actualizado'] ? '<lastmod>' . e(substr($a['actualizado'], 0, 10)) . '</lastmod>' : '') . "</url>\n";
}
echo '</urlset>';
