<?php
$s = doc('settings');
$title = ($d['hero']['title'] ?? '') ?: ($s['siteName'] ?? '');
$slides = array_values(array_filter(array_map(fn($x) => media_get($x['image'] ?? null), $d['hero']['slides'] ?? [])));
?>
<section class="page-hero" aria-label="Portada">
    <div class="container">
        <h1 class="display page-hero__title">
            <?php if (!empty($d['hero']['logo'])): ?>
                <?= img_logo($d['hero']['logo'], ['alt' => $title, 'class' => 'page-hero__logo', 'eager' => true]) ?>
            <?php else: ?>
                <?= e($title) ?>
            <?php endif; ?>
        </h1>
        <?php if ($slides): ?>
            <div class="carousel" role="region" aria-roledescription="carrusel" aria-label="Fotos de <?= e($s['siteName'] ?? '') ?>" data-carousel>
                <?php foreach ($slides as $i => $m): ?>
                    <div class="carousel__slide<?= $i === 0 ? ' is-active' : '' ?>" role="group" aria-roledescription="diapositiva" aria-label="<?= $i + 1 ?> de <?= count($slides) ?>"<?= $i ? ' aria-hidden="true"' : '' ?>>
                        <?= img_fill($m['id'], ['sizes' => '(max-width: 1440px) 100vw, 1281px', 'eager' => $i === 0]) ?>
                    </div>
                <?php endforeach; ?>
                <?php if (count($slides) > 1): ?>
                    <button type="button" class="carousel__arrow carousel__arrow--prev" aria-label="Foto anterior" data-prev>‹</button>
                    <button type="button" class="carousel__arrow carousel__arrow--next" aria-label="Foto siguiente" data-next>›</button>
                    <div class="carousel__dots">
                        <?php foreach ($slides as $i => $m): ?>
                            <button type="button" class="<?= $i === 0 ? 'is-active' : '' ?>" aria-label="Ir a la foto <?= $i + 1 ?>" data-dot="<?= $i ?>"></button>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>
    </div>
</section>

<?php if (!empty($d['about']['title'])): ?>
<section class="section about" aria-labelledby="about-title">
    <div class="container about__grid">
        <div class="about__copy">
            <h2 class="about__title" id="about-title"><?= e($d['about']['title']) ?></h2>
            <?= paragraphs($d['about']['body'] ?? '') ?>
        </div>
        <?php if (!empty($d['about']['image'])): ?>
            <div class="about__media"><?= img_fill($d['about']['image'], ['sizes' => '(max-width: 900px) 100vw, 633px']) ?></div>
        <?php endif; ?>
    </div>
</section>
<?php endif; ?>

<?php partial('allies'); ?>

<?php partial('icon_grid', ['id' => 'impacto', 'title' => $d['impact']['title'] ?? '', 'items' => $d['impact']['items'] ?? []]); ?>

<?php partial('map', ['map' => $d['map'] ?? [], 'wide' => true]); ?>

<?php if (!empty($d['programs'])): ?>
<section class="section programs" aria-label="Programas">
    <div class="container programs__grid">
        <?php foreach ($d['programs'] as $p): ?>
            <article class="program-card">
                <div class="program-card__image"><?= img_fill($p['image'] ?? null, ['sizes' => '(max-width: 900px) 100vw, 624px']) ?></div>
                <h2 class="program-card__question"><?= e($p['question'] ?? '') ?></h2>
                <?= button($p['cta'] ?? null) ?>
            </article>
        <?php endforeach; ?>
    </div>
</section>
<?php endif; ?>

<?php partial('recetario', ['data' => $d['recetario'] ?? []]); ?>

<?php if ($cta = button($d['communityCta'] ?? null)): ?>
<section class="section community-cta"><div class="container"><?= $cta ?></div></section>
<?php endif; ?>
