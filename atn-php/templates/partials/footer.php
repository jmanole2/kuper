<?php
$social = array_filter(['facebook' => $s['social']['facebook'] ?? '', 'linkedin' => $s['social']['linkedin'] ?? '', 'instagram' => $s['social']['instagram'] ?? '']);
?>
<footer class="site-footer">
    <div class="container">
        <div class="site-footer__grid">
            <div class="site-footer__brand">
                <p class="site-footer__name"><?= e($s['siteName'] ?? '') ?></p>
                <?php if ($social): ?>
                    <ul class="site-footer__social" aria-label="Redes sociales">
                        <?php foreach ($social as $k => $href): ?>
                            <li><a href="<?= e($href) ?>" target="_blank" rel="noopener noreferrer" aria-label="<?= e(ucfirst($k)) ?>"><?= social_icon($k) ?></a></li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
            </div>
            <div class="site-footer__legal">
                <?php if (!empty($s['footerLinks'])): ?>
                    <ul>
                        <?php foreach ($s['footerLinks'] as $l): ?>
                            <li><a <?= link_attrs($l['url'] ?? '#') ?>><?= e($l['label'] ?? '') ?></a></li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
                <?php if (!empty($s['footerLogos'])): ?>
                    <ul class="site-footer__logos" aria-label="Entidades participantes">
                        <?php foreach ($s['footerLogos'] as $l):
                            $inner = !empty($l['logo']) ? img_logo($l['logo'], ['alt' => $l['name'] ?? '']) : '<span>' . e($l['name'] ?? '') . '</span>'; ?>
                            <li><?= !empty($l['url']) ? '<a ' . link_attrs($l['url']) . ' aria-label="' . e($l['name'] ?? '') . '">' . $inner . '</a>' : $inner ?></li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
            </div>
            <address class="site-footer__contact">
                <?php if (!empty($s['contactTitle'])): ?><p><?= e($s['contactTitle']) ?></p><?php endif; ?>
                <?php foreach ($s['contactLinks'] ?? [] as $c): ?>
                    <?php if (!empty($c['url'])): ?>
                        <a <?= link_attrs($c['url']) ?>><?= e($c['label'] ?? '') ?></a>
                    <?php else: ?>
                        <p><?= e($c['label'] ?? '') ?></p>
                    <?php endif; ?>
                <?php endforeach; ?>
            </address>
        </div>
    </div>
</footer>
