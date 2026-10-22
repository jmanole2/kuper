<?php
/** @var Store $store */
require __DIR__ . "/layout.php";
$counts = $store->pendingCounts();
$lastConnection = $store->get("ultima_conexion");
$isOnline = $lastConnection !== null && (time() - strtotime($lastConnection)) <= 180;
$e = static fn (?string $value): string => htmlspecialchars((string) ($value ?? "—"), ENT_QUOTES, "UTF-8");
kioscoPageStart("Estado");
?>
    <span class="eyebrow">Kiosco SM Kaluz · v<?= KIOSCO_VERSION ?></span>
    <h1>Estado del kiosco</h1>

    <dl>
        <dt>Activado</dt>
        <dd class="<?= $store->isActivated() ? "ok" : "bad" ?>"><?= $store->isActivated() ? "Sí" : "No" ?></dd>
        <dt>Nombre en el admin</dt>
        <dd><?= $e($store->get("nombre")) ?></dd>
        <dt>Conexión</dt>
        <dd class="<?= $isOnline ? "ok" : "bad" ?>"><?= $isOnline ? "Conectado" : "Sin conexión" ?></dd>
        <dt>Última conexión (UTC)</dt>
        <dd><?= $e($lastConnection) ?></dd>
        <dt>Formularios por enviar</dt>
        <dd><?= (int) $counts["pendiente"] ?></dd>
        <dt>Interacciones por enviar</dt>
        <dd><?= (int) $counts["interacciones"] ?></dd>
        <dt>Formularios rechazados</dt>
        <dd><?= (int) $counts["rechazado"] ?></dd>
        <dt>Último error</dt>
        <dd><?= $e($store->get("ultimo_error")) ?></dd>
        <dt>Identificador</dt>
        <dd><?= $e($store->deviceUuid()) ?></dd>
        <dt>Servidor</dt>
        <dd><?= $e(kioscoConfig()["server_url"]) ?></dd>
    </dl>

    <a class="button" href="/">Volver al interactivo</a>
    <a class="button" href="/activar" style="background:#fff;color:#111;border:1px solid #ccc">Activar con otro código</a>
<?php
kioscoPageEnd();
