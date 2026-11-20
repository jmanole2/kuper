<?php
/** Metadatos SEO: title, description, canonical, Open Graph, Twitter y JSON-LD. */

function seo_head(array $page): string
{
    $s = doc('settings');
    $seo = $page['seo'] ?? [];
    $siteName = $s['siteName'] ?? '';
    $title = trim((string) ($seo['title'] ?? ''));
    if ($title === '') {
        $title = !empty($page['title']) ? $page['title'] . ' | ' . $siteName : ($s['defaultTitle'] ?? $siteName);
    }
    $desc = trim((string) ($seo['description'] ?? '')) ?: (string) ($s['defaultDescription'] ?? '');
    $canonical = site_url() . ($page['path'] ?? '/');
    $imgM = media_get($seo['image'] ?? null) ?: media_get($s['defaultImage'] ?? null);
    $img = $imgM ? absolute_url(media_url($imgM, isset($imgM['variants']['og']) ? 'og' : null)) : null;
    $noindex = !empty($seo['noIndex']);

    $h = [];
    $h[] = '<title>' . e($title) . '</title>';
    if ($desc !== '') {
        $h[] = '<meta name="description" content="' . e($desc) . '">';
    }
    $h[] = '<meta name="robots" content="' . ($noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large') . '">';
    if (!$noindex) {
        $h[] = '<link rel="canonical" href="' . e($canonical) . '">';
    }
    $h[] = '<meta property="og:type" content="website">';
    $h[] = '<meta property="og:locale" content="es_MX">';
    $h[] = '<meta property="og:site_name" content="' . e($siteName) . '">';
    $h[] = '<meta property="og:title" content="' . e($title) . '">';
    if ($desc !== '') {
        $h[] = '<meta property="og:description" content="' . e($desc) . '">';
    }
    $h[] = '<meta property="og:url" content="' . e($canonical) . '">';
    if ($img) {
        $h[] = '<meta property="og:image" content="' . e($img) . '">';
        if (isset($imgM['variants']['og'])) {
            $h[] = '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">';
        }
        $h[] = '<meta property="og:image:alt" content="' . e($imgM['alt'] ?: $title) . '">';
    }
    $h[] = '<meta name="twitter:card" content="' . ($img ? 'summary_large_image' : 'summary') . '">';
    $h[] = '<meta name="twitter:title" content="' . e($title) . '">';
    if ($desc !== '') {
        $h[] = '<meta name="twitter:description" content="' . e($desc) . '">';
    }
    if ($img) {
        $h[] = '<meta name="twitter:image" content="' . e($img) . '">';
    }
    if (!empty($s['googleVerification'])) {
        $h[] = '<meta name="google-site-verification" content="' . e($s['googleVerification']) . '">';
    }
    return implode("\n    ", $h);
}

function json_ld(array $data): string
{
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG);
    return '<script type="application/ld+json">' . $json . '</script>';
}

/** Organization + WebSite, presentes en todas las páginas. */
function json_ld_site(): string
{
    $s = doc('settings');
    $base = site_url();
    $sameAs = array_values(array_filter([
        $s['social']['facebook'] ?? '', $s['social']['linkedin'] ?? '', $s['social']['instagram'] ?? '',
    ]));
    $logo = media_get($s['logo'] ?? null);
    $org = array_filter([
        '@context' => 'https://schema.org',
        '@type' => 'Organization',
        'name' => $s['siteName'] ?? '',
        'url' => $base . '/',
        'logo' => $logo ? absolute_url(media_url($logo)) : null,
        'sameAs' => $sameAs ?: null,
    ]);
    $site = [
        '@context' => 'https://schema.org',
        '@type' => 'WebSite',
        'name' => $s['siteName'] ?? '',
        'url' => $base . '/',
        'inLanguage' => 'es-MX',
    ];
    return json_ld([$org, $site]);
}
