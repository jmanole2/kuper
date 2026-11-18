<?php $soon = ($state ?? '') === 'soon'; ?>
<main class="narrow">
  <section class="card center">
    <div class="icon-badge" aria-hidden="true"><?= $soon ? '✦' : '★' ?></div>
    <h1 class="display sm"><?= e(t($soon ? 'soon_title' : 'closed_title')) ?></h1>
    <p><?= e(t($soon ? 'soon_text' : 'closed_text')) ?></p>
    <?php if (!$soon && cfg('winners_announce_date')): ?>
      <p class="announce">Los ganadores se anunciarán el <strong><?= e(cfg('winners_announce_date')) ?></strong>.</p>
    <?php endif; ?>
  </section>
</main>
