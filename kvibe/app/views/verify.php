<?php $noindex = true; ?>
<main class="narrow">
  <section class="card center">
    <div class="icon-badge" aria-hidden="true">✉</div>
    <h1 class="display sm">Revisa tu correo</h1>
    <p>Enviamos un código de 6 dígitos a <strong><?= e($email) ?></strong>.<br>Escríbelo aquí para confirmar tu participación.</p>
    <p class="hint">¿No lo ves? Revisa tu carpeta de spam o promociones.</p>

    <?php if ($error): ?><div class="alert alert-error" role="alert"><?= e($error) ?></div><?php endif; ?>
    <?php if ($notice): ?><div class="alert alert-ok" role="status"><?= e($notice) ?></div><?php endif; ?>

    <form method="post" class="code-form">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="verify">
      <label for="code" class="sr-only">Código de verificación</label>
      <input id="code" class="code-input" name="code" type="text" inputmode="numeric" autocomplete="one-time-code"
             pattern="[0-9]{6}" maxlength="6" placeholder="••••••" required autofocus>
      <button class="btn btn-glow btn-block" type="submit" data-busy="Verificando…">Confirmar participación</button>
    </form>

    <div class="verify-actions">
      <?php if ($canResend): ?>
      <form method="post">
        <?= csrf_field() ?><input type="hidden" name="action" value="resend">
        <button class="link-btn" type="submit">Reenviar código</button>
      </form>
      <?php endif; ?>
      <form method="post">
        <?= csrf_field() ?><input type="hidden" name="action" value="restart">
        <button class="link-btn" type="submit">Corregir mis datos</button>
      </form>
    </div>
  </section>
</main>
