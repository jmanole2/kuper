<?php
if (empty($data['enabled']) || empty($data['items'])) return;
?>
<section class="section recetario" aria-labelledby="recetario-title">
    <div class="container">
        <?php if (!empty($data['title'])): ?><h2 class="h2 recetario__title" id="recetario-title"><?= e($data['title']) ?></h2><?php endif; ?>
        <ul class="recetario__grid">
            <?php foreach ($data['items'] as $r): $file = media_get($r['file'] ?? null); ?>
                <li class="recetario__card">
                    <div class="recetario__image"><?= img_fill($r['image'] ?? null, ['sizes' => '(max-width: 600px) 100vw, 484px', 'alt' => 'Portada ' . ($r['title'] ?? '')]) ?></div>
                    <div class="recetario__copy">
                        <h3 class="recetario__name"><?= e($r['title'] ?? '') ?></h3>
                        <?php if (!empty($r['subtitle'])): ?><p class="recetario__sub"><?= e($r['subtitle']) ?></p><?php endif; ?>
                        <?php if ($file): ?>
                            <a class="recetario__download" href="<?= e(media_url($file)) ?>" download><?= e(($r['downloadLabel'] ?? '') ?: 'Descargar') ?><span class="sr-only"> <?= e($r['title'] ?? '') ?></span></a>
                        <?php endif; ?>
                    </div>
                </li>
            <?php endforeach; ?>
        </ul>
    </div>
</section>
