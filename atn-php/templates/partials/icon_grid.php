<?php
if (empty($items)) return;
?>
<section class="section icon-grid" id="<?= e($id) ?>" aria-labelledby="<?= e($id) ?>-title">
    <div class="container">
        <?php if (!empty($title)): ?><h2 class="h2 icon-grid__title" id="<?= e($id) ?>-title"><?= e($title) ?></h2><?php endif; ?>
        <ul class="icon-grid__list">
            <?php foreach ($items as $it): ?>
                <li class="icon-item">
                    <span class="icon-item__icon"><?= icon($it['icon'] ?? 'globe') ?></span>
                    <h3 class="icon-item__title"><?= e($it['title'] ?? '') ?></h3>
                    <?php if (!empty($it['description'])): ?><p class="icon-item__desc"><?= e($it['description']) ?></p><?php endif; ?>
                </li>
            <?php endforeach; ?>
        </ul>
    </div>
</section>
