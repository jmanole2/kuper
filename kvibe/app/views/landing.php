<?php
/** @var array $errors @var array $old @var ?string $formError */
$withCaptcha = true;
$bodyClass = 'is-landing';
$err = fn(string $k) => isset($errors[$k]) ? '<p class="field-error" id="err-' . $k . '">' . e($errors[$k]) . '</p>' : '';
$inv = fn(string $k) => isset($errors[$k]) ? ' aria-invalid="true" aria-describedby="err-' . $k . '"' : '';
$val = fn(string $k) => e($old[$k] ?? '');
$sloganMax = (int) cfg('slogan_max');
$heroD = cfg('assets.hero_desktop');
$heroM = cfg('assets.hero_mobile');
?>
<main class="landing">
  <section class="hero" aria-labelledby="hero-title">
    <img class="deco d-gusano" src="<?= e(asset('assets/img/v3/deco-gusano.webp')) ?>" alt="" aria-hidden="true">
    <img class="deco d-estrellas" src="<?= e(asset('assets/img/v3/deco-estrellas.webp')) ?>" alt="" aria-hidden="true">
    <img class="deco d-nota" src="<?= e(asset('assets/img/v3/deco-nota.webp')) ?>" alt="" aria-hidden="true">
    <img class="deco d-espiral" src="<?= e(asset('assets/img/v3/deco-espiral.webp')) ?>" alt="" aria-hidden="true">

    <h1 id="hero-title" class="hero-head">
      <span class="over"><?= e(t('hero_over')) ?></span>
      <img class="hero-logo" src="<?= e(asset(cfg('assets.logo'))) ?>" alt="K-VIBE+" width="1000" height="460" fetchpriority="high">
      <span class="pill-hero"><span><?= e(t('hero_pill')) ?></span></span>
    </h1>

    <ol class="step-list" id="mecanica" aria-label="<?= e(t('steps_title')) ?>">
      <?php foreach (cfg('texts.steps') as $i => $s): ?>
        <li class="step<?= $i % 2 ? ' is-right' : '' ?>">
          <img class="step-img" src="<?= e(asset('assets/img/v3/' . $s['image'])) ?>" alt="" width="600" height="590" loading="<?= $i ? 'lazy' : 'eager' ?>">
          <p class="glass step-text"><?= brand($s['text']) ?></p>
        </li>
      <?php endforeach; ?>
    </ol>

    <div class="claim">
      <p><span class="light"><?= e(t('claim_light')) ?></span><br><b><?= e(t('claim_bold')) ?></b></p>
      <i class="claim-sep" aria-hidden="true"></i>
      <img class="claim-lg" src="<?= e(asset(cfg('assets.lg_logo'))) ?>" alt="LG Channels" width="520" height="92">
    </div>

    <a class="btn btn-neon btn-lg" href="#participa"><?= e(t('hero_cta')) ?></a>
  </section>

  <div class="sheet">

  <?php if (cfg('show_prizes')): ?>
  <section class="prizes card">
    <h2 class="section-title">Premios</h2>
    <ul class="chips"><?php foreach (cfg('prizes') as $p): ?><li><?= e($p) ?></li><?php endforeach; ?></ul>
  </section>
  <?php endif; ?>

  <section class="rules card" id="reglas" aria-labelledby="rules-title">
    <h2 id="rules-title" class="section-title"><?= e(t('rules_title')) ?></h2>
    <ul class="rule-list">
      <?php foreach (cfg('texts.rules') as $r): ?><li><?= brand($r) ?></li><?php endforeach; ?>
    </ul>
  </section>

  <section id="participa" class="form-wrap card" aria-labelledby="form-title">
    <h2 id="form-title" class="section-title"><?= e(t('form_title')) ?></h2>

    <?php if (!empty($formError)): ?>
      <div class="alert alert-error" role="alert" tabindex="-1" id="form-alert"><?= e($formError) ?></div>
    <?php endif; ?>

    <form id="entry-form" method="post" action="<?= e(url('')) ?>" enctype="multipart/form-data" novalidate>
      <?= csrf_field() ?>

      <fieldset>
        <legend><span class="leg-num">1</span> Tus datos</legend>
        <div class="grid-2">
          <div class="field">
            <label for="first_name">Nombre</label>
            <input id="first_name" name="first_name" type="text" required maxlength="<?= (int) cfg('name_max') ?>" autocomplete="given-name" value="<?= $val('first_name') ?>"<?= $inv('first_name') ?>>
            <?= $err('first_name') ?>
          </div>
          <div class="field">
            <label for="last_name">Apellido</label>
            <input id="last_name" name="last_name" type="text" required maxlength="<?= (int) cfg('name_max') ?>" autocomplete="family-name" value="<?= $val('last_name') ?>"<?= $inv('last_name') ?>>
            <?= $err('last_name') ?>
          </div>
        </div>
        <div class="field">
          <label for="email">Correo electrónico</label>
          <input id="email" name="email" type="email" required maxlength="190" autocomplete="email" inputmode="email" value="<?= $val('email') ?>"<?= $inv('email') ?>>
          <p class="hint">Te enviaremos un código de 6 dígitos para confirmar.</p>
          <?= $err('email') ?>
        </div>
        <div class="field">
          <label for="phone">Celular (10 dígitos)</label>
          <input id="phone" name="phone" type="tel" required inputmode="numeric" autocomplete="tel-national" maxlength="20" placeholder="55 1234 5678" value="<?= $val('phone') ?>"<?= $inv('phone') ?>>
          <?= $err('phone') ?>
        </div>
        <?php if (cfg('category_enabled')): ?>
        <div class="field">
          <label for="category"><?= brand(t('category_label')) ?> <span class="opt">(opcional)</span></label>
          <div class="select">
            <select id="category" name="category"<?= $inv('category') ?>>
              <option value="">Elige una opción</option>
              <?php foreach (cfg('categories') as $code => $label): ?>
                <option value="<?= e($code) ?>"<?= ($old['category'] ?? '') === $code ? ' selected' : '' ?>><?= e($label) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <?= $err('category') ?>
        </div>
        <?php endif; ?>
      </fieldset>

      <fieldset>
        <legend><span class="leg-num">2</span> <?= e(t('photo_label')) ?></legend>
        <p class="hint"><?= brand(t('photo_help')) ?></p>
        <label class="dropzone<?= isset($errors['photo']) ? ' is-invalid' : '' ?>" for="photo">
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required<?= $inv('photo') ?>>
          <span class="dz-empty">
            <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path fill="currentColor" d="M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
            <strong>Toca para tomar o elegir tu foto</strong>
            <small>Máximo <?= round(cfg('upload.max_bytes') / 1048576) ?> MB</small>
          </span>
          <img class="dz-preview" alt="Vista previa de tu foto" hidden>
          <span class="dz-change" hidden>Cambiar foto</span>
        </label>
        <?php if (!empty($formError) && !isset($errors['photo'])): ?>
          <p class="hint hint-warn">Por seguridad, vuelve a elegir tu foto antes de enviar.</p>
        <?php endif; ?>
        <?= $err('photo') ?>
      </fieldset>

      <fieldset>
        <legend><span class="leg-num">3</span> Tu slogan</legend>
        <div class="field">
          <label for="slogan"><?= brand(t('slogan_label')) ?></label>
          <textarea id="slogan" name="slogan" rows="3" required maxlength="<?= $sloganMax ?>" placeholder="<?= e(t('slogan_placeholder')) ?>" data-counter="slogan-count"<?= $inv('slogan') ?>><?= $val('slogan') ?></textarea>
          <p class="counter" id="slogan-count" aria-live="polite"><span>0</span> / <?= $sloganMax ?></p>
          <?= $err('slogan') ?>
        </div>
      </fieldset>

      <fieldset class="consents">
        <label class="check">
          <input type="checkbox" name="terms" value="1" required<?= !empty($old['terms']) ? ' checked' : '' ?><?= $inv('terms') ?>>
          <span>Soy mayor de 18 años y acepto las <a href="<?= e(url('legal.php?doc=terminos')) ?>" target="_blank" rel="noopener">Bases y Términos y Condiciones</a></span>
        </label>
        <?= $err('terms') ?>
        <label class="check">
          <input type="checkbox" name="privacy" value="1" required<?= !empty($old['privacy']) ? ' checked' : '' ?><?= $inv('privacy') ?>>
          <span>Acepto el <a href="<?= e(url('legal.php?doc=privacidad')) ?>" target="_blank" rel="noopener">Aviso de Privacidad</a></span>
        </label>
        <?= $err('privacy') ?>
      </fieldset>

      <?php if (cfg('captcha.provider') === 'turnstile'): ?>
        <div class="cf-turnstile" data-sitekey="<?= e(cfg('captcha.site_key')) ?>" data-language="es" data-size="flexible" data-appearance="interaction-only"></div>
      <?php elseif (cfg('captcha.provider') === 'recaptcha'): ?>
        <input type="hidden" name="g-recaptcha-response" id="g-recaptcha-response">
      <?php endif; ?>

      <button class="btn btn-neon btn-block" type="submit" data-busy="Subiendo tu foto…"><?= e(t('submit')) ?></button>
      <p class="fine">Una participación por persona. Al enviar te mandaremos un código a tu correo.</p>
    </form>
  </section>
  </div>
</main>
