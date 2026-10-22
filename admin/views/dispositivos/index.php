<?php
$nowUtc = new DateTimeImmutable("now", new DateTimeZone("UTC"));

$deviceConnection = static function (array $device) use ($nowUtc, $onlineSeconds): array {
    if (($device["estado"] ?? "") !== "activo") {
        return ["", ""];
    }

    if (empty($device["ultima_conexion_at"])) {
        return ["desconectado", "Sin conexión"];
    }

    $last = new DateTimeImmutable($device["ultima_conexion_at"], new DateTimeZone("UTC"));
    $isOnline = ($nowUtc->getTimestamp() - $last->getTimestamp()) <= $onlineSeconds;

    return $isOnline ? ["conectado", "Conectado"] : ["desconectado", "Desconectado"];
};

$stateLabels = [
    "pendiente" => "Pendiente de activar",
    "activo" => "Activo",
    "revocado" => "Revocado",
];
?>
<!doctype html>
<html lang="es">
<head>
    <?php require $_SERVER["DOCUMENT_ROOT"] . "/admin/includes/header.php"; ?>
</head>
<body class="admin-body">
<?php require $_SERVER["DOCUMENT_ROOT"] . "/admin/includes/topbar.php"; ?>

<section id="content" class="datatables admin-section">
    <div class="container admin-container">
        <div class="admin-page-heading">
            <div>
                <span class="admin-eyebrow">Kioscos</span>
                <h1>Dispositivos</h1>
                <p>Computadoras donde está instalado el interactivo.</p>
            </div>
            <div class="admin-count-pill">
                <span><?= (int) $summary["conectados"] ?>/<?= (int) $summary["activos"] ?></span>
                <small>Conectados</small>
            </div>
        </div>

        <?php if ($pageError !== null): ?>
            <div class="alert alert-danger" role="alert"><?= adminEscape($pageError) ?></div>
        <?php endif; ?>

        <?php if (is_array($flash) && $flash["message"] !== ""): ?>
            <div class="admin-notice admin-notice--<?= adminEscape($flash["type"]) ?>" role="status">
                <i class="fa <?= $flash["type"] === "success" ? "fa-check-circle" : "fa-exclamation-circle" ?>"></i>
                <span><?= adminEscape($flash["message"]) ?></span>
            </div>
        <?php endif; ?>

        <?php if (is_array($flash) && !empty($flash["codigo"])): ?>
            <div class="admin-activation-code">
                <div>
                    <span class="admin-eyebrow">Código de activación<?= $flash["nombre"] ? " · " . adminEscape($flash["nombre"]) : "" ?></span>
                    <strong><?= adminEscape($flash["codigo"]) ?></strong>
                    <small>Válido por 7 días y para una sola computadora. No se volverá a mostrar.</small>
                </div>
            </div>
        <?php endif; ?>

        <div class="admin-profile-form-card admin-device-form-card">
            <div class="admin-profile-form-card__heading">
                <span class="admin-eyebrow">Nuevo kiosco</span>
                <h2>Agregar dispositivo</h2>
                <p>Se genera un código para activar el programa en la computadora.</p>
            </div>

            <form method="post" action="" class="admin-profile-form admin-device-form">
                <label>
                    <span>Nombre</span>
                    <div class="admin-profile-input">
                        <i class="fa fa-desktop"></i>
                        <input type="text" name="nombre" placeholder="Ej. Kiosco Lobby 1" maxlength="120" minlength="2" required>
                    </div>
                </label>
                <label>
                    <span>Ubicación</span>
                    <div class="admin-profile-input">
                        <i class="fa fa-map-marker"></i>
                        <input type="text" name="ubicacion" placeholder="Ej. Recepción, planta baja" maxlength="160">
                    </div>
                </label>
                <button class="admin-primary-button" type="submit">
                    <span>Generar código</span>
                    <i class="fa fa-long-arrow-right"></i>
                </button>
                <input type="hidden" name="action" value="crear">
                <input type="hidden" name="csrf_token" value="<?= Auth::csrf() ?>">
            </form>
        </div>

        <div class="card admin-table-card">
            <div class="card-header admin-table-card__header">
                <div>
                    <span class="admin-eyebrow">Inventario</span>
                    <h2>Computadoras registradas</h2>
                    <small>"Conectado" significa que envió señal en los últimos <?= (int) round($onlineSeconds / 60) ?> minutos.</small>
                </div>
            </div>

            <div class="table-responsive">
                <table id="dispositivos-table" class="table table-striped table-vmiddle admin-data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Ubicación</th>
                            <th>Estado</th>
                            <th>Última conexión</th>
                            <th>Interacciones</th>
                            <th>Versión</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($dispositivos as $device): ?>
                        <?php
                        $estado = (string) ($device["estado"] ?? "pendiente");
                        [$connectionClass, $connectionLabel] = $deviceConnection($device);
                        ?>
                        <tr>
                            <td><?= (int) $device["id"] ?></td>
                            <td>
                                <strong><?= adminEscape($device["nombre"] ?? "") ?></strong>
                                <?php if (!empty($device["equipo"])): ?>
                                    <br><small><?= adminEscape($device["equipo"]) ?></small>
                                <?php endif; ?>
                            </td>
                            <td><?= adminEscape($device["ubicacion"] ?? "—") ?></td>
                            <td>
                                <span class="admin-status admin-status--<?= adminEscape($estado) ?>"><?= adminEscape($stateLabels[$estado] ?? $estado) ?></span>
                                <?php if ($connectionClass !== ""): ?>
                                    <span class="admin-status admin-status--<?= $connectionClass ?>"><?= $connectionLabel ?></span>
                                <?php endif; ?>
                                <?php if ((int) ($device["codigo_vigente"] ?? 0) === 1): ?>
                                    <br><small>Código vigente hasta <?= adminFormatDate($device["codigo_expira_at"] ?? null) ?></small>
                                <?php endif; ?>
                            </td>
                            <td data-order="<?= adminEscape($device["ultima_conexion_at"] ?? "") ?>">
                                <?= adminFormatDate($device["ultima_conexion_at"] ?? null) ?>
                            </td>
                            <td><?= (int) ($device["interacciones"] ?? 0) ?></td>
                            <td><?= adminEscape($device["version_app"] ?? "—") ?></td>
                            <td class="admin-device-actions">
                                <?php if ($estado !== "revocado"): ?>
                                    <form method="post" action="">
                                        <input type="hidden" name="action" value="regenerar">
                                        <input type="hidden" name="id" value="<?= (int) $device["id"] ?>">
                                        <input type="hidden" name="nombre" value="<?= adminEscape($device["nombre"] ?? "") ?>">
                                        <input type="hidden" name="csrf_token" value="<?= Auth::csrf() ?>">
                                        <button type="submit" class="admin-small-button" title="Sirve para reinstalar el programa en esta computadora">Nuevo código</button>
                                    </form>
                                    <form method="post" action="" onsubmit="return confirm('¿Revocar este dispositivo? Dejará de enviar información.');">
                                        <input type="hidden" name="action" value="revocar">
                                        <input type="hidden" name="id" value="<?= (int) $device["id"] ?>">
                                        <input type="hidden" name="csrf_token" value="<?= Auth::csrf() ?>">
                                        <button type="submit" class="admin-small-button admin-small-button--danger">Revocar</button>
                                    </form>
                                <?php else: ?>
                                    —
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</section>

<?php require $_SERVER["DOCUMENT_ROOT"] . "/admin/includes/footer.php"; ?>

<script>
$(function () {
    $('#dispositivos-table').DataTable({
        order: [[1, 'asc']],
        pageLength: 25,
        columnDefs: [{ orderable: false, targets: 7 }],
        language: window.kaluzDataTableLanguage
    });
});
</script>
</body>
</html>
