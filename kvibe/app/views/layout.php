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
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,300;1,600;1,700;1,800&display=swap" rel="stylesheet">
<?php
// Tipografía de marca LG EI Headline (opcional): si existen los archivos en public/assets/fonts/ se usan.
$fontDir = APP_ROOT . '/public/assets/fonts/';
if (is_file($fontDir . 'LGEIHeadline-Bold.woff2')): ?>
<style>
@font-face{font-family:'LG EI Headline';src:url('<?= e(url('assets/fonts/LGEIHeadline-Bold.woff2')) ?>') format('woff2');font-weight:600 900;font-display:swap}
<?php if (is_file($fontDir . 'LGEIHeadline-Light.woff2')): ?>@font-face{font-family:'LG EI Headline';src:url('<?= e(url('assets/fonts/LGEIHeadline-Light.woff2')) ?>') format('woff2');font-weight:100 400;font-display:swap}<?php endif; ?>
</style>
<?php endif; ?>
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
<div class="fx" aria-hidden="true">
  <span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span><span class="orb o4"></span>
</div>

<header class="site-head">
  <a class="brand" href="<?= e(url('')) ?>" aria-label="K-VIBE+ inicio"><?php require APP_DIR . '/views/_logo.php'; ?></a>
  <a class="btn btn-neon btn-sm" href="<?= e(url('') . '#participa') ?>"><?= e(t('nav_cta')) ?></a>
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
