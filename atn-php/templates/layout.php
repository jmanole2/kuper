<?php
$s = doc('settings');
$page = $GLOBALS['page'] ?? ['path' => '/'];
$overlay = !empty($page['overlay']);
$logo = media_get($overlay ? (($s['logoLight'] ?? null) ?: ($s['logo'] ?? null)) : ($s['logo'] ?? null));
$current = $page['path'] ?? '/';
$cssVer = @filemtime(ROOT . '/assets/css/styles.css') ?: 1;
$jsVer = @filemtime(ROOT . '/assets/js/main.js') ?: 1;
$ga = trim((string) ($s['gaId'] ?? ''));
?><!DOCTYPE html>
<html lang="es-MX">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?= seo_head($page) ?>
    <meta name="theme-color" content="#ffffff">
    <link rel="preload" href="<?= e(url('/assets/fonts/inter-latin.woff2')) ?>" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="<?= e(url('/assets/css/styles.css')) ?>?v=<?= $cssVer ?>">
    <link rel="icon" href="<?= e(url('/assets/favicon.svg')) ?>" type="image/svg+xml">
    <?= json_ld_site() ?>
</head>
<body>
<a class="skip-link" href="#contenido">Saltar al contenido</a>

<header class="site-header site-header--<?= $overlay ? 'light' : 'dark' ?>" data-header>
    <div class="container site-header__inner">
        <a href="<?= e(url('/')) ?>" class="site-header__brand" aria-label="<?= e(($s['siteName'] ?? '') . ' – Inicio') ?>">
            <?php if ($logo): ?>
                <?= img_logo($logo['id'], ['alt' => $s['siteName'] ?? '', 'eager' => true]) ?>
            <?php else: ?>
                <?= e($s['siteName'] ?? '') ?>
            <?php endif; ?>
        </a>
        <button type="button" class="site-header__toggle" aria-expanded="false" aria-controls="menu-principal" aria-label="Abrir menú" data-menu-toggle>
            <span></span><span></span><span></span>
        </button>
        <nav id="menu-principal" class="site-header__nav" aria-label="Principal">
            <ul>
                <?php foreach ($s['nav'] ?? [] as $item): ?>
                    <?php $active = ($item['url'] ?? '') !== '/' && $current === ($item['url'] ?? ''); ?>
                    <li><a <?= link_attrs($item['url'] ?? '#') ?><?= $active ? ' aria-current="page"' : '' ?>><?= e($item['label'] ?? '') ?></a></li>
                <?php endforeach; ?>
            </ul>
        </nav>
    </div>
</header>

<main id="contenido">
<?= $content ?>
</main>

<?php partial('footer', ['s' => $s]); ?>

<?php
$wa = preg_replace('/\D/', '', (string) ($s['whatsapp']['number'] ?? ''));
if ($wa): ?>
<a class="whatsapp-fab" href="https://wa.me/<?= e($wa) ?><?= !empty($s['whatsapp']['message']) ? '?text=' . e(rawurlencode($s['whatsapp']['message'])) : '' ?>" target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp"><?= whatsapp_icon() ?></a>
<?php endif; ?>

<script src="<?= e(url('/assets/js/main.js')) ?>?v=<?= $jsVer ?>" defer></script>
<?php if (preg_match('/^G-[A-Z0-9]+$/i', $ga)): ?>
<script async src="https://www.googletagmanager.com/gtag/js?id=<?= e($ga) ?>"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','<?= e($ga) ?>');</script>
<?php endif; ?>
</body>
</html>
