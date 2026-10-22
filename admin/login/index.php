<?php

declare(strict_types=1);

ini_set("display_errors", "1");
ini_set("display_startup_errors", "1");
error_reporting(E_ALL);

session_start();

require_once dirname(__DIR__) . "/includes/bootstrap.php";

$message = "";
$username = trim((string) ($_POST["username"] ?? ""));
$password = (string) ($_POST["password"] ?? "");

if (($_SESSION["logged_in"] ?? false) === true) {
    if (($_SESSION["accesslevel"] ?? "") === "administrador") {
        header("Location: /admin/menu/");
        exit;
    }

    $_SESSION = [];
}

if (($_POST["login"] ?? "") === "yes") {
    if ($username === "" || $password === "") {
        $message = "Completa tu usuario y contraseña.";
    } else {
        $stmt = $mysqli->prepare(
            "SELECT id, nombre, email, accesslevel, password, active
             FROM users
             WHERE username = ?
             LIMIT 1"
        );
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();

        if (!$user || !password_verify($password, $user["password"])) {
            $message = "El usuario o la contraseña no son correctos.";
        } elseif ((int) $user["active"] !== 1) {
            $message = "Este usuario todavía no ha sido aprobado.";
        } elseif ($user["accesslevel"] !== "administrador") {
            $message = "Este usuario no tiene acceso al panel administrativo.";
        } else {
            session_regenerate_id(true);

            $_SESSION["idUser"] = (int) $user["id"];
            $_SESSION["nombre"] = $user["nombre"];
            $_SESSION["correo"] = $user["email"];
            $_SESSION["accesslevel"] = $user["accesslevel"];
            $_SESSION["active"] = (int) $user["active"];
            $_SESSION["logged_in"] = true;

            header("Location: /admin/menu/");
            exit;
        }
    }
}

$pageTitle = "Acceso";
$hasAdminShell = false;
?>
<!doctype html>
<html lang="es">
<head>
    <?php require $_SERVER["DOCUMENT_ROOT"] . "/admin/includes/header.php"; ?>
</head>
<body class="login-content admin-login">
    <main class="admin-login__layout">
        <form
            class="admin-login__form"
            method="post"
            action=""
            aria-label="Iniciar sesión"
            novalidate
        >
            <?php if ($message !== ""): ?>
                <div class="admin-login__error" role="alert">
                    <i class="fa fa-exclamation-circle"></i>
                    <span><?= htmlspecialchars($message, ENT_QUOTES, "UTF-8") ?></span>
                </div>
            <?php endif; ?>

            <label class="admin-login__field">
                <span>Usuario</span>
                <span class="admin-login__input">
                    <i class="fa fa-user"></i>
                    <input
                        type="text"
                        name="username"
                        value="<?= htmlspecialchars($username, ENT_QUOTES, "UTF-8") ?>"
                        placeholder="Tu usuario"
                        autocomplete="username"
                        required
                    >
                </span>
            </label>

            <label class="admin-login__field">
                <span>Contraseña</span>
                <span class="admin-login__input">
                    <i class="fa fa-lock"></i>
                    <input
                        type="password"
                        name="password"
                        placeholder="Tu contraseña"
                        autocomplete="current-password"
                        required
                    >
                </span>
            </label>

            <button class="admin-login__submit" type="submit">
                <span>Entrar al panel</span>
                <i class="fa fa-long-arrow-right"></i>
            </button>
            <input type="hidden" name="login" value="yes">
        </form>
    </main>

    <?php require $_SERVER["DOCUMENT_ROOT"] . "/admin/includes/footer.php"; ?>
</body>
</html>
