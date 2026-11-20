<?php
$s = doc('settings');
$hero = $p['hero'] ?? [];
$heroTitle = ($hero['title'] ?? '') ?: ($s['siteName'] ?? '');
$bg = media_get($hero['background'] ?? null);
?>
<section class="program-hero" aria-label="Portada">
    <?= img_fill($hero['background'] ?? null, ['sizes' => '100vw', 'eager' => true, 'alt' => '', 'class' => 'program-hero__bg']) ?>
    <div class="program-hero__dimmer"></div>
    <div class="container program-hero__content">
        <h1 class="program-hero__title">
            <?php if (!empty($hero['logo'])): ?>
                <?= img_logo($hero['logo'], ['alt' => $heroTitle, 'eager' => true]) ?>
            <?php else: ?>
                <span class="program-hero__name"><?= e($heroTitle) ?></span>
            <?php endif; ?>
            <?php if (!empty($hero['subtitle'])): ?><span class="program-hero__subtitle"><?= e($hero['subtitle']) ?></span><?php endif; ?>
        </h1>
        <?= button($hero['cta'] ?? null, 'primary', 'lg') ?>
    </div>
</section>

<?php if (!empty($p['intro']['title'])): ?>
<section class="section program-intro" aria-labelledby="intro-title">
    <div class="container program-intro__grid">
        <div class="program-intro__copy">
            <h2 class="h2 h2--flat" id="intro-title"><?= e($p['intro']['title']) ?></h2>
            <?= paragraphs($p['intro']['body'] ?? '', 'lead') ?>
        </div>
        <?php if (!empty($p['intro']['image'])): ?>
            <div class="program-intro__media"><?= img_fill($p['intro']['image'], ['sizes' => '(max-width: 900px) 100vw, 624px']) ?></div>
        <?php endif; ?>
    </div>
</section>
<?php endif; ?>

<?php partial('allies', ['class' => 'allies--tight']); ?>

<?php partial('icon_grid', ['id' => 'beneficios', 'title' => $p['benefits']['title'] ?? '', 'items' => $p['benefits']['items'] ?? []]); ?>

<?php $call = $p['call'] ?? []; if (!empty($call['title']) || !empty($call['images'])): ?>
<section class="section call" id="convocatoria" aria-labelledby="convocatoria-title">
    <div class="container">
        <?php if (!empty($call['title'])): ?><h2 class="h2 h2--lg call__title" id="convocatoria-title"><?= e($call['title']) ?></h2><?php endif; ?>
        <?php if (!empty($call['images'])): ?>
            <div class="call__images">
                <?php foreach ($call['images'] as $im): ?>
                    <div class="call__image"><?= img_fill($im['image'] ?? null, ['sizes' => '(max-width: 900px) 100vw, 566px']) ?></div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
        <?php if ($b = button($call['cta'] ?? null)): ?><div class="call__cta"><?= $b ?></div><?php endif; ?>
    </div>
</section>
<?php endif; ?>

<?php if (!empty($call['eligibility'])): ?>
<section class="section eligibility" aria-labelledby="requisitos-title">
    <div class="container eligibility__inner">
        <?php if (!empty($call['eligibilityTitle'])): ?><h2 class="h2 h2--lg" id="requisitos-title"><?= e($call['eligibilityTitle']) ?></h2><?php endif; ?>
        <ul class="eligibility__list">
            <?php foreach ($call['eligibility'] as $req): ?><li><?= e($req['text'] ?? '') ?></li><?php endforeach; ?>
        </ul>
    </div>
</section>
<?php endif; ?>

<?php if (!empty($p['process']['steps'])): ?>
<section class="section process" aria-labelledby="proceso-title">
    <div class="container">
        <?php if (!empty($p['process']['title'])): ?><h2 class="h2 h2--lg" id="proceso-title"><?= e($p['process']['title']) ?></h2><?php endif; ?>
        <ol class="process__list">
            <?php foreach ($p['process']['steps'] as $i => $st): ?>
                <li class="icon-item">
                    <span class="icon-item__icon"><?= icon($st['icon'] ?? 'globe') ?></span>
                    <h3 class="icon-item__title"><span class="process__num"><?= $i + 1 ?>.</span> <?= e($st['title'] ?? '') ?></h3>
                    <?php if (!empty($st['description'])): ?><p class="icon-item__desc"><?= e($st['description']) ?></p><?php endif; ?>
                </li>
            <?php endforeach; ?>
        </ol>
    </div>
</section>
<?php endif; ?>

<?php if (!empty($p['stages']['items'])): ?>
<section class="section stages" aria-labelledby="etapas-title">
    <div class="container">
        <?php if (!empty($p['stages']['title'])): ?><h2 class="h2 h2--flat stages__title" id="etapas-title"><?= e($p['stages']['title']) ?></h2><?php endif; ?>
        <ol class="stages__grid">
            <?php foreach ($p['stages']['items'] as $st): ?>
                <li class="stage-card">
                    <div class="stage-card__image"><?= img_fill($st['image'] ?? null, ['sizes' => '(max-width: 900px) 100vw, 404px', 'alt' => '']) ?></div>
                    <h3 class="stage-card__title"><?= e($st['title'] ?? '') ?></h3>
                    <?php if (!empty($st['description'])): ?><p class="stage-card__desc"><?= e($st['description']) ?></p><?php endif; ?>
                </li>
            <?php endforeach; ?>
        </ol>
    </div>
</section>
<?php endif; ?>

<?php partial('testimonials', ['data' => $p['testimonials'] ?? []]); ?>

<?php if (!empty($p['community']['title'])): ?>
<section class="section split community" aria-labelledby="comunidad-title">
    <div class="container split__grid">
        <div class="split__media"><?= img_fill($p['community']['image'] ?? null, ['sizes' => '(max-width: 900px) 100vw, 625px']) ?></div>
        <div class="split__copy">
            <h2 class="h2 h2--flat" id="comunidad-title"><?= e($p['community']['title']) ?></h2>
            <?php if ($b = button($p['community']['cta'] ?? null)): ?><div class="btn-row"><?= $b ?></div><?php endif; ?>
        </div>
    </div>
</section>
<?php endif; ?>

<?= json_ld(array_filter([
    '@context' => 'https://schema.org',
    '@type' => 'Course',
    'name' => trim(($s['siteName'] ?? '') . ' ' . ($p['name'] ?? '')),
    'description' => ($p['seo']['description'] ?? '') ?: mb_substr((string) ($p['intro']['body'] ?? ''), 0, 300),
    'url' => site_url() . '/' . $slug,
    'inLanguage' => 'es-MX',
    'isAccessibleForFree' => true,
    'image' => $bg ? absolute_url(media_url($bg, isset($bg['variants']['og']) ? 'og' : null)) : null,
    'provider' => ['@type' => 'Organization', 'name' => $s['siteName'] ?? '', 'url' => site_url() . '/'],
    'offers' => ['@type' => 'Offer', 'price' => 0, 'priceCurrency' => 'MXN', 'category' => 'Free'],
    'hasCourseInstance' => ['@type' => 'CourseInstance', 'courseMode' => 'Online'],
])) ?>
