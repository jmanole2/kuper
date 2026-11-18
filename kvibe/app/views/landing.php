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
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-copy">
        <p class="kicker"><?= e(t('hero_kicker')) ?></p>
        <h1 class="display"><?= brand(t('hero_title')) ?>
          <span class="icon-pill" aria-hidden="true">
            <span title="K-POP"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg></span>
            <span title="Dramas y películas"><svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="2"/><path d="m3 9 2.5-5 3.5.8L6.5 9.6M9 4.8l3.5.8L10 10.4M12.5 5.6l3.5.8-2.5 4.8M16 6.4l3.5.8L17 12"/></svg></span>
            <span title="Comida"><svg viewBox="0 0 24 24"><path d="M3 12h18a9 9 0 0 1-18 0Z"/><path d="M8 3.5 11 10M15 3l-2 7M6 21h12"/></svg></span>
            <span title="Belleza"><svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/></svg></span>
          </span>
        </h1>
        <p class="lead"><?= brand(t('hero_subtitle')) ?></p>

        <form class="hero-cta" method="get" action="<?= e(url('')) ?>#participa">
          <label class="sr-only" for="hero-email"><?= e(t('hero_email_ph')) ?></label>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>
          <input id="hero-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="<?= e(t('hero_email_ph')) ?>">
          <button class="btn btn-dark" type="submit"><?= e(t('hero_cta')) ?></button>
        </form>

        <div class="hero-meta">
          <span class="chip-ch"><b>564</b> Canal LG Channels</span>
          <span><?= e(t('hero_meta')) ?></span>
        </div>
      </div>

      <div class="hero-visual<?= $heroD ? ' has-photo' : '' ?>">
        <?php if ($heroD): ?>
          <picture>
            <?php if ($heroM): ?><source media="(max-width: 860px)" srcset="<?= e(asset($heroM)) ?>"><?php endif; ?>
            <img src="<?= e(asset($heroD)) ?>" alt="" fetchpriority="high">
          </picture>
        <?php else: ?>
          <div class="tv" aria-hidden="true">
            <div class="tv-screen">
              <span class="tv-live">EN VIVO</span>
              <span class="tv-ch">CH 564</span>
              <span class="tv-logo">K-VIBE<b>+</b></span>
              <span class="tv-sub">Canal 564 · LG Channels</span>
              <span class="tv-bar"><i></i></span>
            </div>
            <div class="tv-stand"></div>
          </div>
        <?php endif; ?>
        <?php foreach (cfg('texts.callouts', []) as $c): ?>
          <span class="callout <?= $c['side'] === 'left' ? 'to-left' : 'to-right' ?><?= $c['x'] >= 50 ? ' m-left' : '' ?>" style="left:<?= (float) $c['x'] ?>%;top:<?= (float) $c['y'] ?>%">
            <i class="dot"></i><i class="line"></i><span class="txt"><?= e($c['label']) ?></span>
          </span>
        <?php endforeach; ?>
      </div>
    </div>
  </section>

  <div class="sheet">
  <section class="steps" id="mecanica" aria-labelledby="steps-title">
    <h2 id="steps-title" class="section-title"><?= e(t('steps_title')) ?></h2>
    <ol class="step-list">
      <?php foreach (cfg('texts.steps') as $i => $s): ?>
        <li class="step">
          <span class="step-num"><?= sprintf('%02d', $i + 1) ?></span>
          <h3><?= brand($s['title']) ?></h3>
          <p><?= brand($s['text']) ?></p>
        </li>
      <?php endforeach; ?>
    </ol>
  </section>

  <?php if (cfg('show_prizes')): ?>
  <section class="prizes card">
    <h2 class="section-title">Premios</h2>
    <ul class="chips"><?php foreach (cfg('prizes') as $p): ?><li><?= e($p) ?></li><?php endforeach; ?></ul>
  </section>
  <?php endif; ?>

  <section class="rules" id="reglas" aria-labelledby="rules-title">
    <div><h2 id="rules-title" class="section-title"><?= e(t('rules_title')) ?></h2></div>
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
          <span>Acepto los <a href="<?= e(url('legal.php?doc=terminos')) ?>" target="_blank" rel="noopener">Términos y Condiciones</a></span>
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

      <button class="btn btn-dark btn-block" type="submit" data-busy="Subiendo tu foto…"><?= e(t('submit')) ?></button>
      <p class="fine">Una participación por persona. Al enviar te mandaremos un código a tu correo.</p>
    </form>
  </section>
  </div>
</main>
