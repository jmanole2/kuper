<?php
/** @var Store $store */
/** @var string|null $message */
require __DIR__ . "/layout.php";
kioscoPageStart("Activar");
?>
    <span class="eyebrow">Kiosco SM Kaluz · v<?= KIOSCO_VERSION ?></span>
    <h1>Activar esta computadora</h1>

    <?php if ($store->isActivated()): ?>
        <p>Esta computadora ya está activada<?= $store->get("nombre") ? " como <strong>" . htmlspecialchars($store->get("nombre"), ENT_QUOTES, "UTF-8") . "</strong>" : "" ?>.
           Si capturas un código nuevo, se reemplaza la activación actual.</p>
    <?php else: ?>
        <p>En el admin, entra a <strong>Dispositivos → Agregar dispositivo</strong> y escribe aquí el código que aparece.</p>
    <?php endif; ?>

    <?php if (!empty($message)): ?>
        <p class="error" role="alert"><?= htmlspecialchars($message, ENT_QUOTES, "UTF-8") ?></p>
    <?php endif; ?>

    <form method="post" action="/activar">
        <input name="codigo" placeholder="XXXX-XXXX" maxlength="9" autocomplete="off" autofocus required>
        <button type="submit">Activar</button>
    </form>

    <?php if ($store->isActivated()): ?>
        <a class="button" href="/" style="background:#fff;color:#111;border:1px solid #ccc">Volver al interactivo</a>
    <?php endif; ?>
    <p><small>Identificador de esta computadora: <?= htmlspecialchars($store->deviceUuid(), ENT_QUOTES, "UTF-8") ?></small></p>
<?php
kioscoPageEnd();
