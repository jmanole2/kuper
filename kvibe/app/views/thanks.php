<?php $noindex = true; ?>
<main class="narrow">
  <section class="card center thanks">
    <div class="icon-badge ok" aria-hidden="true">✓</div>
    <h1 class="display sm"><?= brand(t('thanks_title')) ?></h1>
    <p><?= e(t('thanks_text')) ?></p>
    <p class="folio">Folio <strong><?= e($folio) ?></strong></p>

    <div class="lg-banner">
      <?php if (cfg('assets.lg_banner')): ?>
        <img src="<?= e(asset(cfg('assets.lg_banner'))) ?>" alt="LG Channels · K-VIBE+ en el canal 564" width="1200" height="400">
      <?php else: ?>
        <div class="lg-banner-ph">
          <?php if (cfg('assets.lg_logo')): ?><img src="<?= e(asset(cfg('assets.lg_logo'))) ?>" alt="LG Channels" width="520" height="92"><?php else: ?><span>LG Channels</span><?php endif; ?>
          <small>Sintoniza K-VIBE+ en el canal 564</small>
        </div>
      <?php endif; ?>
    </div>

    <p class="announce">Los ganadores se anunciarán el <strong><?= e(cfg('winners_announce_date')) ?></strong>.</p>
  </section>
</main>
