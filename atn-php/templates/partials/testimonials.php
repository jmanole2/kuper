<?php
if (empty($data['items'])) return;
?>
<section class="section testimonials" aria-labelledby="testimonios-title">
    <div class="container">
        <?php if (!empty($data['title'])): ?><h2 class="h2 h2--lg" id="testimonios-title"><?= e($data['title']) ?></h2><?php endif; ?>
        <ul class="testimonials__grid">
            <?php foreach ($data['items'] as $t): ?>
                <li>
                    <figure class="quote-card">
                        <blockquote class="quote-card__text"><?= e($t['quote'] ?? '') ?></blockquote>
                        <figcaption class="quote-card__author">
                            <?php if (!empty($t['avatar'])): ?><span class="quote-card__avatar"><?= img_fill($t['avatar'], ['sizes' => '45px', 'alt' => '']) ?></span><?php endif; ?>
                            <span>
                                <span class="quote-card__name"><?= e($t['name'] ?? '') ?></span>
                                <?php if (!empty($t['detail'])): ?><span class="quote-card__detail"><?= e($t['detail']) ?></span><?php endif; ?>
                            </span>
                        </figcaption>
                    </figure>
                </li>
            <?php endforeach; ?>
        </ul>
    </div>
</section>
