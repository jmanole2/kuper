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
                <span class="admin-eyebrow">Actividad</span>
                <h1>Interacciones</h1>
                <p>Sesiones independientes que reflejan el uso del interactivo.</p>
            </div>
            <div class="admin-count-pill">
                <span><?= (int) $summary["total"] ?></span>
                <small>Total</small>
            </div>
        </div>

        <?php if ($pageError !== null): ?>
            <div class="alert alert-danger" role="alert">
                <?= adminEscape($pageError) ?>
            </div>
        <?php endif; ?>

        <div class="admin-summary-grid">
            <div class="admin-summary-card">
                <span class="admin-summary-card__icon"><i class="fa fa-hand-o-up"></i></span>
                <div>
                    <small>Total</small>
                    <strong><?= (int) $summary["total"] ?></strong>
                </div>
            </div>
            <div class="admin-summary-card">
                <span class="admin-summary-card__icon"><i class="fa fa-check"></i></span>
                <div>
                    <small>Finalizadas</small>
                    <strong><?= (int) $summary["finalizadas"] ?></strong>
                </div>
            </div>
            <div class="admin-summary-card">
                <span class="admin-summary-card__icon"><i class="fa fa-clock-o"></i></span>
                <div>
                    <small>Activas</small>
                    <strong><?= (int) $summary["activas"] ?></strong>
                </div>
            </div>
            <div class="admin-summary-card admin-summary-card--accent">
                <span class="admin-summary-card__icon"><i class="fa fa-history"></i></span>
                <div>
                    <small>Duración promedio</small>
                    <strong><?= adminFormatDuration($summary["duracion_promedio_segundos"]) ?></strong>
                </div>
            </div>
        </div>

        <div class="card admin-table-card">
            <div class="card-header admin-table-card__header">
                <div>
                    <span class="admin-eyebrow">Detalle</span>
                    <h2>Historial de sesiones</h2>
                    <small>Horario de Ciudad de México.</small>
                </div>
                <div class="admin-table-card__hint">
                    <i class="fa fa-search"></i>
                    <span>Busca por fecha, estado o duración</span>
                </div>
            </div>

            <div class="table-responsive">
                <table id="interacciones-table" class="table table-striped table-vmiddle admin-data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Inicio</th>
                            <th>Fin</th>
                            <th>Duración</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($interacciones as $interaccion): ?>
                        <?php $estado = $interaccion["estado"] ?? "activa"; ?>
                        <tr>
                            <td><?= (int) $interaccion["id"] ?></td>
                            <td data-order="<?= adminEscape($interaccion["inicio_at"] ?? "") ?>">
                                <?= adminFormatDate($interaccion["inicio_at"] ?? null) ?>
                            </td>
                            <td data-order="<?= adminEscape($interaccion["fin_at"] ?? "") ?>">
                                <?= adminFormatDate($interaccion["fin_at"] ?? null) ?>
                            </td>
                            <td data-order="<?= $interaccion["duracion_segundos"] !== null ? (int) $interaccion["duracion_segundos"] : -1 ?>">
                                <?= adminFormatDuration(
                                    $interaccion["duracion_segundos"] !== null
                                        ? (int) $interaccion["duracion_segundos"]
                                        : null
                                ) ?>
                            </td>
                            <td>
                                <span class="admin-status admin-status--<?= adminEscape($estado) ?>">
                                    <?= $estado === "finalizada" ? "Finalizada" : "Activa" ?>
                                </span>
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
    $('#interacciones-table').DataTable({
        order: [[1, 'desc']],
        pageLength: 25,
        language: window.kaluzDataTableLanguage
    });
});
</script>
</body>
</html>
