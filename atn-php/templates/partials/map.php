<?php
if (empty($map['enabled']) || empty($map['title'])) return;
$embed = trim((string) ($map['embedUrl'] ?? ''));
$embedOk = preg_match('#^https://(www\.)?google\.[a-z.]+/maps/#i', $embed);
?>
<section class="section split map-section<?= !empty($wide) ? ' map-section--wide' : '' ?>" id="mapa" aria-labelledby="mapa-title">
    <div class="container split__grid">
        <div class="split__media map-section__media">
            <?php if ($embedOk): ?>
                <iframe src="<?= e($embed) ?>" title="<?= e($map['title']) ?>" loading="lazy" allowfullscreen></iframe>
            <?php else: ?>
                <?= img_fill($map['image'] ?? null, ['sizes' => '(max-width: 900px) 100vw, 629px']) ?>
            <?php endif; ?>
        </div>
        <div class="split__copy">
            <h2 class="h2 h2--flat" id="mapa-title"><?= e($map['title']) ?></h2>
            <?php if (!empty($map['description'])): ?><p class="lead"><?= e($map['description']) ?></p><?php endif; ?>
            <?php $b1 = button($map['primaryButton'] ?? null); $b2 = button($map['secondaryButton'] ?? null, 'secondary'); ?>
            <?php if ($b1 || $b2): ?><div class="btn-row"><?= $b1 . $b2 ?></div><?php endif; ?>
        </div>
    </div>
</section>
