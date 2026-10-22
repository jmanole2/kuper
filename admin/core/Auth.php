<?php

class Auth
{

    public static function check()
    {

        if (!isset($_SESSION["logged_in"]) || $_SESSION["logged_in"] !== true) {

            if (self::expectsJson()) {

                http_response_code(401);

                header(
                    "Content-Type: application/json; charset=utf-8"
                );

                echo json_encode([
                    "error" => "Unauthorized"
                ]);

            } else {

                self::redirectToLogin();

            }

            exit;
        }
    }

    private static function redirectToLogin(): void
    {
        $loginUrl =
            "/admin/login/";


        if (!headers_sent()) {

            header(
                "Location: {$loginUrl}"
            );

            return;

        }


        echo '<!doctype html><html><head>';
        echo '<meta charset="utf-8">';
        echo '<meta http-equiv="refresh" content="0;url='
            . htmlspecialchars($loginUrl, ENT_QUOTES, "UTF-8")
            . '">';
        echo '<script>window.location.href = "'
            . htmlspecialchars($loginUrl, ENT_QUOTES, "UTF-8")
            . '";</script>';
        echo '</head><body></body></html>';
    }

    private static function expectsJson(): bool
    {
        $requestUri =
            $_SERVER["REQUEST_URI"]
            ?? "";


        if (strpos($requestUri, "/admin/api/") === 0) {
            return true;
        }


        $requestedWith =
            strtolower(
                $_SERVER["HTTP_X_REQUESTED_WITH"]
                ?? ""
            );


        if ($requestedWith === "xmlhttprequest") {
            return true;
        }


        $accept =
            strtolower(
                $_SERVER["HTTP_ACCEPT"]
                ?? ""
            );


        return strpos($accept, "application/json") !== false;
    }

    public static function csrf()
    {
        if (empty($_SESSION["csrf_token"])) {
            $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
        }

        return $_SESSION["csrf_token"];
    }

    public static function validateCSRF($token)
    {
        if (
            empty($token) ||
            empty($_SESSION["csrf_token"]) ||
            !hash_equals($_SESSION["csrf_token"], $token)
        ) {

            http_response_code(403);
            exit("CSRF token inválido");
        }
    }

    public static function userId()
    {

        return $_SESSION["idUser"] ?? null;
    }

    public static function userRole()
    {

        return $_SESSION["accesslevel"] ?? null;
    }

    public static function isAdmin()
    {

        return isset($_SESSION["accesslevel"])
            && $_SESSION["accesslevel"] === "administrador";
    }
}
