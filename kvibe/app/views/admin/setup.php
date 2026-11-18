<div class="card" style="max-width:640px;margin:24px auto">
  <h1 style="margin-top:0">Instalación K-VIBE+</h1>

  <h3>Diagnóstico</h3>
  <table style="width:100%;border-collapse:collapse">
    <?php foreach ($checks as [$label, $ok, $detail]): ?>
      <tr style="border-bottom:1px solid var(--line)">
        <td style="padding:6px 4px"><?= $ok ? '✅' : '❌' ?> <?= e($label) ?></td>
        <td style="padding:6px 4px" class="muted"><?= e($detail) ?></td>
      </tr>
    <?php endforeach; ?>
  </table>

  <?php if ($result): ?>
    <h3>Resultado</h3>
    <ul><?php foreach ($result as $r): ?><li<?= str_starts_with($r, 'ERROR') ? ' class="err"' : '' ?>><?= e($r) ?></li><?php endforeach; ?></ul>
    <p><a class="btn btn-pri" href="<?= e(url('admin/')) ?>">Ir al panel</a></p>
  <?php else: ?>
    <?php if ($error): ?><p class="err"><?= e($error) ?></p><?php endif; ?>
    <h3>Crear tablas y administrador</h3>
    <form method="post" class="login" style="margin:0;max-width:none">
      <?= csrf_field() ?>
      <label for="t">Token de instalación (el de config.local.php)</label>
      <input id="t" name="token" type="password" required>
      <label for="u">Usuario del panel</label>
      <input id="u" name="username" required autocomplete="username">
      <label for="n">Nombre</label>
      <input id="n" name="name">
      <label for="p">Contraseña (mín. 12 caracteres)</label>
      <input id="p" name="password" type="password" required minlength="12" autocomplete="new-password">
      <label for="p2">Repite la contraseña</label>
      <input id="p2" name="password2" type="password" required minlength="12" autocomplete="new-password">
      <label for="m">Enviar correo de prueba a (opcional)</label>
      <input id="m" name="test_email" type="email" placeholder="tucorreo@gmail.com">
      <p><button class="btn-pri" type="submit">Instalar</button></p>
    </form>
  <?php endif; ?>
</div>
