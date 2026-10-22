<?php

declare(strict_types=1);

ini_set("display_errors", "1");
ini_set("display_startup_errors", "1");
error_reporting(E_ALL);

session_start();

require_once dirname(__DIR__) . "/includes/bootstrap.php";

Auth::check();

if (!in_array(Auth::userRole(), ["administrador", "reclutador"], true)) {
    header("Location: /admin/login/");
    exit;
}

$userId = (int) Auth::userId();
$userInfo = getUserInfo($userId, $mysqli);
$statusMessage = null;
$statusType = "success";

if (($_POST["edit_user"] ?? "") === "yes") {
    Auth::validateCSRF($_POST["csrf_token"] ?? "");

    $submittedUserId = (int) ($_POST["id"] ?? 0);
    $password = (string) ($_POST["password"] ?? "");

    if ($submittedUserId !== $userId) {
        header("Location: /admin/logout/");
        exit;
    }

    if ($password === "") {
        $statusMessage = "Escribe una nueva contraseña para guardar el cambio.";
        $statusType = "warning";
    } elseif (strlen($password) < 8) {
        $statusMessage = "La contraseña debe tener al menos 8 caracteres.";
        $statusType = "warning";
    } else {
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $mysqli->prepare("UPDATE users SET password = ? WHERE id = ?");
        $stmt->bind_param("si", $passwordHash, $userId);
        $stmt->execute();
        $stmt->close();

        $statusMessage = "La contraseña se actualizó correctamente.";
    }
}

$stmt = $mysqli->prepare(
    "SELECT id, username, nombre, email, accesslevel
     FROM users
     WHERE id = ?
     LIMIT 1"
);
$stmt->bind_param("i", $userId);
$stmt->execute();
$account = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$account) {
    header("Location: /admin/logout/");
    exit;
}

$pageTitle = "Mi perfil";
$currentSection = "profile";
$initial = function_exists("mb_substr")
    ? mb_strtoupper(mb_substr($account["nombre"], 0, 1, "UTF-8"), "UTF-8")
    : strtoupper(substr($account["nombre"], 0, 1));
?>
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
                    <span class="admin-eyebrow">Cuenta</span>
                    <h1>Mi perfil</h1>
                    <p>Consulta tus datos y actualiza tu contraseña de acceso.</p>
                </div>
                <a class="admin-back-button" href="/admin/menu/">
                    <i class="fa fa-long-arrow-left"></i>
                    <span>Volver</span>
                </a>
            </div>

            <?php if ($statusMessage !== null): ?>
                <div class="admin-notice admin-notice--<?= $statusType ?>" role="status">
                    <i class="fa <?= $statusType === "success" ? "fa-check-circle" : "fa-exclamation-circle" ?>"></i>
                    <span><?= htmlspecialchars($statusMessage, ENT_QUOTES, "UTF-8") ?></span>
                </div>
            <?php endif; ?>

            <div class="admin-profile-grid">
                <aside class="admin-profile-card">
                    <div class="admin-profile-card__avatar"><?= htmlspecialchars($initial, ENT_QUOTES, "UTF-8") ?></div>
                    <span class="admin-profile-card__role"><?= htmlspecialchars(ucfirst($account["accesslevel"]), ENT_QUOTES, "UTF-8") ?></span>
                    <h2><?= htmlspecialchars($account["nombre"], ENT_QUOTES, "UTF-8") ?></h2>
                    <p><?= htmlspecialchars($account["email"], ENT_QUOTES, "UTF-8") ?></p>
                    <div class="admin-profile-card__meta">
                        <span>Usuario</span>
                        <strong>@<?= htmlspecialchars($account["username"], ENT_QUOTES, "UTF-8") ?></strong>
                    </div>
                </aside>

                <div class="admin-profile-form-card">
                    <div class="admin-profile-form-card__heading">
                        <span class="admin-eyebrow">Seguridad</span>
                        <h2>Cambiar contraseña</h2>
                        <p>Usa al menos 8 caracteres para proteger tu cuenta.</p>
                    </div>

                    <form method="post" action="" class="admin-profile-form">
                        <label>
                            <span>Usuario</span>
                            <div class="admin-profile-input is-disabled">
                                <i class="fa fa-user"></i>
                                <input
                                    type="text"
                                    value="<?= htmlspecialchars($account["username"], ENT_QUOTES, "UTF-8") ?>"
                                    disabled
                                >
                            </div>
                        </label>

                        <label>
                            <span>Nueva contraseña</span>
                            <div class="admin-profile-input">
                                <i class="fa fa-lock"></i>
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    placeholder="Mínimo 8 caracteres"
                                    autocomplete="new-password"
                                    minlength="8"
                                >
                            </div>
                        </label>

                        <button class="admin-primary-button" type="submit">
                            <span>Guardar contraseña</span>
                            <i class="fa fa-long-arrow-right"></i>
                        </button>

                        <input type="hidden" name="edit_user" value="yes">
                        <input type="hidden" name="id" value="<?= $userId ?>">
                        <input type="hidden" name="csrf_token" value="<?= Auth::csrf() ?>">
                    </form>
                </div>
            </div>
        </div>
    </section>

    <?php require $_SERVER["DOCUMENT_ROOT"] . "/admin/includes/footer.php"; ?>
</body>
</html>
