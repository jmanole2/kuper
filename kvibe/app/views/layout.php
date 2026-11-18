<?php
/** @var string $content */
$th = cfg('theme');
$ga = cfg('analytics.ga4_id');
$px = cfg('analytics.meta_pixel_id');
$withCaptcha = $withCaptcha ?? false;
$provider = cfg('captcha.provider');
?><!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= e($pageTitle ?? t('site_title')) ?></title>
<meta name="description" content="<?= e(t('meta_desc')) ?>">
<meta name="theme-color" content="<?= e($th['bg']) ?>">
<meta property="og:title" content="<?= e(t('site_title')) ?>">
<meta property="og:description" content="<?= e(t('meta_desc')) ?>">
<meta property="og:type" content="website">
<meta name="robots" content="<?= empty($noindex) ? 'index,follow' : 'noindex' ?>">
<link rel="icon" href="<?= e(asset('assets/img/favicon.svg')) ?>" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(asset('assets/css/app.css')) ?>">
<style>:root{--bg:<?= e($th['bg']) ?>;--bg2:<?= e($th['bg2']) ?>;--primary:<?= e($th['primary']) ?>;--secondary:<?= e($th['secondary']) ?>;--accent:<?= e($th['accent']) ?>}</style>
<?php if ($withCaptcha && $provider === 'turnstile'): ?>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<?php elseif ($withCaptcha && $provider === 'recaptcha'): ?>
<script src="https://www.google.com/recaptcha/api.js?render=<?= e(cfg('captcha.site_key')) ?>" async defer></script>
<?php endif; ?>
<?php if ($ga): ?>
<script async src="https://www.googletagmanager.com/gtag/js?id=<?= e($ga) ?>"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',<?= json_encode($ga) ?>);</script>
<?php endif; ?>
<?php if ($px): ?>
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',<?= json_encode($px) ?>);fbq('track','PageView');</script>
<?php endif; ?>
</head>
<body class="<?= e($bodyClass ?? '') ?>">
<header class="site-head">
  <div class="topbar">
    <a class="brand" href="<?= e(url('')) ?>" aria-label="K-VIBE+ inicio"><?php require APP_DIR . '/views/_logo.php'; ?></a>
    <nav class="nav" aria-label="Principal">
      <?php foreach (cfg('texts.nav', []) as $n): $h = str_starts_with($n['href'], '#') ? url('') . $n['href'] : url($n['href']); ?>
        <a href="<?= e($h) ?>"><?= e($n['label']) ?></a>
      <?php endforeach; ?>
    </nav>
    <a class="btn btn-outline btn-sm" href="<?= e(url('') . '#participa') ?>"><?= e(t('hero_cta')) ?></a>
  </div>
</header>

<?= $content ?>

<footer class="footer">
  <div class="footer-inner">
    <?php if (cfg('assets.lg_logo')): ?>
      <img class="lg-logo" src="<?= e(asset(cfg('assets.lg_logo'))) ?>" alt="LG Channels" height="28">
    <?php else: ?>
      <span class="lg-logo-ph">LG Channels</span>
    <?php endif; ?>
    <p><?= e(t('footer_note')) ?></p>
    <nav>
      <a href="<?= e(url('legal.php?doc=terminos')) ?>">Términos y Condiciones</a>
      <span aria-hidden="true">·</span>
      <a href="<?= e(url('legal.php?doc=privacidad')) ?>">Aviso de Privacidad</a>
    </nav>
    <p class="copy">© <?= date('Y') ?> K-VIBE+</p>
  </div>
</footer>
<script>window.KV=<?= json_encode([
    'captcha'   => $withCaptcha ? $provider : 'none',
    'siteKey'   => cfg('captcha.site_key'),
    'resize'    => (int) cfg('upload.client_resize_side'),
    'maxBytes'  => (int) cfg('upload.max_bytes'),
], JSON_UNESCAPED_SLASHES) ?>;</script>
<script src="<?= e(asset('assets/js/app.js')) ?>" defer></script>
</body>
</html>
