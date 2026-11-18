<main class="narrow">
  <article class="card legal">
    <h1 class="display sm"><?= e($title) ?></h1>
    <p class="hint">Versión <?= e($version) ?></p>
    <?= $html /* contenido confiable: archivo en app/legal/ */ ?>
    <p><a class="btn" href="<?= e(url('#participa')) ?>">Volver al concurso</a></p>
  </article>
</main>
