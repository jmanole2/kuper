<div class="card login">
  <h1 style="margin-top:0">Panel K-VIBE+</h1>
  <?php if ($error): ?><p class="err"><?= e($error) ?></p><?php endif; ?>
  <form method="post">
    <?= csrf_field() ?>
    <label for="u">Usuario</label>
    <input id="u" name="username" autocomplete="username" required autofocus>
    <label for="p">Contraseña</label>
    <input id="p" name="password" type="password" autocomplete="current-password" required>
    <p><button class="btn-pri" type="submit">Entrar</button></p>
  </form>
</div>
