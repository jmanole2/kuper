<?php $noindex = true; ?>
<main class="narrow">
  <section class="card center">
    <div class="icon-badge" aria-hidden="true">!</div>
    <h1 class="display sm"><?= e($title) ?></h1>
    <p><?= e($text) ?></p>
    <?php if (!empty($back)): ?><a class="btn btn-glow" href="<?= e(url('')) ?>">Volver al inicio</a><?php endif; ?>
  </section>
</main>
