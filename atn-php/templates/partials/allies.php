<?php
$allies = doc('settings')['allies'] ?? [];
if (!$allies) return;
?>
<section class="section allies <?= e($class ?? '') ?>" aria-label="Aliados">
    <div class="container">
        <ul class="allies__grid">
            <?php foreach ($allies as $a):
                $card = '<div class="allies__card">'
                    . img_fill($a['background'] ?? null, ['sizes' => '(max-width: 900px) 100vw, 404px', 'alt' => ''])
                    . '<div class="allies__logo">'
                    . (!empty($a['logo']) ? img_logo($a['logo'], ['alt' => $a['name'] ?? '']) : '<span>Logo ' . e($a['name'] ?? '') . '</span>')
                    . '</div></div>'; ?>
                <li class="allies__item">
                    <h2 class="h2 allies__heading"><?= e($a['heading'] ?? '') ?></h2>
                    <?php if (!empty($a['url'])): ?>
                        <a <?= link_attrs($a['url']) ?> aria-label="<?= e(($a['heading'] ?? '') . ' ' . ($a['name'] ?? '')) ?>"><?= $card ?></a>
                    <?php else: ?>
                        <?= $card ?>
                    <?php endif; ?>
                </li>
            <?php endforeach; ?>
        </ul>
    </div>
</section>
