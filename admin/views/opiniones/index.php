<?php
$typeLabels = [
    "felicitacion" => "Felicitación",
    "solicitud" => "Solicitud",
    "queja" => "Queja",
];
$genderLabels = [
    "masculino" => "Masculino",
    "femenino" => "Femenino",
    "no-binario" => "No binario",
    "otro" => "Otro",
    "prefiero-no-contestar" => "Prefiere no contestar",
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
                <h1>Opiniones</h1>
                <p>Felicitaciones, solicitudes y quejas enviadas desde el interactivo.</p>
            </div>
            <div class="admin-count-pill">
                <span><?= (int) $summary["total"] ?></span>
                <small>Total</small>
            </div>
        </div>

        <?php if ($pageError !== null): ?>
            <div class="alert alert-danger" role="alert"><?= adminEscape($pageError) ?></div>
        <?php endif; ?>

        <div class="admin-summary-grid">
            <div class="admin-summary-card">
                <span class="admin-summary-card__icon"><i class="fa fa-comments"></i></span>
                <div><small>Total</small><strong><?= (int) $summary["total"] ?></strong></div>
            </div>
            <div class="admin-summary-card">
                <span class="admin-summary-card__icon"><i class="fa fa-thumbs-up"></i></span>
                <div><small>Felicitaciones</small><strong><?= (int) $summary["felicitaciones"] ?></strong></div>
            </div>
            <div class="admin-summary-card">
                <span class="admin-summary-card__icon"><i class="fa fa-question-circle"></i></span>
                <div><small>Solicitudes</small><strong><?= (int) $summary["solicitudes"] ?></strong></div>
            </div>
            <div class="admin-summary-card admin-summary-card--accent">
                <span class="admin-summary-card__icon"><i class="fa fa-exclamation-triangle"></i></span>
                <div><small>Quejas</small><strong><?= (int) $summary["quejas"] ?></strong></div>
            </div>
        </div>

        <div class="card admin-table-card">
            <div class="card-header admin-table-card__header">
                <div>
                    <span class="admin-eyebrow">Detalle</span>
                    <h2>Opiniones recibidas</h2>
                    <small>Horario de Ciudad de México.</small>
                </div>
                <div class="admin-table-card__hint">
                    <i class="fa fa-search"></i>
                    <span>Busca por tipo, nombre o comentario</span>
                </div>
            </div>

            <div class="table-responsive">
                <table id="opiniones-table" class="table table-striped table-vmiddle admin-data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Nombre</th>
                            <th>Correo</th>
                            <th>Residencia</th>
                            <th>Edad</th>
                            <th>Género</th>
                            <th>Comentario</th>
                            <th>Dispositivo</th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($opiniones as $opinion): ?>
                        <?php
                        $fullName = trim(implode(" ", array_filter([
                            $opinion["nombre"] ?? "",
                            $opinion["apellido_paterno"] ?? "",
                            $opinion["apellido_materno"] ?? "",
                        ])));
                        ?>
                        <tr>
                            <td><?= (int) $opinion["id"] ?></td>
                            <td data-order="<?= adminEscape($opinion["created_at"] ?? "") ?>"><?= adminFormatDate($opinion["created_at"] ?? null) ?></td>
                            <td><?= adminEscape($typeLabels[$opinion["tipo"]] ?? $opinion["tipo"]) ?></td>
                            <td><?= adminEscape($fullName) ?></td>
                            <td><a href="mailto:<?= adminEscape($opinion["correo"] ?? "") ?>"><?= adminEscape($opinion["correo"] ?? "") ?></a></td>
                            <td><?= adminEscape($opinion["pais"] ?? "") ?></td>
                            <td><?= (int) ($opinion["edad"] ?? 0) ?></td>
                            <td><?= adminEscape($genderLabels[$opinion["genero"]] ?? $opinion["genero"]) ?></td>
                            <td class="admin-long-text"><?= nl2br(adminEscape($opinion["comentario"] ?? "")) ?></td>
                            <td><?= adminEscape($opinion["dispositivo"] ?? "Sitio web") ?></td>
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
    $('#opiniones-table').DataTable({
        order: [[1, 'desc']],
        pageLength: 25,
        language: window.kaluzDataTableLanguage
    });
});
</script>
</body>
</html>
