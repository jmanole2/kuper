<?php
/** sitemap.xml dinámico con todas las páginas públicas. */
header('Content-Type: application/xml; charset=utf-8');
$base = site_url();
$urls = [];
$add = function (string $path, ?string $updated, string $prio, array $seo = []) use (&$urls, $base) {
    if (!empty($seo['noIndex'])) {
        return;
    }
    $urls[] = ['loc' => $base . $path, 'lastmod' => $updated ? date('c', strtotime($updated)) : null, 'priority' => $prio];
};
$add('/', doc_updated('home'), '1.0', doc('home')['seo'] ?? []);
$add('/comunidad', doc_updated('comunidad'), '0.8', doc('comunidad')['seo'] ?? []);
foreach (docs_of('programa') as $p) {
    $add('/' . $p['_slug'], $p['_updated'], '0.9', $p['seo'] ?? []);
}
foreach (docs_of('pagina') as $p) {
    $add('/' . $p['_slug'], $p['_updated'], '0.3', $p['seo'] ?? []);
}
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $u) {
    echo '  <url><loc>' . e($u['loc']) . '</loc>' . ($u['lastmod'] ? '<lastmod>' . $u['lastmod'] . '</lastmod>' : '') . '<priority>' . $u['priority'] . "</priority></url>\n";
}
echo "</urlset>\n";
