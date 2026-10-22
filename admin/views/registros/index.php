<?php
$routeLabels = [
    "roma-condesa" => "Roma - Condesa",
    "centro" => "Centro",
    "juarez" => "Juárez",
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
                <span class="admin-eyebrow">Audiencia</span>
                <h1>Registros</h1>
                <p>Personas que solicitaron información sobre los recorridos.</p>
            </div>
            <div class="admin-count-pill">
                <span><?= count($registros) ?></span>
                <small>Total</small>
            </div>
        </div>

        <?php if ($pageError !== null): ?>
            <div class="alert alert-danger" role="alert">
                <?= adminEscape($pageError) ?>
            </div>
        <?php endif; ?>

        <div class="card admin-table-card">
            <div class="card-header admin-table-card__header">
                <div>
                    <span class="admin-eyebrow">Directorio</span>
                    <h2>Personas registradas</h2>
                    <small>Los correos pueden aparecer más de una vez.</small>
                </div>
                <div class="admin-table-card__hint">
                    <i class="fa fa-search"></i>
                    <span>Usa el buscador para filtrar</span>
                </div>
            </div>

            <div class="table-responsive">
                <table id="registros-table" class="table table-striped table-vmiddle admin-data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Correo</th>
                            <th>Recorridos</th>
                            <th>Dispositivo</th>
                            <th>Fecha de registro</th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($registros as $registro): ?>
                        <tr>
                            <td><?= (int) $registro["id"] ?></td>
                            <td><?= adminEscape($registro["nombre"] ?? "") ?></td>
                            <td>
                                <a href="mailto:<?= adminEscape($registro["correo"] ?? "") ?>">
                                    <?= adminEscape($registro["correo"] ?? "") ?>
                                </a>
                            </td>
                            <td>
                                <?= adminEscape(implode(", ", array_map(
                                    static fn (string $route): string => $routeLabels[$route] ?? $route,
                                    array_filter(explode(",", (string) ($registro["recorridos"] ?? "")))
                                )) ?: "—") ?>
                            </td>
                            <td><?= adminEscape($registro["dispositivo"] ?? "Sitio web") ?></td>
                            <td data-order="<?= adminEscape($registro["created_at"] ?? "") ?>">
                                <?= adminFormatDate($registro["created_at"] ?? null) ?>
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
    $('#registros-table').DataTable({
        order: [[5, 'desc']],
        pageLength: 25,
        language: window.kaluzDataTableLanguage
    });
});
</script>
</body>
</html>
