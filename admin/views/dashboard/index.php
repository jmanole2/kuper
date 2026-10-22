<!doctype html>
<html lang="es">
<head>
    <?php require $_SERVER["DOCUMENT_ROOT"] . "/admin/includes/header.php"; ?>
</head>
<body class="admin-body">
<?php require $_SERVER["DOCUMENT_ROOT"] . "/admin/includes/topbar.php"; ?>

<section id="content" class="admin-section">
    <div class="container admin-container">
        <div class="admin-page-heading">
            <div>
                <span class="admin-eyebrow">Resumen del kiosco</span>
                <h1>Vista general</h1>
                <p>La actividad del interactivo, clara y en un solo lugar.</p>
            </div>
            <div class="admin-page-heading__date">
                <i class="fa fa-calendar"></i>
                <span><?= date("d.m.Y") ?></span>
            </div>
        </div>

        <?php if ($pageError !== null): ?>
            <div class="alert alert-danger" role="alert">
                <?= adminEscape($pageError) ?>
            </div>
        <?php endif; ?>

        <section class="admin-hero">
            <div class="admin-hero__content">
                <span class="admin-hero__eyebrow">SM Kaluz · Interactivo</span>
                <h2>Conoce el interés y el tiempo de exploración.</h2>
            </div>
            <div class="admin-hero__icons" aria-hidden="true">
                <span><i class="fa fa-users"></i></span>
                <span><i class="fa fa-clock-o"></i></span>
                <span><i class="fa fa-line-chart"></i></span>
            </div>
        </section>

        <div class="admin-dashboard-grid">
            <a class="admin-metric-card admin-metric-card--light" href="/admin/registros/">
                <div class="admin-metric-card__top">
                    <div class="admin-metric-card__icon">
                        <i class="fa fa-envelope"></i>
                    </div>
                    <span class="admin-metric-card__link">Explorar <i class="fa fa-long-arrow-right"></i></span>
                </div>
                <div class="admin-metric-card__value"><?= (int) $metrics["registros"] ?></div>
                <div class="admin-metric-card__label">
                    <strong>Registros</strong>
                    <span>Personas interesadas en los recorridos</span>
                </div>
            </a>

            <a class="admin-metric-card admin-metric-card--cream" href="/admin/interacciones/">
                <div class="admin-metric-card__top">
                    <div class="admin-metric-card__icon">
                        <i class="fa fa-hand-o-up"></i>
                    </div>
                    <span class="admin-metric-card__link">Explorar <i class="fa fa-long-arrow-right"></i></span>
                </div>
                <div class="admin-metric-card__value"><?= (int) $metrics["interacciones"]["total"] ?></div>
                <div class="admin-metric-card__label">
                    <strong>Interacciones</strong>
                    <span><?= (int) $metrics["interacciones"]["finalizadas"] ?> recorridos finalizados</span>
                </div>
            </a>
        </div>

        <section class="admin-insight-card">
            <div class="admin-insight-card__main">
                <span class="admin-eyebrow">Tiempo de exploración</span>
                <strong><?= adminFormatDuration($metrics["interacciones"]["duracion_promedio_segundos"]) ?></strong>
                <p>Duración promedio de las interacciones finalizadas.</p>
            </div>
            <div class="admin-insight-card__stats">
                <div>
                    <span>Finalizadas</span>
                    <strong><?= (int) $metrics["interacciones"]["finalizadas"] ?></strong>
                </div>
                <div>
                    <span>Activas</span>
                    <strong><?= (int) $metrics["interacciones"]["activas"] ?></strong>
                </div>
            </div>
        </section>
    </div>
</section>

<?php require $_SERVER["DOCUMENT_ROOT"] . "/admin/includes/footer.php"; ?>
</body>
</html>
